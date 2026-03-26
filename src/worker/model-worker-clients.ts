import type { ModelData } from "../types/index.js";
import { runWorker } from "./run-worker.js";
import { getWorkerUrl } from "./worker-config.js";

type FreeSurferOutput =
  | { type: "surface"; data: ModelData }
  | { type: "curv";    data: Float32Array };

export function parseMniObjInWorker(buffer: ArrayBuffer): Promise<ModelData> {
  return runWorker<{ buffer: ArrayBuffer }, ModelData>(
    getWorkerUrl("mni-obj.worker.js"),
    { buffer },
    [buffer],
  );
}

export function parseFreeSurferSurfaceInWorker(buffer: ArrayBuffer): Promise<ModelData> {
  return runWorker<{ type: string; buffer: ArrayBuffer }, FreeSurferOutput>(
    getWorkerUrl("freesurfer.worker.js"),
    { type: "surface", buffer },
    [buffer],
  ).then((r) => r.data as ModelData);
}

export function parseFreeSurferCurvInWorker(buffer: ArrayBuffer): Promise<Float32Array> {
  return runWorker<{ type: string; buffer: ArrayBuffer }, FreeSurferOutput>(
    getWorkerUrl("freesurfer.worker.js"),
    { type: "curv", buffer },
    [buffer],
  ).then((r) => r.data as Float32Array);
}

export function parseOverlayInWorker(text: string): Promise<Float32Array> {
  return runWorker<{ text: string }, Float32Array>(
    getWorkerUrl("overlay.worker.js"),
    { text },
  );
}
