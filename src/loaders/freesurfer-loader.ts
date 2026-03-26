import { fileReadAsArrayBuffer } from "../core/loader.js";
import { ModelData } from "../types/index.js";
import { parseFreeSurferSurfaceInWorker, parseFreeSurferCurvInWorker } from "../worker/model-worker-clients.js";

const SURFACE_MAGIC = 16777214; // 0xFF 0xFF 0xFE — triangle surface
const CURV_MAGIC    = 16777215; // 0xFF 0xFF 0xFF — curvature

function readMagic(bytes: Uint8Array): number {
  return (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
}

/** Skip two newline-terminated comment lines after the 3-byte magic. */
function skipComments(bytes: Uint8Array): number {
  let offset = 3;
  let newlines = 0;
  while (offset < bytes.length && newlines < 2) {
    if (bytes[offset] === 10) newlines++;
    offset++;
  }
  return offset;
}

export function freeSurferSurfaceFileReadFromBuffer(buffer: ArrayBuffer): ModelData {
  const bytes = new Uint8Array(buffer);
  const magic = readMagic(bytes);

  if (magic !== SURFACE_MAGIC) {
    throw new Error(
      `Not a FreeSurfer triangle surface file (magic=0x${magic.toString(16)})`
    );
  }

  let offset = skipComments(bytes);
  const view = new DataView(buffer);

  const vnum = view.getInt32(offset, false); offset += 4;
  const fnum = view.getInt32(offset, false); offset += 4;

  const vertices = new Float32Array(vnum * 3);
  for (let i = 0; i < vnum * 3; i++) {
    vertices[i] = view.getFloat32(offset, false);
    offset += 4;
  }

  const indices = new Array<number>(fnum * 3);
  for (let i = 0; i < fnum * 3; i++) {
    indices[i] = view.getInt32(offset, false);
    offset += 4;
  }

  return {
    vertices,
    shapes: [{ indices }],
    normals: new Float32Array(0),
    color: [0.7, 0.7, 0.7, 1.0],
  };
}

export function freeSurferCurvFileReadFromBuffer(buffer: ArrayBuffer): Float32Array {
  const bytes = new Uint8Array(buffer);
  const magic = readMagic(bytes);
  const view = new DataView(buffer);
  let offset = 3;

  if (magic === CURV_MAGIC) {
    const vnum = view.getInt32(offset, false); offset += 4;
    /* fnum */ view.getInt32(offset, false);   offset += 4;
    const vpv  = view.getInt32(offset, false); offset += 4;

    const values = new Float32Array(vnum * vpv);
    for (let i = 0; i < vnum * vpv; i++) {
      values[i] = view.getFloat32(offset, false);
      offset += 4;
    }
    return values;
  } else {
    const vnum = magic;
    offset += 3;

    const values = new Float32Array(vnum);
    for (let i = 0; i < vnum; i++) {
      values[i] = view.getInt16(offset, false) / 100;
      offset += 2;
    }
    return values;
  }
}

export async function freeSurferSurfaceFileRead(path: string): Promise<ModelData> {
  return parseFreeSurferSurfaceInWorker(await fileReadAsArrayBuffer(path));
}

export async function freeSurferCurvFileRead(path: string): Promise<Float32Array> {
  return parseFreeSurferCurvInWorker(await fileReadAsArrayBuffer(path));
}
