import * as THREE from "../vendor/three.r154.js"

export class Scene{
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  light: THREE.PointLight;
  container: HTMLElement;

  modelGroup: THREE.Group;

  private animationFrameId = 0;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement){
    this.container = container;

    this.scene = new THREE.Scene();

    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);

    const aspect = container.offsetWidth / container.offsetHeight || 1;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.z = 300;
    this.camera.updateProjectionMatrix();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // 新增

    this.light = new THREE.PointLight(0xffffff, 0.7);
    this.light.position.set(0, 0, 300);
    this.scene.add(this.light);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  }

  setCameraPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z);
  }

  addModel(mesh: THREE.Mesh): void {
    this.modelGroup.add(mesh);
  }

  clearModels(): void {
    this.modelGroup.clear();
  }

  startRender(): void {
    this.renderer.setSize(
      this.container.offsetWidth,
      this.container.offsetHeight,
    );
    this.container.appendChild(this.renderer.domElement);
    this.startAnimate();
    this.bindResize();
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrameId);
    this.resizeObserver?.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private bindResize(): void {
    this.resizeObserver = new ResizeObserver(() => {
      const w = this.container.offsetWidth;
      const h = this.container.offsetHeight || 1;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    });
    this.resizeObserver.observe(this.container);
  }

  private startAnimate() {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }
}