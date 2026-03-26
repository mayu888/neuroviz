# neuroviz

**[English](#english) | [中文](#中文)**

---

<a name="english"></a>

# neuroviz — Brain Imaging Visualization Library

A WebGL-based brain imaging visualization library built on Three.js. Supports 3D surface rendering (GIfTI, FreeSurfer, MNI OBJ) and 2D volume slice viewing (NIfTI), with overlay color mapping, vertex annotations, and interactive controls.

## Features

- **3D Surface Viewer** — Render brain surfaces from GIfTI, FreeSurfer, and MNI OBJ formats
- **2D Volume Viewer** — Axial / Coronal / Sagittal slice views for NIfTI volumes
- **Overlay Support** — Apply functional data over surfaces with custom color maps
- **Annotations** — Place and manage 3D sphere markers on surface vertices
- **Interactive Controls** — Rotate, pan, zoom via mouse; click to pick vertices
- **Multi-model** — Load and independently control multiple surface models simultaneously
- **Coordinate Conversion** — Surface ↔ volume coordinate transform via tkRas matrix
- **Built-in Colormaps** — gray, hot, cool, viridis, jet; custom LUT supported
- **Event System** — React to load, vertex click, and position change events
- **TypeScript** — Full type definitions included

## Installation

```bash
npm install neuroviz
```

> **Note:** Three.js r154 is bundled inside the package. No additional peer dependencies are required.

## Quick Start

### Surface Viewer

```html
<div id="viewer" style="width: 800px; height: 600px;"></div>
```

```typescript
import { SurfaceViewer } from 'neuroviz';

const viewer = new SurfaceViewer(document.getElementById('viewer'));

const { handle, annotations } = await viewer.load({
  model: { url: '/models/lh.pial.gii', name: 'lh' },
  overlay:  { url: '/data/lh.activation.txt.gz' },
  colorMap: { url: '/colormaps/hot.txt' },
});

viewer.setView('lateral');
```

### Volume Viewer

```html
<canvas id="axial"></canvas>
<canvas id="coronal"></canvas>
<canvas id="sagittal"></canvas>
```

```typescript
import { VolumeViewer } from 'neuroviz';

const viewer = new VolumeViewer(
  document.getElementById('axial')    as HTMLCanvasElement,
  document.getElementById('coronal')  as HTMLCanvasElement,
  document.getElementById('sagittal') as HTMLCanvasElement,
);

await viewer.load({ url: '/volumes/brain.nii.gz' });

viewer.on('positionchange', (pos) => {
  console.log(`Voxel: x=${pos.xspace} y=${pos.yspace} z=${pos.zspace}`);
  console.log('Value:', viewer.getVoxelValue());
});
```

---

## API Reference

### `SurfaceViewer`

The main class for 3D brain surface rendering. Extends `EventEmitter`.

```typescript
const viewer = new SurfaceViewer(container: HTMLElement);
```

#### Loading

```typescript
// Load a single model
const result: LoadResult = await viewer.load(option: LoadOption);

// Load multiple models simultaneously
const results: LoadResult[] = await viewer.loads(options: LoadOption[]);
```

**`LoadOption`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | `PathOrFile & { name: string }` | ✓ | Surface model file |
| `overlay` | `PathOrFile` | — | Functional overlay data |
| `colorMap` | `PathOrFile` | — | Color map table |
| `tkRas` | `PathOrFile` | — | Surface-to-volume coordinate transform |
| `range` | `{ min: number; max: number }` | — | Overlay value range for color mapping |

`PathOrFile` is a discriminated union — supply either a URL or a file buffer, not both:

```typescript
// From URL
{ url: '/path/to/file.gii' }

// From ArrayBuffer (e.g. file input)
{ file: arrayBuffer }
```

**`LoadResult`**

| Field | Type | Description |
|-------|------|-------------|
| `handle` | `ModelHandle` | Per-model control handle |
| `annotations` | `AnnotationManager` | Annotation manager for this model |
| `tkRas` | `TkRas \| undefined` | Loaded coordinate transform (if provided) |

#### View Control

```typescript
// Set a preset view angle
viewer.setView(view: ViewName): void
```

| `ViewName` | Description |
|------------|-------------|
| `"lateral"` | Outer side (left hemisphere faces left) |
| `"medial"` | Inner side |
| `"superior"` | Top-down view (default orientation) |
| `"inferior"` | Bottom-up view |
| `"anterior"` | Front view |
| `"posterior"` | Rear view |

```typescript
viewer.resetView(): void                                       // Reset to default
viewer.setCameraPosition(x: number, y: number, z: number): void
viewer.getCameraPosition(): { x: number; y: number; z: number }
```

#### Appearance

```typescript
// Transparency for all models (0 = invisible, 1 = opaque)
viewer.setTransparency(alpha: number): void

// Wireframe mode
viewer.setWireframe(enabled: boolean): void

// Background color (hex number, e.g. 0x000000)
viewer.setClearColor(color: number, alpha?: number): void

// Update overlay colors for a loaded model
await viewer.updateColors(options: UpdateColorsOptions): Promise<void>
```

**`UpdateColorsOptions`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `overlay` | `PathOrFile` | ✓ | New overlay data |
| `colorMap` | `PathOrFile` | ✓ | New color map |
| `threshold` | `{ min: number; max: number }` | — | Mask values outside this range |
| `range` | `{ min: number; max: number }` | — | Value range for color mapping |
| `name` | `string` | — | Target model name (defaults to first loaded) |

#### Model Management

```typescript
viewer.removeModel(modelName: string): void

viewer.clear(): void  // Remove all models and reset the scene

// Switch mouse interaction target:
// 'group'      → all models rotate/pan/zoom together (default)
// ModelHandle  → only that model is affected
viewer.setInteractionTarget(target: 'group' | ModelHandle): void
```

#### Utilities

```typescript
// Export the current view as a PNG data URL
viewer.canvasDataURL(): string

// Get vertex data from the last click
viewer.getVertexData(): VertexData | null

// Release all WebGL and event resources
viewer.dispose(): void
```

#### Events

```typescript
viewer.on('load', (result: LoadResult) => { ... });
viewer.on('vertexClick', (data: VertexData) => { ... });
viewer.on('updateColors', (data: { overlayData: Float32Array; colorMapData: ColorMap }) => { ... });
```

**`VertexData`** fields:

| Field | Description |
|-------|-------------|
| `index` | Vertex index in the mesh |
| `point` | 3D world position (`THREE.Vector3`) |
| `volCoord` | Volume voxel coordinates — only available when `tkRas` was loaded |

---

### `ModelHandle`

Returned by `viewer.load()`. Controls a single model independently of others.

```typescript
handle.setPosition(x: number, y: number, z: number): void
handle.setRotation(x: number, y: number, z: number): void  // radians
handle.setScale(s: number): void
handle.setTransparency(alpha: number): void  // 0–1
handle.setVisible(visible: boolean): void

// Get 3D world position of a vertex by its index
handle.getPositionByIndex(index: number): { x: number; y: number; z: number } | null

// Find the vertex index nearest to a given 3D point
// Uses an O(1) spatial index first; falls back to O(n) linear scan with epsilon tolerance
handle.getIndexByPosition(
  point: { x: number; y: number; z: number },
  epsilon?: number
): number
```

---

### `AnnotationManager`

Returned by `viewer.load()`. Places and manages 3D sphere markers on surface vertices.

```typescript
// Add a marker at a vertex index
annotations.add(vertex: number, options?: AddAnnotationOption): Annotation | null

// Retrieve a marker by vertex index
annotations.get(vertex: number): Annotation | undefined

// Remove a marker by vertex index
annotations.remove(vertex: number): Annotation | undefined

// Remove all markers
annotations.reset(): void

// Highlight a specific marker (sets its color to activeColor)
annotations.activate(vertex: number): void

// Iterate all annotations
annotations.forEach(callback: (annotation: Annotation) => void): void

// Appearance customization
annotations.setMarkerRadius(radius: number): void   // default: 0.5
annotations.setDefaultColor(color: number): void    // default: 0xff0000 (red)
annotations.setActiveColor(color: number): void     // default: 0x00ff00 (green)
```

**`AddAnnotationOption`**

| Field | Type | Description |
|-------|------|-------------|
| `color` | `number` | Hex color (e.g. `0x0000ff`) |
| `name` | `string` | Marker label |
| `data` | `Record<string, unknown>` | Arbitrary metadata |

**`Annotation`** object

| Field | Type | Description |
|-------|------|-------------|
| `vertex` | `number` | Vertex index |
| `position` | `THREE.Vector3` | 3D world position |
| `name` | `string` | Marker label |
| `color` | `number` | Color (hex) |
| `data` | `Record<string, unknown>` | Custom metadata |
| `marker` | `THREE.Mesh` | Underlying Three.js sphere mesh |

#### Example

```typescript
viewer.on('vertexClick', ({ index }) => {
  annotations.add(index, {
    color: 0x0099ff,
    name: `ROI-${index}`,
    data: { region: 'prefrontal cortex' },
  });
});

// Export all annotation positions
annotations.forEach((a) => {
  console.log(a.name, a.position.toArray(), a.data);
});
```

---

### `VolumeViewer`

Manages three `SliceRenderer` instances (axial / coronal / sagittal) for NIfTI volumes. Extends `EventEmitter`.

```typescript
const viewer = new VolumeViewer(
  axialCanvas:    HTMLCanvasElement,
  coronalCanvas:  HTMLCanvasElement,
  sagittalCanvas: HTMLCanvasElement,
  options?: VolumeViewerOptions,
);
```

**`VolumeViewerOptions`**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `highlightColor` | `string` | `"#ff0000"` | Crosshair cursor color |
| `backgroundColor` | `string` | `"#000000"` | Canvas background color |

#### Loading

```typescript
// Load from URL
await viewer.load({ url: '/brain.nii.gz' });

// Load from ArrayBuffer (e.g. drag-and-drop or file input)
const buffer = await file.arrayBuffer();
await viewer.load({ file: buffer });
```

#### Navigation

```typescript
// Set slice position (voxel indices, clamped to valid range)
viewer.setPosition({ xspace: 90, yspace: 108, zspace: 90 }): void

// Partial update — only update one axis
viewer.setPosition({ zspace: 50 }): void

viewer.getPosition(): VoxelPosition
// → { xspace: number; yspace: number; zspace: number }

// World coordinate in mm
viewer.getWorldPosition(): { x: number; y: number; z: number } | null

// Intensity value at the current voxel position
viewer.getVoxelValue(): number | null
```

> **Tip:** Clicking any canvas automatically updates the position across all three slice views.

#### Display

```typescript
viewer.setWindowLevel(level: number, width: number): void
viewer.getWindowLevel(): { level: number; width: number }

viewer.setColormap(colormap: ColormapName | LUT): void
viewer.setShowCursor(show: boolean): void

viewer.getVolume(): VolumeData | null  // Access raw header and typed array data

viewer.dispose(): void
```

#### Events

```typescript
viewer.on('load', (volume: VolumeData) => { ... });
viewer.on('positionchange', (pos: VoxelPosition) => { ... });
```

---

### `SliceRenderer`

Low-level single-axis 2D slice renderer. Can be used independently for custom layouts.

```typescript
const renderer = new SliceRenderer(
  canvas:  HTMLCanvasElement,
  axis:    SliceAxis,           // "xspace" | "yspace" | "zspace"
  options?: SliceRendererOptions,
);
```

```typescript
renderer.setVolume(volume: VolumeData): void
renderer.setSlice(index: number): void
renderer.getSlice(): number
renderer.setWindowLevel(level: number, width: number): void
renderer.getWindowLevel(): { level: number; width: number }
renderer.setColormap(colormap: ColormapName | LUT): void
renderer.setCursor(x: number, y: number): void
renderer.getCursor(): { x: number; y: number }
renderer.setShowCursor(show: boolean): void
renderer.getAxis(): SliceAxis
renderer.draw(): void  // force a redraw

// Convert canvas pixel coordinates (CSS pixels) to voxel indices
renderer.canvasToVoxel(px: number, py: number): VoxelPosition | null

renderer.canvas: HTMLCanvasElement  // read-only
```

---

### Colormaps

Five built-in colormaps for the Volume Viewer:

| Name | Gradient | Typical Use |
|------|----------|-------------|
| `gray` | Black → White | Anatomical MRI (default) |
| `hot` | Black → Red → Yellow → White | Activation maps |
| `cool` | Cyan → Magenta | Statistical contrasts |
| `viridis` | Purple → Blue → Green → Yellow | Perceptually uniform; publication figures |
| `jet` | Blue → Cyan → Green → Yellow → Red | Classic rainbow |

```typescript
import { COLORMAPS } from 'neuroviz';

viewer.setColormap('viridis');

// Custom LUT: Uint8Array of length 768 (256 × [r, g, b])
const lut = new Uint8Array(256 * 3);
// fill lut[i*3], lut[i*3+1], lut[i*3+2] for index i = 0..255
viewer.setColormap(lut);
```

---

### Standalone Loaders

All loader functions can be used without a viewer instance:

```typescript
import {
  niftiFileRead,
  niftiFileReadFromBuffer,
  freeSurferCurvFileRead,
  loadCurv,
} from 'neuroviz';

// Parse NIfTI from URL (async)
const volume: VolumeData = await niftiFileRead('/brain.nii.gz');

// Parse NIfTI from ArrayBuffer (synchronous)
const volume: VolumeData = niftiFileReadFromBuffer(buffer);

// Load FreeSurfer curvature from URL
const curv: Float32Array = await freeSurferCurvFileRead('/lh.curv');

// Load curvature via surface-loader
const curv: Float32Array = await loadCurv('/lh.curv');
```

---

### Worker Base URL

Surface model parsing (GIfTI, FreeSurfer, MNI OBJ, overlay) runs in Web Workers. By default the worker files are resolved relative to the main bundle. If you serve them from a different location (e.g. a CDN), set the base URL **before** loading any surface models:

```typescript
import { setWorkerBaseUrl } from 'neuroviz';

setWorkerBaseUrl('https://cdn.example.com/brain-workers/');
```

Worker files that must be accessible: `gifti.worker.js`, `mni-obj.worker.js`, `freesurfer.worker.js`, `overlay.worker.js`.

---

### `EventEmitter`

Both `SurfaceViewer` and `VolumeViewer` extend `EventEmitter`:

```typescript
viewer.on('event', handler)    // add listener; returns viewer (chainable)
viewer.off('event', handler)   // remove listener
viewer.once('event', handler)  // listen once, then auto-remove
```

---

## Supported File Formats

### Surface Models

| Format | Extension | Notes |
|--------|-----------|-------|
| GIfTI | `.gii`, `.gii.gz` | Parsed via `gifti-reader-js`; gzip decompressed automatically |
| MNI OBJ | `.obj`, `.obj.gz` | MNI surface OBJ — **not** standard Wavefront OBJ |
| FreeSurfer | *(no fixed extension)* | Magic number `0xFF 0xFF 0xFE` auto-detected |

### Overlay Data

Plain text — one floating-point value per line, count must match vertex count. Gzip supported:

```
0.123
-0.456
0.789
```

### Color Map Table

Tab- or space-separated RGBA rows (values 0–255):

```
0   0   0   255
255 0   0   255
255 255 0   255
255 255 255 255
```

### tkRas Transform (JSON)

Two 4×4 matrices for surface ↔ volume coordinate conversion:

```json
{
  "vox2ras":       [[...], [...], [...], [...]],
  "vox2ras_tkr_inv": [[...], [...], [...], [...]]
}
```

### Volume Data

| Format | Extension | Notes |
|--------|-----------|-------|
| NIfTI-1 / NIfTI-2 | `.nii`, `.nii.gz` | All standard NIfTI datatypes supported |

---

## TypeScript Types

```typescript
import type {
  // Shared
  PathOrFile,
  ModelData,
  ColorMap,
  TkRas,
  Coordinate,

  // Volume
  VolumeData,
  VolumeHeader,
  VoxelData,
  AxisInfo,
  AxisName,

  // Surface viewer
  LoadOption,
  LoadResult,
  UpdateColorsOptions,
  ViewName,
  ModelHandle,

  // Annotations
  Annotation,
  AnnotationData,

  // Volume viewer
  VolumeViewerOptions,
  VoxelPosition,

  // Slice renderer
  SliceAxis,
  SliceRendererOptions,

  // Colormaps
  LUT,
  ColormapName,
} from 'neuroviz';
```

---

## License

MIT

---
---

<a name="中文"></a>

# neuroviz — 大脑影像可视化库

基于 Three.js 的 WebGL 大脑影像可视化库。支持三维表面渲染（GIfTI、FreeSurfer、MNI OBJ）和二维体积切片查看（NIfTI），提供 Overlay 颜色映射、顶点标记点管理和交互控制。

## 功能特性

- **三维表面查看器** — 渲染 GIfTI、FreeSurfer、MNI OBJ 格式的大脑皮层表面
- **二维体积查看器** — NIfTI 体积的轴向 / 冠状 / 矢状切片视图
- **Overlay 支持** — 将功能数据叠加在表面上，配合自定义颜色映射表显示
- **标记点管理** — 在表面顶点上放置和管理三维球形标记
- **交互控制** — 鼠标拖拽旋转/平移/缩放，点击拾取顶点
- **多模型加载** — 同时加载并独立控制多个表面模型
- **坐标转换** — 通过 tkRas 矩阵实现表面坐标 ↔ 体积坐标转换
- **内置颜色映射** — gray、hot、cool、viridis、jet；支持自定义 LUT
- **事件系统** — 响应加载完成、顶点点击、位置变化等事件
- **TypeScript** — 包含完整类型定义

## 安装

```bash
npm install neuroviz
```

> **注意：** Three.js r154 已打包在库内，无需额外安装任何依赖。

## 快速开始

### 表面查看器

```html
<div id="viewer" style="width: 800px; height: 600px;"></div>
```

```typescript
import { SurfaceViewer } from 'neuroviz';

const viewer = new SurfaceViewer(document.getElementById('viewer'));

const { handle, annotations } = await viewer.load({
  model:    { url: '/models/lh.pial.gii', name: 'lh' },
  overlay:  { url: '/data/lh.activation.txt.gz' },
  colorMap: { url: '/colormaps/hot.txt' },
});

viewer.setView('lateral');
```

### 体积查看器

```html
<canvas id="axial"></canvas>
<canvas id="coronal"></canvas>
<canvas id="sagittal"></canvas>
```

```typescript
import { VolumeViewer } from 'neuroviz';

const viewer = new VolumeViewer(
  document.getElementById('axial')    as HTMLCanvasElement,
  document.getElementById('coronal')  as HTMLCanvasElement,
  document.getElementById('sagittal') as HTMLCanvasElement,
);

await viewer.load({ url: '/volumes/brain.nii.gz' });

viewer.on('positionchange', (pos) => {
  console.log(`体素坐标：x=${pos.xspace} y=${pos.yspace} z=${pos.zspace}`);
  console.log('当前值：', viewer.getVoxelValue());
});
```

---

## API 参考

### `SurfaceViewer`

三维大脑表面渲染主类，继承 `EventEmitter`。

```typescript
const viewer = new SurfaceViewer(container: HTMLElement);
```

#### 加载模型

```typescript
// 加载单个模型
const result: LoadResult = await viewer.load(option: LoadOption);

// 批量加载多个模型
const results: LoadResult[] = await viewer.loads(options: LoadOption[]);
```

**`LoadOption` 参数**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | `PathOrFile & { name: string }` | ✓ | 表面模型文件 |
| `overlay` | `PathOrFile` | — | 功能 Overlay 数据 |
| `colorMap` | `PathOrFile` | — | 颜色映射表文件 |
| `tkRas` | `PathOrFile` | — | 表面→体积坐标变换矩阵 |
| `range` | `{ min: number; max: number }` | — | Overlay 颜色映射的数值范围 |

`PathOrFile` 是判别联合类型——提供 URL 或文件缓冲区之一，不能同时提供：

```typescript
// 通过 URL 加载
{ url: '/path/to/file.gii' }

// 通过 ArrayBuffer 加载（如文件选择器）
{ file: arrayBuffer }
```

**`LoadResult` 返回值**

| 字段 | 类型 | 说明 |
|------|------|------|
| `handle` | `ModelHandle` | 单个模型的控制句柄 |
| `annotations` | `AnnotationManager` | 该模型的标记点管理器 |
| `tkRas` | `TkRas \| undefined` | 已加载的坐标变换矩阵（如有） |

#### 视角控制

```typescript
viewer.setView(view: ViewName): void
```

| `ViewName` 值 | 说明 |
|--------------|------|
| `"lateral"` | 外侧面 |
| `"medial"` | 内侧面 |
| `"superior"` | 顶视图（默认朝向） |
| `"inferior"` | 底视图 |
| `"anterior"` | 前视图 |
| `"posterior"` | 后视图 |

```typescript
viewer.resetView(): void                                        // 重置为初始视角
viewer.setCameraPosition(x: number, y: number, z: number): void
viewer.getCameraPosition(): { x: number; y: number; z: number }
```

#### 外观设置

```typescript
// 设置所有模型的透明度（0 = 完全透明，1 = 不透明）
viewer.setTransparency(alpha: number): void

// 切换线框模式
viewer.setWireframe(enabled: boolean): void

// 设置 canvas 背景颜色（十六进制数值，如 0x000000）
viewer.setClearColor(color: number, alpha?: number): void

// 更新 Overlay 颜色映射
await viewer.updateColors(options: UpdateColorsOptions): Promise<void>
```

**`UpdateColorsOptions` 参数**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `overlay` | `PathOrFile` | ✓ | 新的 Overlay 数据 |
| `colorMap` | `PathOrFile` | ✓ | 新的颜色映射表 |
| `threshold` | `{ min: number; max: number }` | — | 遮罩：范围外的值不显示颜色 |
| `range` | `{ min: number; max: number }` | — | 颜色映射的数值范围 |
| `name` | `string` | — | 目标模型名（默认为第一个加载的模型） |

#### 模型管理

```typescript
// 按名称移除模型
viewer.removeModel(modelName: string): void

// 清除所有模型并重置场景
viewer.clear(): void

// 切换鼠标交互目标
// 'group'     → 所有模型一起旋转/平移/缩放（默认）
// ModelHandle → 仅作用于该模型
viewer.setInteractionTarget(target: 'group' | ModelHandle): void
```

#### 工具方法

```typescript
// 将当前视图导出为 PNG 格式的 Data URL
viewer.canvasDataURL(): string

// 获取最近一次点击命中的顶点数据
viewer.getVertexData(): VertexData | null

// 释放所有 WebGL 及事件资源
viewer.dispose(): void
```

#### 事件

```typescript
// 模型加载完成
viewer.on('load', (result: LoadResult) => { ... });

// 顶点被点击
viewer.on('vertexClick', (data: VertexData) => { ... });

// 颜色更新完成
viewer.on('updateColors', (data: { overlayData: Float32Array; colorMapData: ColorMap }) => { ... });
```

**`VertexData`（顶点点击数据）**

| 字段 | 说明 |
|------|------|
| `index` | 网格中的顶点索引 |
| `point` | 三维世界坐标（`THREE.Vector3`） |
| `volCoord` | 体积体素坐标（仅当加载了 `tkRas` 时有值） |

---

### `ModelHandle`

由 `viewer.load()` 返回，用于独立控制单个模型。

```typescript
handle.setPosition(x: number, y: number, z: number): void
handle.setRotation(x: number, y: number, z: number): void  // 弧度
handle.setScale(s: number): void
handle.setTransparency(alpha: number): void  // 0–1
handle.setVisible(visible: boolean): void

// 通过顶点索引获取三维坐标
handle.getPositionByIndex(index: number): { x: number; y: number; z: number } | null

// 查找离给定三维坐标最近的顶点索引
// 优先使用 O(1) 空间索引；无精确匹配时退化为带 epsilon 容差的 O(n) 全量搜索
handle.getIndexByPosition(
  point: { x: number; y: number; z: number },
  epsilon?: number
): number
```

---

### `AnnotationManager`

由 `viewer.load()` 返回，在表面顶点上放置和管理三维球形标记点。

```typescript
// 在指定顶点索引处添加标记
annotations.add(vertex: number, options?: AddAnnotationOption): Annotation | null

// 通过顶点索引获取标记
annotations.get(vertex: number): Annotation | undefined

// 通过顶点索引移除标记
annotations.remove(vertex: number): Annotation | undefined

// 移除所有标记
annotations.reset(): void

// 激活（高亮）指定标记，其颜色切换为 activeColor
annotations.activate(vertex: number): void

// 遍历所有标记
annotations.forEach(callback: (annotation: Annotation) => void): void

// 自定义外观
annotations.setMarkerRadius(radius: number): void   // 默认：0.5
annotations.setDefaultColor(color: number): void    // 默认：0xff0000（红色）
annotations.setActiveColor(color: number): void     // 默认：0x00ff00（绿色）
```

**`AddAnnotationOption` 参数**

| 字段 | 类型 | 说明 |
|------|------|------|
| `color` | `number` | 十六进制颜色（如 `0x0000ff`） |
| `name` | `string` | 标记名称 |
| `data` | `Record<string, unknown>` | 任意自定义元数据 |

**`Annotation` 对象字段**

| 字段 | 类型 | 说明 |
|------|------|------|
| `vertex` | `number` | 顶点索引 |
| `position` | `THREE.Vector3` | 三维世界坐标 |
| `name` | `string` | 标记名称 |
| `color` | `number` | 颜色（十六进制） |
| `data` | `Record<string, unknown>` | 自定义元数据 |
| `marker` | `THREE.Mesh` | 底层 Three.js 球体网格 |

#### 使用示例

```typescript
// 点击顶点时添加标记
viewer.on('vertexClick', ({ index }) => {
  annotations.add(index, {
    color: 0x0099ff,
    name: `ROI-${index}`,
    data: { region: '前额叶皮层' },
  });
});

// 导出所有标记的位置和元数据
annotations.forEach((a) => {
  console.log(a.name, a.position.toArray(), a.data);
});
```

---

### `VolumeViewer`

管理三个 `SliceRenderer`（轴向/冠状/矢状）以查看 NIfTI 体积数据，继承 `EventEmitter`。

```typescript
const viewer = new VolumeViewer(
  axialCanvas:    HTMLCanvasElement,  // 轴向切片（z 轴）
  coronalCanvas:  HTMLCanvasElement,  // 冠状切片（y 轴）
  sagittalCanvas: HTMLCanvasElement,  // 矢状切片（x 轴）
  options?: VolumeViewerOptions,
);
```

**`VolumeViewerOptions` 参数**

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `highlightColor` | `string` | `"#ff0000"` | 十字线光标颜色 |
| `backgroundColor` | `string` | `"#000000"` | Canvas 背景色 |

#### 加载文件

```typescript
// 从 URL 加载
await viewer.load({ url: '/brain.nii.gz' });

// 从 ArrayBuffer 加载（拖拽上传或文件选择器）
const buffer = await file.arrayBuffer();
await viewer.load({ file: buffer });
```

#### 导航定位

```typescript
// 设置切片位置（体素索引，自动截断到有效范围）
viewer.setPosition({ xspace: 90, yspace: 108, zspace: 90 }): void

// 仅更新单个轴
viewer.setPosition({ zspace: 50 }): void

viewer.getPosition(): VoxelPosition
// → { xspace: number; yspace: number; zspace: number }

// 获取世界坐标（毫米）
viewer.getWorldPosition(): { x: number; y: number; z: number } | null

// 获取当前体素位置的强度值
viewer.getVoxelValue(): number | null
```

> **提示：** 点击任意切片 canvas 会自动同步更新三个视图的位置。

#### 显示调节

```typescript
// 窗宽窗位（对比度）调整
viewer.setWindowLevel(level: number, width: number): void
viewer.getWindowLevel(): { level: number; width: number }

// 应用内置颜色映射或自定义 LUT
viewer.setColormap(colormap: ColormapName | LUT): void

// 显示/隐藏十字线光标
viewer.setShowCursor(show: boolean): void

// 获取原始体积数据（含 header 和 typed array）
viewer.getVolume(): VolumeData | null

// 释放资源
viewer.dispose(): void
```

#### 事件

```typescript
// 体积数据加载完成
viewer.on('load', (volume: VolumeData) => { ... });

// 切片位置改变（点击切片或调用 setPosition 时触发）
viewer.on('positionchange', (pos: VoxelPosition) => { ... });
```

---

### `SliceRenderer`

底层单轴二维切片渲染器，可独立使用，适合构建自定义布局。

```typescript
const renderer = new SliceRenderer(
  canvas:   HTMLCanvasElement,
  axis:     SliceAxis,    // "xspace"（矢状）| "yspace"（冠状）| "zspace"（轴向）
  options?: SliceRendererOptions,
);
```

```typescript
renderer.setVolume(volume: VolumeData): void        // 设置体积数据
renderer.setSlice(index: number): void              // 设置切片索引
renderer.getSlice(): number                         // 获取当前切片索引
renderer.setWindowLevel(level: number, width: number): void
renderer.getWindowLevel(): { level: number; width: number }
renderer.setColormap(colormap: ColormapName | LUT): void
renderer.setCursor(x: number, y: number): void      // 设置十字线位置（体素坐标）
renderer.getCursor(): { x: number; y: number }
renderer.setShowCursor(show: boolean): void
renderer.getAxis(): SliceAxis
renderer.draw(): void                               // 强制重绘

// 将 canvas 像素坐标（CSS 像素）转换为体素坐标
renderer.canvasToVoxel(px: number, py: number): VoxelPosition | null

renderer.canvas: HTMLCanvasElement  // 只读，访问底层 canvas 元素
```

---

### 颜色映射表

体积查看器提供五种内置颜色映射：

| 名称 | 色彩渐变 | 典型用途 |
|------|---------|---------|
| `gray` | 黑 → 白 | 解剖 MRI（默认） |
| `hot` | 黑 → 红 → 黄 → 白 | 激活图 |
| `cool` | 青 → 品红 | 统计对比 |
| `viridis` | 紫 → 蓝 → 绿 → 黄 | 感知均匀，适合论文发表 |
| `jet` | 蓝 → 青 → 绿 → 黄 → 红 | 经典彩虹色 |

```typescript
import { COLORMAPS } from 'neuroviz';

viewer.setColormap('viridis');

// 自定义 LUT：长度为 768（256 × [r, g, b]）的 Uint8Array
const lut = new Uint8Array(256 * 3);
// 填写 lut[i*3], lut[i*3+1], lut[i*3+2]，i 取 0..255
viewer.setColormap(lut);
```

---

### 独立加载函数

所有加载函数均可脱离查看器独立使用：

```typescript
import {
  niftiFileRead,
  niftiFileReadFromBuffer,
  freeSurferCurvFileRead,
  loadCurv,
} from 'neuroviz';

// 从 URL 解析 NIfTI（异步）
const volume: VolumeData = await niftiFileRead('/brain.nii.gz');

// 从 ArrayBuffer 解析 NIfTI（同步）
const volume: VolumeData = niftiFileReadFromBuffer(buffer);

// 从 URL 加载 FreeSurfer 曲率文件
const curv: Float32Array = await freeSurferCurvFileRead('/lh.curv');

// 从 URL 加载曲率文件（surface-loader 版本）
const curv: Float32Array = await loadCurv('/lh.curv');
```

---

### Worker 基础路径配置

表面模型的解析（GIfTI、FreeSurfer、MNI OBJ、Overlay）在 Web Worker 中执行。默认情况下 Worker 文件与主 bundle 位于同一目录。如果你从其他路径（如 CDN）提供这些文件，请在加载任何表面模型**之前**配置基础路径：

```typescript
import { setWorkerBaseUrl } from 'neuroviz';

setWorkerBaseUrl('https://cdn.example.com/brain-workers/');
```

需要可访问的 Worker 文件：`gifti.worker.js`、`mni-obj.worker.js`、`freesurfer.worker.js`、`overlay.worker.js`。

---

### `EventEmitter`

`SurfaceViewer` 和 `VolumeViewer` 均继承自 `EventEmitter`：

```typescript
viewer.on('事件名', handler)    // 添加监听器，返回 viewer（可链式调用）
viewer.off('事件名', handler)   // 移除监听器
viewer.once('事件名', handler)  // 只监听一次，触发后自动移除
```

---

## 支持的文件格式

### 表面模型

| 格式 | 扩展名 | 说明 |
|------|--------|------|
| GIfTI | `.gii`、`.gii.gz` | 由 `gifti-reader-js` 解析；自动 gzip 解压 |
| MNI OBJ | `.obj`、`.obj.gz` | MNI 表面 OBJ 格式，**非**标准 Wavefront OBJ |
| FreeSurfer | 无固定扩展名 | 通过魔数 `0xFF 0xFF 0xFE` 自动识别 |

### Overlay 数据

纯文本，每行一个浮点数，行数须与模型顶点数一致；支持 gzip 压缩：

```
0.123
-0.456
0.789
```

### 颜色映射表

制表符或空格分隔的 RGBA 行（数值范围 0–255）：

```
0   0   0   255
255 0   0   255
255 255 0   255
255 255 255 255
```

### tkRas 坐标变换（JSON）

两个 4×4 矩阵，用于表面 ↔ 体积坐标转换：

```json
{
  "vox2ras":         [[...], [...], [...], [...]],
  "vox2ras_tkr_inv": [[...], [...], [...], [...]]
}
```

### 体积数据

| 格式 | 扩展名 | 说明 |
|------|--------|------|
| NIfTI-1 / NIfTI-2 | `.nii`、`.nii.gz` | 支持 gzip；兼容所有标准 NIfTI 数据类型 |

---

## TypeScript 类型

```typescript
import type {
  // 通用
  PathOrFile,
  ModelData,
  ColorMap,
  TkRas,
  Coordinate,

  // 体积数据
  VolumeData,
  VolumeHeader,
  VoxelData,
  AxisInfo,
  AxisName,

  // 表面查看器
  LoadOption,
  LoadResult,
  UpdateColorsOptions,
  ViewName,
  ModelHandle,

  // 标记点
  Annotation,
  AnnotationData,

  // 体积查看器
  VolumeViewerOptions,
  VoxelPosition,

  // 切片渲染器
  SliceAxis,
  SliceRendererOptions,

  // 颜色映射
  LUT,
  ColormapName,
} from 'neuroviz';
```

---

## License

MIT
