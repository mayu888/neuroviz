import * as THREE from "../vendor/three.r154.js";
import { MeshBuilder } from "./mesh-builder.js";

export type AnnotationData = Record<string, unknown>;

export type AddAnnotationOption = {
  color?: number;
  name?: string;
  data?: AnnotationData;
};

export type Annotation = {
  vertex: number;
  position: THREE.Vector3;
  name: string;
  color: number;
  data: AnnotationData;
  marker: THREE.Mesh;
};

export class AnnotationManager {
  private annotations: Map<number, Annotation> = new Map();
  #mesh: THREE.Mesh;
  #meshBuilder: MeshBuilder;
  private markerRadius = 0.5;
  private defaultColor = 0xff0000;
  private activeColor  = 0x00ff00;
  private activeVertex: number | null = null;

  constructor(mesh: THREE.Mesh, meshBuilder: MeshBuilder) {
    this.#mesh = mesh;
    this.#meshBuilder = meshBuilder;
  }

  add(vertex: number, options: AddAnnotationOption = {}): Annotation | null {
    if (!this.#mesh.parent) return null; // mesh 已从场景移除
    const pos = this.#meshBuilder.getPositionByIndex(vertex);
    if (!pos) return null;

    const color = options.color ?? this.defaultColor;
    const name  = options.name  ?? `annotation_${vertex}`;
    const data  = options.data  ?? {};

    const position = new THREE.Vector3(pos.x, pos.y, pos.z);
    const marker = this.#createMarker(position, color, name);

    const annotation: Annotation = { vertex, position, name, color, data, marker };
    this.annotations.set(vertex, annotation);
    this.#mesh.add(marker);

    this.activate(vertex);
    return annotation;
  }

  get(vertex: number): Annotation | undefined {
    return this.annotations.get(vertex);
  }

  remove(vertex: number): Annotation | undefined {
    const annotation = this.annotations.get(vertex);
    if (!annotation) return undefined;

    this.#mesh.remove(annotation.marker);
    this.annotations.delete(vertex);

    if (this.activeVertex === vertex) this.activeVertex = null;
    return annotation;
  }

  reset(): void {
    this.annotations.forEach((annotation) => this.#mesh.remove(annotation.marker));
    this.annotations.clear();
    this.activeVertex = null;
  }

  activate(vertex: number): void {
    const target = this.annotations.get(vertex);
    if (!target) return;

    this.activeVertex = vertex;
    this.annotations.forEach((annotation) => {
      const mat = annotation.marker.material as THREE.MeshPhongMaterial;
      mat.color.setHex(annotation === target ? this.activeColor : annotation.color);
    });
  }

  forEach(callback: (annotation: Annotation) => void): void {
    this.annotations.forEach(callback);
  }

  setMarkerRadius(radius: number): void {
    this.markerRadius = radius;
  }

  setDefaultColor(color: number): void {
    this.defaultColor = color;
  }

  setActiveColor(color: number): void {
    this.activeColor = color;
  }

  #createMarker(position: THREE.Vector3, color: number, name: string): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(this.markerRadius, 32, 32);
    const material = new THREE.MeshPhongMaterial({
      color,
      specular: 0xffffff,
      shininess: 10,
    });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.copy(position);
    marker.name = name;
    return marker;
  }
}
