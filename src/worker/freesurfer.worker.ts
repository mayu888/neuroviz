/// <reference lib="webworker" />
import { freeSurferSurfaceFileReadFromBuffer, freeSurferCurvFileReadFromBuffer } from "../loaders/freesurfer-loader.js";
import type { ModelData } from "../types/index.js";

type FreeSurferInput =
  | { type: "surface"; buffer: ArrayBuffer }
  | { type: "curv";    buffer: ArrayBuffer };

type FreeSurferOutput =
  | { type: "surface"; data: ModelData }
  | { type: "curv";    data: Float32Array };

self.addEventListener("message", (e: MessageEvent<FreeSurferInput>) => {
  try {
    if (e.data.type === "surface") {
      const data = freeSurferSurfaceFileReadFromBuffer(e.data.buffer);
      const transfer: Transferable[] = [
        (data.vertices as Float32Array).buffer,
        ...(Array.isArray(data.shapes[0].indices)
          ? []
          : [(data.shapes[0].indices as Uint32Array).buffer]),
      ];
      const result: FreeSurferOutput = { type: "surface", data };
      self.postMessage({ ok: true, data: result }, transfer);
    } else {
      const values = freeSurferCurvFileReadFromBuffer(e.data.buffer);
      const result: FreeSurferOutput = { type: "curv", data: values };
      self.postMessage({ ok: true, data: result }, [values.buffer]);
    }
  } catch (err) {
    self.postMessage({ ok: false, message: (err as Error).message });
  }
});
