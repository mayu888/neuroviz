import { VolumeData, AxisName } from "../types/index.js";
import { LUT, ColormapName, COLORMAPS } from "./colormaps.js";

export type SliceAxis = "xspace" | "yspace" | "zspace";

export type SliceRendererOptions = {
  highlightColor?: string;  // cursor crosshair color, default "#ff0000"
  backgroundColor?: string; // canvas background, default "#000000"
};

/**
 * Renders a single 2D slice of a NIfTI volume onto a <canvas> element.
 * Supports axial (zspace), coronal (yspace), and sagittal (xspace) views.
 */
export class SliceRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private volume: VolumeData | null = null;
  private axis: SliceAxis;
  private sliceIndex: number = 0;
  private cursorX: number = 0;
  private cursorY: number = 0;
  private showCursor: boolean = true;
  private highlightColor: string;
  private backgroundColor: string;
  private windowLevel: number = 0;
  private windowWidth: number = 1;
  private lut: LUT = COLORMAPS.gray;

  // Axis layout: for each slice axis, which two axes map to canvas x/y
  // canvas x → "column axis", canvas y → "row axis"
  private static readonly LAYOUT: Record<SliceAxis, { col: AxisName; row: AxisName }> = {
    xspace: { col: "yspace", row: "zspace" },
    yspace: { col: "xspace", row: "zspace" },
    zspace: { col: "xspace", row: "yspace" },
  };

  constructor(canvas: HTMLCanvasElement, axis: SliceAxis, options: SliceRendererOptions = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Cannot get 2D context from canvas.");
    this.ctx = ctx;
    this.axis = axis;
    this.highlightColor = options.highlightColor ?? "#ff0000";
    this.backgroundColor = options.backgroundColor ?? "#000000";
  }

  setVolume(volume: VolumeData): void {
    this.volume = volume;
    const { col, row } = SliceRenderer.LAYOUT[this.axis];
    this.sliceIndex = Math.floor(volume.header[this.axis].space_length / 2);
    this.cursorX = Math.floor(volume.header[col].space_length / 2);
    this.cursorY = Math.floor(volume.header[row].space_length / 2);
    this.windowLevel = (volume.min + volume.max) / 2;
    this.windowWidth = volume.max - volume.min || 1;
    // canvas 内部分辨率 = 体素数量，只需设置一次
    this.canvas.width  = volume.header[col].space_length;
    this.canvas.height = volume.header[row].space_length;
    // CSS 宽高比按物理尺寸（mm）计算，保证各向异性体素时不变形
    const physW = volume.header[col].space_length * Math.abs(volume.header[col].step);
    const physH = volume.header[row].space_length * Math.abs(volume.header[row].step);
    this.canvas.style.aspectRatio = `${physW} / ${physH}`;
    this.draw();
  }

  setWindowLevel(level: number, width: number): void {
    this.windowLevel = level;
    this.windowWidth = Math.max(1, width);
    this.draw();
  }

  getWindowLevel(): { level: number; width: number } {
    return { level: this.windowLevel, width: this.windowWidth };
  }

  setColormap(colormap: ColormapName | LUT): void {
    this.lut = typeof colormap === "string" ? COLORMAPS[colormap] : colormap;
    this.draw();
  }

  setSlice(index: number): void {
    if (!this.volume) return;
    const max = this.volume.header[this.axis].space_length - 1;
    this.sliceIndex = Math.max(0, Math.min(index, max));
    this.draw();
  }

  getSlice(): number {
    return this.sliceIndex;
  }

  setCursor(x: number, y: number): void {
    this.cursorX = x;
    this.cursorY = y;
    this.draw();
  }

  getCursor(): { x: number; y: number } {
    return { x: this.cursorX, y: this.cursorY };
  }

  setShowCursor(show: boolean): void {
    this.showCursor = show;
    this.draw();
  }

  getAxis(): SliceAxis {
    return this.axis;
  }

  /**
   * Given a canvas pixel coordinate (px, py), return the voxel index
   * along each axis in [xspace, yspace, zspace] order.
   */
  canvasToVoxel(px: number, py: number): { xspace: number; yspace: number; zspace: number } | null {
    if (!this.volume) return null;
    const { col, row } = SliceRenderer.LAYOUT[this.axis];
    const colLen = this.volume.header[col].space_length;
    const rowLen = this.volume.header[row].space_length;
    const scaleX = this.canvas.width / colLen;
    const scaleY = this.canvas.height / rowLen;
    const colIdx = Math.floor(px / scaleX);
    const rowIdx = Math.floor(py / scaleY);
    const result = { xspace: 0, yspace: 0, zspace: 0 };
    result[this.axis] = this.sliceIndex;
    result[col] = Math.max(0, Math.min(colIdx, colLen - 1));
    result[row] = Math.max(0, Math.min(rowIdx, rowLen - 1));
    return result;
  }

  draw(): void {
    if (!this.volume) {
      this.clear();
      return;
    }
    const { col, row } = SliceRenderer.LAYOUT[this.axis];
    const header = this.volume.header;
    const colLen = header[col].space_length;
    const rowLen = header[row].space_length;

    const imageData = this.ctx.createImageData(colLen, rowLen);
    const pixels = imageData.data;

    const lower = this.windowLevel - this.windowWidth / 2;
    const upper = this.windowLevel + this.windowWidth / 2;

    const sliceOff = header[this.axis].offset * this.sliceIndex;

    for (let r = 0; r < rowLen; r++) {
      for (let c = 0; c < colLen; c++) {
        const voxIdx = sliceOff + header[row].offset * r + header[col].offset * c;
        const raw = this.volume.data[voxIdx] ?? 0;
        const normalized = Math.max(0, Math.min(1, (raw - lower) / (upper - lower)));
        const lutIdx = Math.round(normalized * 255) * 3;
        const pixIdx = (r * colLen + c) * 4;
        pixels[pixIdx]     = this.lut[lutIdx];
        pixels[pixIdx + 1] = this.lut[lutIdx + 1];
        pixels[pixIdx + 2] = this.lut[lutIdx + 2];
        pixels[pixIdx + 3] = 255;
      }
    }

    this.ctx.putImageData(imageData, 0, 0);

    if (this.showCursor) {
      this.drawCursor(colLen, rowLen);
    }
  }

  private clear(): void {
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawCursor(colLen: number, rowLen: number): void {
    const cx = (this.cursorX + 0.5) * (this.canvas.width / colLen);
    const cy = (this.cursorY + 0.5) * (this.canvas.height / rowLen);

    this.ctx.save();
    this.ctx.strokeStyle = this.highlightColor;
    this.ctx.lineWidth = 1;
    this.ctx.globalAlpha = 0.8;

    // vertical line
    this.ctx.beginPath();
    this.ctx.moveTo(cx, 0);
    this.ctx.lineTo(cx, this.canvas.height);
    this.ctx.stroke();

    // horizontal line
    this.ctx.beginPath();
    this.ctx.moveTo(0, cy);
    this.ctx.lineTo(this.canvas.width, cy);
    this.ctx.stroke();

    this.ctx.restore();
  }
}
