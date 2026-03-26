import * as THREE from "../vendor/three.r154.js";
import { EventEmitter } from "../core/event-emitter.js";
import { Scene } from "../core/scene.js";
import { TkRas, PathOrFile } from "../types/index.js";
import { AnnotationManager } from "./annotation-manager.js";
import { Interaction } from "./interaction.js";
import { MeshBuilder } from "./mesh-builder.js";
import { getVertexData, VertexData } from "./picking.js";
import { surfaceCoordToVolume } from "../core/loader.js";
import * as surfaceLoader from '../loaders/surface-loader.js';

export type LoadOption = {
  model: PathOrFile & { name: string; };
  overlay?: PathOrFile;
  colorMap?: PathOrFile;
  tkRas?: PathOrFile;
  range?: { min: number; max: number };
};



export type UpdateColorsOptions = {
  overlay: PathOrFile;
  colorMap: PathOrFile;
  threshold?: { min: number; max: number };
  range?: { min: number; max: number };
  name?: string;
};

export type ViewName = "lateral" | "medial" | "superior" | "inferior" | "anterior" | "posterior";

export type LoadResult = {
  handle: ModelHandle;
  annotations: AnnotationManager;
  tkRas?: TkRas;
};

// ── 单个模型的控制句柄 ────────────────────────────────────────

export class ModelHandle {
  /** @internal */
  readonly meshBuilder: MeshBuilder;
  /** @internal */
  tkRas?: TkRas;

  constructor(meshBuilder: MeshBuilder, tkRas?: TkRas) {
    this.meshBuilder = meshBuilder;
    this.tkRas = tkRas;
  }

  setPosition(x: number, y: number, z: number): void {
    this.meshBuilder.mesh?.position.set(x, y, z);
  }

  setRotation(x: number, y: number, z: number): void {
    this.meshBuilder.mesh?.rotation.set(x, y, z);
  }

  setScale(s: number): void {
    this.meshBuilder.mesh?.scale.set(s, s, s);
  }

  setTransparency(alpha: number): void {
    if (!this.meshBuilder.mesh) return;
    const mat = this.meshBuilder.mesh.material as THREE.MeshPhongMaterial;
    mat.opacity = alpha;
    mat.transparent = alpha < 1;
  }

  setVisible(visible: boolean): void {
    if(this.meshBuilder.mesh){
      this.meshBuilder.mesh.visible = visible;
    }
  }

  getPositionByIndex(index: number) {
    return this.meshBuilder.getPositionByIndex(index);
  }

  getIndexByPosition(point: { x: number; y: number; z: number }, epsilon?: number) {
    return this.meshBuilder.getIndexByPosition(point, epsilon);
  }
}

function resolveSource<T>(
  source: PathOrFile,
  fromURL: (url: string) => Promise<T>,
  fromFile: (file: ArrayBuffer) => T | Promise<T>,
): Promise<T> {
  return source.url
    ? fromURL(source.url)
    : Promise.resolve(fromFile(source.file!));
}

// ── SurfaceViewer ─────────────────────────────────────────────

export class SurfaceViewer extends EventEmitter {
  private scene: Scene;
  private interaction: Interaction;
  private handles: Map<string, ModelHandle> = new Map();
  private vertexData: VertexData | null = null;
  private abortController = new AbortController();

  constructor(container: HTMLElement) {
    super();
    this.scene = new Scene(container);
    this.scene.startRender();
    this.interaction = new Interaction(this.scene.container, this.scene.modelGroup);
    this.#bindPicking();
  }

  async load(option: LoadOption): Promise<LoadResult> {
    const modelData = await resolveSource(option.model, surfaceLoader.loadModelFromURL, surfaceLoader.loadModelFromFile);
    const [overlayData, colorMapData, tkRas] = await Promise.all([
      option.overlay  ? resolveSource(option.overlay,  surfaceLoader.loadOverlayFromURL,  surfaceLoader.loadOverlayFromFile)  : Promise.resolve(undefined),
      option.colorMap ? resolveSource(option.colorMap, surfaceLoader.loadColorMapFromURL, surfaceLoader.loadColorMapFromFile) : Promise.resolve(undefined),
      option.tkRas ? resolveSource(option.tkRas, surfaceLoader.loadTkRasFromURL,surfaceLoader.loadTkRasFromFile):Promise.resolve(undefined),
    ]);

    const meshBuilder = new MeshBuilder();
    const mesh = meshBuilder.build({modelData, overlayData, colorMapData, range: option.range, name: option.model.name});
    Interaction.centerMesh(mesh);

    this.scene.addModel(mesh);

    const handle = new ModelHandle(meshBuilder, tkRas);
    this.handles.set(option.model.name, handle);

    const annotations = new AnnotationManager(mesh, meshBuilder);
    const result: LoadResult = { handle, annotations };

    this.emit("load", result);
    return result;
  }

  async loads(options: LoadOption[]):Promise<LoadResult[]>{
    return Promise.all(options.map((option) => this.load(option)));
  }


  /** 移除单个模型 */
  removeModel(modelName: string): void {
    const mesh = this.handles.get(modelName)?.meshBuilder.mesh;
    if (mesh) this.scene.modelGroup.remove(mesh);
    this.handles.delete(modelName);
  }


  /** 清除所有模型 */
  clear(): void {
    this.scene.clearModels();
    this.handles.clear();
    const group = this.scene.modelGroup;
    group.rotation.set(0, 0, 0);
    group.position.set(0, 0, 0);
    group.scale.set(1, 1, 1);
    this.scene.camera.position.set(0, 0, 300);
    // 重置交互目标为 group
    this.setInteractionTarget("group");
  }

  /**
   * 切换鼠标交互目标。
   * - `'group'`：所有模型共享旋转/缩放/平移（默认）
   * - `ModelHandle`：仅作用于该模型
   */
  setInteractionTarget(target: "group" | ModelHandle): void {
    this.interaction.dispose();
    const obj = target === "group" ? this.scene.modelGroup : target.meshBuilder.mesh!;
    this.interaction = new Interaction(this.scene.container, obj);
  }

  getVertexData(): VertexData | null {
    return this.vertexData;
  }

  setCameraPosition(x: number, y: number, z: number): void {
    this.scene.setCameraPosition(x, y, z);
  }

  canvasDataURL(): string {
    return this.scene.renderer.domElement.toDataURL();
  }

  getCameraPosition(): { x: number; y: number; z: number } {
    const { x, y, z } = this.scene.camera.position;
    return { x, y, z };
  }

  resetView(): void {
    const group = this.scene.modelGroup;
    group.rotation.set(0, 0, 0);
    group.position.set(0, 0, 0);
    group.scale.set(1, 1, 1);
    this.scene.camera.position.set(0, 0, 300);
    this.scene.camera.updateProjectionMatrix();
  }

  setView(view: ViewName): void {
    this.resetView();
    const group = this.scene.modelGroup;
    const PI = Math.PI;
    const views: Record<ViewName, () => void> = {
      lateral:   () => { group.rotation.x = PI / 2; group.rotation.z = PI / 2; },
      medial:    () => { group.rotation.x = PI / 2; group.rotation.z = -PI / 2; },
      superior:  () => { /* default orientation */ },
      inferior:  () => { group.rotation.y = PI; },
      anterior:  () => { group.rotation.x = -PI / 2; group.rotation.z = PI; },
      posterior: () => { group.rotation.x = -PI / 2; },
    };
    views[view]();
  }

  setTransparency(alpha: number): void {
    this.scene.modelGroup.children.forEach((obj) => {
      const mat = (obj as THREE.Mesh).material as THREE.MeshPhongMaterial;
      mat.opacity = alpha;
      mat.transparent = alpha < 1;
    });
  }

  setWireframe(enabled: boolean): void {
    this.scene.modelGroup.children.forEach((obj) => {
      const mesh = obj as THREE.Mesh;
      const existing = mesh.getObjectByName("__wireframe__") as THREE.LineSegments | undefined;
      if (enabled) {
        if (existing) {
          existing.visible = true;
        } else {
          const wire = new THREE.LineSegments(
            new THREE.WireframeGeometry(mesh.geometry),
            new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.3, transparent: true }),
          );
          wire.name = "__wireframe__";
          mesh.add(wire);
        }
        (mesh.material as THREE.MeshPhongMaterial).visible = false;
      } else {
        if (existing) existing.visible = false;
        (mesh.material as THREE.MeshPhongMaterial).visible = true;
      }
    });
  }

  setClearColor(color: number, alpha = 1): void {
    this.scene.renderer.setClearColor(color, alpha);
  }

  async updateColors(options: UpdateColorsOptions): Promise<void> {
    const handle = options.name
      ? this.handles.get(options.name)
      : this.handles.values().next().value;
    if(!handle) return;
    const [overlayData, colorMapData] = await Promise.all([
      resolveSource(options.overlay,  surfaceLoader.loadOverlayFromURL,  surfaceLoader.loadOverlayFromFile),
      resolveSource(options.colorMap, surfaceLoader.loadColorMapFromURL, surfaceLoader.loadColorMapFromFile)
    ]);
    handle.meshBuilder.updateColors(overlayData, colorMapData, options.threshold, options.range);
    this.emit("updateColors", { overlayData, colorMapData });
  }

  // ── 私有方法 ──────────────────────────────────────────────────

  #bindPicking(): void {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    this.scene.renderer.domElement.addEventListener("click", (event: MouseEvent) => {
      const mp = this.interaction.mousemovePosition;
      if (mp[0].distanceTo(mp[1]) > 0) return;

      const rect = this.scene.renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, this.scene.camera);
      const intersects = raycaster.intersectObjects(this.scene.modelGroup.children, true)
        .filter((i) => i.object instanceof THREE.Mesh);
      const hit = intersects.find((i) => this.handles.has(i.object.name));
      if (!hit) return;

      const hitMesh = hit.object as THREE.Mesh;
      this.vertexData = getVertexData(hit, hitMesh, new THREE.Vector3());
      const handle = this.handles.get(hit.object.name);
      if (handle?.tkRas) {
        this.vertexData.volCoord = surfaceCoordToVolume(this.vertexData.point, handle.tkRas);
      }
      this.emit("vertexClick", this.vertexData);
    }, { signal: this.abortController.signal });
  }

  dispose(): void {
    this.abortController.abort();
    this.interaction.dispose();
    this.handles.forEach((handle) => {
      const mesh = handle.meshBuilder.mesh;
      if (!mesh) return;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    this.handles.clear();
    this.scene.dispose();
  }
}
