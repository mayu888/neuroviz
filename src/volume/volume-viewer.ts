import { VolumeData, PathOrFile } from "../types/index.js";
import { niftiFileRead, niftiFileReadFromBuffer } from "../loaders/nifti-loader.js";
import { SliceRenderer, SliceAxis, SliceRendererOptions } from "./slice-renderer.js";
import { ColormapName, LUT } from "./colormaps.js";
import { EventEmitter } from "../core/event-emitter.js";

export type VolumeViewerOptions = SliceRendererOptions;

export type VoxelPosition = { xspace: number; yspace: number; zspace: number };

/**
 * Manages three SliceRenderers (axial/coronal/sagittal) for a NIfTI volume.
 *
 * Usage:
 *   const viewer = new VolumeViewer(axialCanvas, coronalCanvas, sagittalCanvas);
 *   await viewer.load('./brain.nii.gz');
 */
export class VolumeViewer extends EventEmitter {
  private renderers: Record<SliceAxis, SliceRenderer>;
  private volume: VolumeData | null = null;
  private position: VoxelPosition = { xspace: 0, yspace: 0, zspace: 0 };
  private abortController = new AbortController();

  constructor(
    axialCanvas: HTMLCanvasElement,
    coronalCanvas: HTMLCanvasElement,
    sagittalCanvas: HTMLCanvasElement,
    options: VolumeViewerOptions = {},
  ) {
    super();
    this.renderers = {
      zspace: new SliceRenderer(axialCanvas,   "zspace", options),
      yspace: new SliceRenderer(coronalCanvas, "yspace", options),
      xspace: new SliceRenderer(sagittalCanvas,"xspace", options),
    };

    const signal = this.abortController.signal;
    for (const axis of Object.keys(this.renderers) as SliceAxis[]) {
      this.renderers[axis].canvas.addEventListener("click", (e) => {
        this.handleCanvasClick(axis, e);
      }, { signal });
    }
  }

  // ── Public API ──────────────────────────────────────────────────────
  async load(option: PathOrFile): Promise<void> {
    if(option.file){
      this.volume = niftiFileReadFromBuffer(option.file);
    }else{
      this.volume = await niftiFileRead(option.url);
    }
    this.initFromVolume();
  }

  dispose(): void {
    this.abortController.abort();
    this.volume = null;
  }

  setPosition(pos: Partial<VoxelPosition>): void {
    if (!this.volume) return;
    const hdr = this.volume.header;

    if (pos.xspace !== undefined)
      this.position.xspace = clamp(pos.xspace, 0, hdr.xspace.space_length - 1);
    if (pos.yspace !== undefined)
      this.position.yspace = clamp(pos.yspace, 0, hdr.yspace.space_length - 1);
    if (pos.zspace !== undefined)
      this.position.zspace = clamp(pos.zspace, 0, hdr.zspace.space_length - 1);

    this.renderers.xspace.setSlice(this.position.xspace);
    this.renderers.yspace.setSlice(this.position.yspace);
    this.renderers.zspace.setSlice(this.position.zspace);

    this.syncCursors();
    this.emit("positionchange", { ...this.position });
  }

  getPosition(): VoxelPosition {
    return { ...this.position };
  }

  /** Returns mm world coordinate for the current voxel position. */
  getWorldPosition(): { x: number; y: number; z: number } | null {
    if (!this.volume) return null;
    const hdr = this.volume.header;
    return {
      x: hdr.xspace.start + this.position.xspace * hdr.xspace.step,
      y: hdr.yspace.start + this.position.yspace * hdr.yspace.step,
      z: hdr.zspace.start + this.position.zspace * hdr.zspace.step,
    };
  }

  /** Returns the voxel value at the current position. */
  getVoxelValue(): number | null {
    if (!this.volume) return null;
    const hdr = this.volume.header;
    const { xspace, yspace, zspace } = this.position;
    const idx =
      xspace * hdr.xspace.offset +
      yspace * hdr.yspace.offset +
      zspace * hdr.zspace.offset;
    return this.volume.data[idx] ?? null;
  }

  setShowCursor(show: boolean): void {
    for (const r of Object.values(this.renderers)) r.setShowCursor(show);
  }

  setWindowLevel(level: number, width: number): void {
    for (const r of Object.values(this.renderers)) r.setWindowLevel(level, width);
  }

  getWindowLevel(): { level: number; width: number } {
    return this.renderers.zspace.getWindowLevel();
  }

  setColormap(colormap: ColormapName | LUT): void {
    for (const r of Object.values(this.renderers)) r.setColormap(colormap);
  }

  getVolume(): VolumeData | null {
    return this.volume;
  }

  // ── Private ─────────────────────────────────────────────────────────

  private handleCanvasClick(axis: SliceAxis, e: MouseEvent): void {
    const renderer = this.renderers[axis];
    const rect = renderer.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    // Scale from CSS pixels to canvas pixels
    const scaleX = renderer.canvas.width / rect.width;
    const scaleY = renderer.canvas.height / rect.height;
    const voxel = renderer.canvasToVoxel(px * scaleX, py * scaleY);
    if (!voxel) return;
    this.setPosition(voxel);
  }

  private syncCursors(): void {
    // xspace (sagittal) canvas x=yspace, y=zspace
    this.renderers.xspace.setCursor(this.position.yspace, this.position.zspace);
    // yspace (coronal) canvas x=xspace, y=zspace
    this.renderers.yspace.setCursor(this.position.xspace, this.position.zspace);
    // zspace (axial) canvas x=xspace, y=yspace
    this.renderers.zspace.setCursor(this.position.xspace, this.position.yspace);
  }

  private initFromVolume(): void {
    const hdr = this.volume!.header;
    this.position = {
      xspace: Math.floor(hdr.xspace.space_length / 2),
      yspace: Math.floor(hdr.yspace.space_length / 2),
      zspace: Math.floor(hdr.zspace.space_length / 2),
    };
    for (const axis of Object.keys(this.renderers) as SliceAxis[]) {
      this.renderers[axis].setVolume(this.volume!);
    }
    this.syncCursors();
    this.emit("load", this.volume);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
