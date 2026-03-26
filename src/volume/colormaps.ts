/**
 * LUT (Look-Up Table): Uint8Array of length 256×3.
 * Entry i → [r, g, b] at lut[i*3], lut[i*3+1], lut[i*3+2], values 0-255.
 */
export type LUT = Uint8Array;

// [position 0-1, r 0-255, g 0-255, b 0-255]
type ControlPoint = [number, number, number, number];

function buildLUT(points: ControlPoint[]): LUT {
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let lo = points[0];
    let hi = points[points.length - 1];
    for (let j = 0; j < points.length - 1; j++) {
      if (t >= points[j][0] && t <= points[j + 1][0]) {
        lo = points[j];
        hi = points[j + 1];
        break;
      }
    }
    const s = lo[0] === hi[0] ? 0 : (t - lo[0]) / (hi[0] - lo[0]);
    lut[i * 3]     = Math.round(lo[1] + s * (hi[1] - lo[1]));
    lut[i * 3 + 1] = Math.round(lo[2] + s * (hi[2] - lo[2]));
    lut[i * 3 + 2] = Math.round(lo[3] + s * (hi[3] - lo[3]));
  }
  return lut;
}

export const COLORMAPS = {
  /** 灰度（默认） */
  gray: buildLUT([
    [0.00,   0,   0,   0],
    [1.00, 255, 255, 255],
  ]),

  /** 黑→红→黄→白，适合激活图 */
  hot: buildLUT([
    [0.00,   0,   0,   0],
    [0.33, 255,   0,   0],
    [0.67, 255, 255,   0],
    [1.00, 255, 255, 255],
  ]),

  /** 青→品红 */
  cool: buildLUT([
    [0.00,   0, 255, 255],
    [1.00, 255,   0, 255],
  ]),

  /** 紫→蓝→绿→黄，感知均匀，科研常用 */
  viridis: buildLUT([
    [0.00,  68,   1,  84],
    [0.25,  59,  82, 139],
    [0.50,  33, 145, 140],
    [0.75,  94, 201,  98],
    [1.00, 253, 231,  37],
  ]),

  /** 经典彩虹，蓝→青→绿→黄→红 */
  jet: buildLUT([
    [0.00,   0,   0, 127],
    [0.10,   0,   0, 255],
    [0.35,   0, 255, 255],
    [0.50,   0, 255,   0],
    [0.65, 255, 255,   0],
    [0.90, 255,   0,   0],
    [1.00, 127,   0,   0],
  ]),
};

export type ColormapName = keyof typeof COLORMAPS;
