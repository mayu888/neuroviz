export type ModelData = {
  vertices: Float32Array;
  shapes: Array<{ indices: Uint32Array | Int32Array | number[] }>;
  normals?: Float32Array;
  color?: Float32Array | number[];
};

export type ColorMap = number[][];

export type TkRas = {
  vox2ras: number[][];
  vox2ras_tkr_inv: number[][];
};

export type PathOrFile =
  | { url: string; file?: never }
  | { file: ArrayBuffer; url?: never };

export type Coordinate = {
  x: number;
  y: number;
  z: number;
};

// ── Volume Viewer ────────────────────────────────────────────

export type AxisName = "xspace" | "yspace" | "zspace";

export type AxisInfo = {
  name: AxisName;
  space_length: number;               // 该轴体素数量
  step: number;                       // 体素尺寸 (mm)，可为负（表示方向翻转）
  start: number;                      // 起始坐标 (mm)
  direction_cosines: [number, number, number];
  offset: number;                     // 在一维 data 数组中的步长
};

export type VolumeHeader = {
  order: [AxisName, AxisName, AxisName]; // 慢轴→快轴，如 ["zspace","yspace","xspace"]
  xspace: AxisInfo;
  yspace: AxisInfo;
  zspace: AxisInfo;
  datatype: number;                   // NIfTI datatype code
  vox_offset: number;                 // data 在文件中的字节偏移
  bytes_per_voxel: number;
  must_swap_data: boolean;
  scl_slope: number;                  // 强度缩放斜率（0 表示不缩放）
  scl_inter: number;                  // 强度缩放截距
  voxel_min: number;                  // 实际数据最小值
  voxel_max: number;                  // 实际数据最大值
};

export type VoxelData = Float32Array | Int16Array | Uint8Array | Int32Array | Uint16Array | Float64Array;

export type VolumeData = {
  header: VolumeHeader;
  data: VoxelData;
  min: number;
  max: number;
};
