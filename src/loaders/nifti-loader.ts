import * as nifti from "nifti-reader-js";
import { NIFTI1, NIFTI2 } from "nifti-reader-js";
import { fileReadAsArrayBuffer } from "../core/loader.js";
import { AxisName, VolumeData, VolumeHeader, VoxelData } from "../types/index.js";

type AnyNiftiHeader = NIFTI1 | NIFTI2;

// ── 公开入口 ─────────────────────────────────────────────────

export const niftiFileRead = async (path: string): Promise<VolumeData> => {
  const buffer = await fileReadAsArrayBuffer(path);
  return niftiFileReadFromBuffer(buffer);
};

export const niftiFileReadFromBuffer = (buffer: ArrayBuffer): VolumeData => {
  if (!nifti.isNIFTI(buffer)) {
    throw new Error("Not a valid NIfTI file.");
  }

  const niftiHeader = nifti.readHeader(buffer);
  if (!niftiHeader) throw new Error("Failed to read NIfTI header.");

  const ndims = niftiHeader.dims[0];
  if (ndims < 3 || ndims > 4) {
    throw new Error(`Cannot handle ${ndims}-dimensional NIfTI images.`);
  }
  if (ndims === 4 && niftiHeader.dims[4] > 1) {
    console.warn(`NIfTI has ${niftiHeader.dims[4]} time points, only the first will be used.`);
  }

  const imageBuffer = nifti.readImage(niftiHeader, buffer);
  const header = buildHeader(niftiHeader);
  const data = extractData(header, niftiHeader, imageBuffer);

  return { header, data, min: header.voxel_min, max: header.voxel_max };
};

// ── Header 转换：nifti-reader-js → VolumeHeader ──────────────

function buildHeader(n: AnyNiftiHeader): VolumeHeader {
  const header: VolumeHeader = {
    order: ["xspace", "yspace", "zspace"],
    xspace: { name: "xspace", space_length: 0, step: 0, start: 0, direction_cosines: [1, 0, 0], offset: 0 },
    yspace: { name: "yspace", space_length: 0, step: 0, start: 0, direction_cosines: [0, 1, 0], offset: 0 },
    zspace: { name: "zspace", space_length: 0, step: 0, start: 0, direction_cosines: [0, 0, 1], offset: 0 },
    datatype: n.datatypeCode,
    vox_offset: n.vox_offset,
    bytes_per_voxel: n.numBitsPerVoxel / 8,
    must_swap_data: !n.littleEndian && n.numBitsPerVoxel > 8,
    scl_slope: n.scl_slope,
    scl_inter: n.scl_inter,
    voxel_min: 0,
    voxel_max: 0,
  };

  // affine は nifti-reader-js が sform/qform/pixDims の優先順位を自動処理済み
  // affine[row][col]: 3×4 の変換行列（row 3 は [0,0,0,1]）
  const xfm = n.affine as number[][];

  // 軸順序を判定（各ファイル軸が xspace/yspace/zspace のどれに対応するか）
  const order: AxisName[] = ["xspace", "yspace", "zspace"];
  const axisIndexFromFile = [0, 1, 2];
  for (let i = 0; i < 3; i++) {
    const cx = Math.abs(xfm[0][i]);
    const cy = Math.abs(xfm[1][i]);
    const cz = Math.abs(xfm[2][i]);
    if (cx > cy && cx > cz) {
      order[2 - i] = "xspace"; axisIndexFromFile[i] = 0;
    } else if (cy > cx && cy > cz) {
      order[2 - i] = "yspace"; axisIndexFromFile[i] = 1;
    } else {
      order[2 - i] = "zspace"; axisIndexFromFile[i] = 2;
    }
  }
  header.order = order as [AxisName, AxisName, AxisName];

  // affine を MINC 形式の transform に並び替え
  const transform: number[][] = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 1]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 4; j++) {
      const volAxis = j < 3 ? axisIndexFromFile[j] : j;
      transform[i][volAxis] = xfm[i][j];
    }
  }

  applyTransform(transform, header);

  // 各軸の体素数（dims[1]=x, dims[2]=y, dims[3]=z）
  header[order[2]].space_length = n.dims[1];
  header[order[1]].space_length = n.dims[2];
  header[order[0]].space_length = n.dims[3];

  return header;
}

// ── 仿射变换 → MINC 格式 step/start/direction_cosines ─────────

function applyTransform(transform: number[][], header: VolumeHeader): void {
  const mag = (v: number[]) => Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2) || 1;
  const col = (m: number[][], j: number) => [m[0][j], m[1][j], m[2][j]];

  const xmag = mag(col(transform, 0));
  const ymag = mag(col(transform, 1));
  const zmag = mag(col(transform, 2));

  const xstep = transform[0][0] < 0 ? -xmag : xmag;
  const ystep = transform[1][1] < 0 ? -ymag : ymag;
  const zstep = transform[2][2] < 0 ? -zmag : zmag;

  const xdc: [number, number, number] = [transform[0][0] / xstep, transform[1][0] / xstep, transform[2][0] / xstep];
  const ydc: [number, number, number] = [transform[0][1] / ystep, transform[1][1] / ystep, transform[2][1] / ystep];
  const zdc: [number, number, number] = [transform[0][2] / zstep, transform[1][2] / zstep, transform[2][2] / zstep];

  const starts = [transform[0][3], transform[1][3], transform[2][3]];
  const denom = det3(xdc, ydc, zdc);

  header.xspace.step = xstep;
  header.yspace.step = ystep;
  header.zspace.step = zstep;
  header.xspace.start = det3(starts as [number, number, number], ydc, zdc) / denom;
  header.yspace.start = det3(xdc, starts as [number, number, number], zdc) / denom;
  header.zspace.start = det3(xdc, ydc, starts as [number, number, number]) / denom;
  header.xspace.direction_cosines = xdc;
  header.yspace.direction_cosines = ydc;
  header.zspace.direction_cosines = zdc;
}

function det3(a: [number, number, number], b: [number, number, number], c: [number, number, number]): number {
  return (a[0] * (b[1] * c[2] - b[2] * c[1]) -
          a[1] * (b[0] * c[2] - b[2] * c[0]) +
          a[2] * (b[0] * c[1] - b[1] * c[0]));
}

// ── 体素データ抽出 ────────────────────────────────────────────
// readImage() が返す imageBuffer は offset=0 から始まる純粋な画像データ

function extractData(header: VolumeHeader, n: AnyNiftiHeader, imageBuffer: ArrayBuffer): VoxelData {
  if (header.must_swap_data) {
    swapBytes(new Uint8Array(imageBuffer), header.bytes_per_voxel);
  }

  let data: VoxelData;
  switch (header.datatype) {
    case NIFTI1.TYPE_UINT8:    data = new Uint8Array(imageBuffer);   break;
    case NIFTI1.TYPE_INT16:    data = new Int16Array(imageBuffer);   break;
    case NIFTI1.TYPE_INT32:    data = new Int32Array(imageBuffer);   break;
    case NIFTI1.TYPE_FLOAT32:  data = new Float32Array(imageBuffer); break;
    case NIFTI1.TYPE_FLOAT64:  data = new Float64Array(imageBuffer); break;
    case NIFTI1.TYPE_INT8:     data = new Int8Array(imageBuffer) as unknown as VoxelData; break;
    case NIFTI1.TYPE_UINT16:   data = new Uint16Array(imageBuffer);  break;
    case NIFTI1.TYPE_UINT32:   data = new Uint32Array(imageBuffer) as unknown as VoxelData; break;
    default: throw new Error(`Unsupported NIfTI datatype: ${header.datatype}`);
  }

  // 強度スケーリング
  if (n.scl_slope !== 0) {
    const scaled = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      scaled[i] = data[i] * n.scl_slope + n.scl_inter;
    }
    data = scaled;
  }

  // min/max スキャン
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  header.voxel_min = min;
  header.voxel_max = max;

  // 各軸の一次元配列ストライド
  const [ax0, ax1, ax2] = header.order;
  header[ax0].offset = header[ax1].space_length * header[ax2].space_length;
  header[ax1].offset = header[ax2].space_length;
  header[ax2].offset = 1;

  return data;
}

function swapBytes(bytes: Uint8Array, n: number): void {
  for (let d = 0; d < bytes.length; d += n) {
    let lo = 0, hi = n - 1;
    while (hi > lo) {
      const tmp = bytes[d + hi];
      bytes[d + hi] = bytes[d + lo];
      bytes[d + lo] = tmp;
      hi--; lo++;
    }
  }
}
