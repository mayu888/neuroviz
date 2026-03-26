import * as THREE from "../vendor/three.r154.js";
import { ColorMap, ModelData } from "../types/index.js";

export type BuildOption = {
  modelData: ModelData;
  overlayData?: Float32Array;
  colorMapData?: ColorMap;
  range?: { min: number; max: number };
  name?: string;
}

export class MeshBuilder {
  mesh: THREE.Mesh | null = null;
  private positionIndex: Map<string, number> = new Map();

  build(option: BuildOption): THREE.Mesh{
    const { modelData, overlayData, colorMapData, range, name } = option;
    if (overlayData && colorMapData) {
      this.applyOverlayColorMap(modelData, overlayData, colorMapData, range);
    } else {
      this.generateColors(modelData);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(modelData.vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(modelData.shapes[0].indices), 1));
    if (modelData.normals && modelData.normals.length > 0) {
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(modelData.normals, 3));
    } else {
      geometry.computeVertexNormals();
      geometry.normalizeNormals();
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(modelData.color as Float32Array, 3));

    const material = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      // specular: new THREE.Color(0x111111),
      specular: 0x101010,
      // shininess: 30,
      shininess: 150,
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
      vertexColors: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name || "surface_mesh";
    mesh.userData["original_data"] = {
      vertices: modelData.vertices,
      indices: modelData.shapes[0].indices,
      normals: modelData.normals,
      color: modelData.color,
    };

    this.mesh = mesh;
    this.buildPositionIndex();
    return mesh;
  }

  updateColors(
    overlayData?: Float32Array,
    colorMapData?: ColorMap,
    threshold?: { min: number; max: number },
    range?: { min: number; max: number },
  ): void {
    if (!this.mesh) return;

    const attr = this.mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
    const buf = attr.array as Float32Array;
    const vertexCount = this.mesh.geometry.getAttribute("position").count;

    // Pre-compute original (neutral) color for thresholded vertices
    const original = this.mesh.userData["original_data"].color as Float32Array | number[];
    const src = original instanceof Float32Array ? original : new Float32Array(original);
    const isPerVertex = src.length >= vertexCount * 3;
    const neutralR = src[0], neutralG = src[1], neutralB = src[2];

    if (overlayData && colorMapData) {
      const { dataMin, span, lastIdx } = MeshBuilder.computeOverlayParams(overlayData, colorMapData, range);
      for (let i = 0; i < overlayData.length && i < vertexCount; i++) {
        const val = overlayData[i];
        if (threshold && (val < threshold.min || val > threshold.max)) {
          buf[i * 3]     = isPerVertex ? src[i * 3]     : neutralR;
          buf[i * 3 + 1] = isPerVertex ? src[i * 3 + 1] : neutralG;
          buf[i * 3 + 2] = isPerVertex ? src[i * 3 + 2] : neutralB;
        } else {
          const color = MeshBuilder.mapValueToColor(val, dataMin, span, lastIdx, colorMapData);
          buf[i * 3]     = color[0];
          buf[i * 3 + 1] = color[1];
          buf[i * 3 + 2] = color[2];
        }
      }
    } else {
      const original = this.mesh.userData["original_data"].color as Float32Array | number[];
      const src = original instanceof Float32Array ? original : new Float32Array(original);
      const stride = src.length >= vertexCount * 3 ? 3 : src.length % 4 === 0 ? 4 : 3;
      const r = src[0], g = src[1], b = src[2];
      for (let i = 0; i < vertexCount; i++) {
        if (stride === 3 && src.length >= vertexCount * 3) {
          buf[i * 3] = src[i * 3];
          buf[i * 3 + 1] = src[i * 3 + 1];
          buf[i * 3 + 2] = src[i * 3 + 2];
        } else {
          buf[i * 3] = r;
          buf[i * 3 + 1] = g;
          buf[i * 3 + 2] = b;
        }
      }
    }

    attr.needsUpdate = true;
  }

  getPositionByIndex(index: number): { x: number; y: number; z: number } | null {
    if (!this.mesh) return null;
    const attr = this.mesh.geometry.getAttribute("position");
    if (!attr || index < 0 || index >= attr.count) return null;
    return { x: attr.getX(index), y: attr.getY(index), z: attr.getZ(index) };
  }

  getIndexByPosition(point: { x: number; y: number; z: number }, epsilon = 1e-6): number {
    if (!this.mesh) return -1;
    // O(1) exact lookup
    const key = `${point.x},${point.y},${point.z}`;
    const exact = this.positionIndex.get(key);
    if (exact !== undefined) return exact;
    // Fallback: epsilon search for imprecise coordinates
    const attr = this.mesh.geometry.getAttribute("position");
    if (attr.count === 0) return -1;
    const target = new THREE.Vector3(point.x, point.y, point.z);
    for (let i = 0; i < attr.count; i++) {
      const distance = target.distanceTo(
        new THREE.Vector3(attr.getX(i), attr.getY(i), attr.getZ(i)),
      );
      if (distance < epsilon) return i;
    }
    return -1;
  }

  private buildPositionIndex(): void {
    if (!this.mesh) return;
    this.positionIndex.clear();
    const attr = this.mesh.geometry.getAttribute("position");
    for (let i = 0; i < attr.count; i++) {
      const key = `${attr.getX(i)},${attr.getY(i)},${attr.getZ(i)}`;
      if (!this.positionIndex.has(key)) {
        this.positionIndex.set(key, i);
      }
    }
  }

  private applyOverlayColorMap(
    modelData: ModelData,
    overlay: Float32Array,
    colorMap: ColorMap,
    range?: { min: number; max: number },
  ): void {
    const { dataMin, span, lastIdx } = MeshBuilder.computeOverlayParams(overlay, colorMap, range);
    const colors = new Float32Array(overlay.length * 3);
    for (let i = 0; i < overlay.length; i++) {
      const color = MeshBuilder.mapValueToColor(overlay[i], dataMin, span, lastIdx, colorMap);
      colors[i * 3]     = color[0];
      colors[i * 3 + 1] = color[1];
      colors[i * 3 + 2] = color[2];
    }
    modelData.color = colors;
  }

  private static computeOverlayParams(
    overlay: Float32Array,
    colorMap: ColorMap,
    range?: { min: number; max: number },
  ): { dataMin: number; span: number; lastIdx: number } {
    let lo = overlay[0], hi = overlay[0];
    for (let i = 1; i < overlay.length; i++) {
      if (overlay[i] < lo) lo = overlay[i];
      if (overlay[i] > hi) hi = overlay[i];
    }
    const dataMin = range?.min ?? lo;
    const dataMax = range?.max ?? hi;
    return { dataMin, span: dataMax - dataMin || 1, lastIdx: colorMap.length - 1 };
  }

  private static mapValueToColor(
    val: number,
    dataMin: number,
    span: number,
    lastIdx: number,
    colorMap: ColorMap,
  ): readonly number[] {
    const clamped = Math.max(dataMin, Math.min(dataMin + span, val));
    const idx = Math.round(((clamped - dataMin) / span) * lastIdx);
    return colorMap[idx];
  }

  private generateColors(modelData: ModelData): void {
    const numVertices = modelData.vertices.length / 3;

    // 已经是 per-vertex RGB（3分量 × numVertices），直接用
    if (modelData.color && modelData.color.length === numVertices * 3) return;

    // 取前3个值作为单色（自动判断 0-255 还是 0-1 范围）
    let r = 0.1, g = 0.1, b = 0.1;
    if (modelData.color && modelData.color.length >= 3) {
      const c = modelData.color;
      const scale = (c[0] > 1 || c[1] > 1 || c[2] > 1) ? 1 / 255 : 1;
      r = c[0] * scale;
      g = c[1] * scale;
      b = c[2] * scale;
    }

    const color = new Float32Array(numVertices * 3);
    for (let i = 0; i < numVertices; i++) {
      color[i * 3]     = r;
      color[i * 3 + 1] = g;
      color[i * 3 + 2] = b;
    }
    modelData.color = color;
  }
}
