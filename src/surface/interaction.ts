import * as THREE from "../vendor/three.r154.js";

export class Interaction {
  readonly mousemovePosition: [THREE.Vector2, THREE.Vector2] = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0, 0),
  ];

  private static readonly AXIS_Y = new THREE.Vector3(0, 1, 0);
  private static readonly AXIS_X = new THREE.Vector3(1, 0, 0);

  private isDragging = false;
  private isMoving = false;
  private abortController = new AbortController();

  constructor(domElement: HTMLElement, target: THREE.Object3D) {
    this.bindRotation(domElement, target);
    this.bindScale(domElement, target);
    this.bindMove(domElement, target);
  }

  dispose(): void {
    this.abortController.abort();
  }

  /** 将 mesh 顶点坐标平移使其中心归零 */
  static centerMesh(mesh: THREE.Mesh): void {
    const center = new THREE.Vector3();
    new THREE.Box3().setFromObject(mesh).getCenter(center);
    mesh.position.sub(center);
    mesh.updateMatrix();
    mesh.updateMatrixWorld(true);
  }

  /* ── Private ── */

  private bindRotation(domElement: HTMLElement, target: THREE.Object3D): void {
    const rotationSpeed = 0.005;
    let prevMousePosition = { x: 0, y: 0 };
    const signal = this.abortController.signal;

    domElement.addEventListener("mousedown", (event: MouseEvent) => {
      if (event.button !== 0) return;
      this.isDragging = true;
      prevMousePosition = { x: event.clientX, y: event.clientY };
      this.mousemovePosition[0].set(event.clientX, event.clientY);
    }, { signal });

    domElement.addEventListener("mousemove", (event: MouseEvent) => {
      if (!this.isDragging) return;
      const dx = event.clientX - prevMousePosition.x;
      const dy = event.clientY - prevMousePosition.y;
      target.rotateOnWorldAxis(Interaction.AXIS_Y, dx * rotationSpeed);
      target.rotateOnWorldAxis(Interaction.AXIS_X, dy * rotationSpeed);
      prevMousePosition = { x: event.clientX, y: event.clientY };
    }, { signal });

    domElement.addEventListener("mouseup", (event: MouseEvent) => {
      if (event.button !== 0) return;
      this.isDragging = false;
      this.mousemovePosition[1].set(event.clientX, event.clientY);
    }, { signal });
  }

  private bindScale(domElement: HTMLElement, target: THREE.Object3D): void {
    let scaleFactor = 1;
    domElement.addEventListener("wheel", (event: WheelEvent) => {
      event.preventDefault();
      scaleFactor *= event.deltaY > 0 ? 0.95 : 1.05;
      target.scale.set(scaleFactor, scaleFactor, scaleFactor);
    }, { passive: false, signal: this.abortController.signal });
  }

  private bindMove(domElement: HTMLElement, target: THREE.Object3D): void {
    let prevMousePosition = { x: 0, y: 0 };
    const signal = this.abortController.signal;

    domElement.addEventListener("mousedown", (event: MouseEvent) => {
      if (event.button !== 2) return;
      this.isMoving = true;
      prevMousePosition = { x: event.clientX, y: event.clientY };
    }, { signal });

    domElement.addEventListener("mousemove", (event: MouseEvent) => {
      if (!this.isMoving) return;
      target.position.x += (event.clientX - prevMousePosition.x) * 0.3;
      target.position.y -= (event.clientY - prevMousePosition.y) * 0.3;
      prevMousePosition = { x: event.clientX, y: event.clientY };
    }, { signal });

    domElement.addEventListener("mouseup", (event: MouseEvent) => {
      if (event.button !== 2) return;
      this.isMoving = false;
    }, { signal });

    domElement.addEventListener("contextmenu", (event: Event) => {
      event.preventDefault();
    }, { signal });
  }
}
