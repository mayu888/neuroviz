/// <reference lib="webworker" />
import giFti from "gifti-reader-js";
import type { ModelData } from "../types/index.js";

type GiftiInput = { buffer: ArrayBuffer } | { text: string };

self.addEventListener("message", (e: MessageEvent<GiftiInput>) => {
  try {
    const text = "text" in e.data
      ? e.data.text
      : new TextDecoder().decode(e.data.buffer);

    const giiData = giFti.parse(text);
    const vertices = giiData.getPointsDataArray().getData() as Float32Array;
    const indices  = giiData.getTrianglesDataArray().getData() as Uint32Array;
    const normals  = giiData.getNormalsDataArray()?.getData() as Float32Array | undefined;

    const data: ModelData = {
      vertices,
      shapes: [{ indices }],
      normals,
      color: new Float32Array([0.1, 0.1, 0.1, 1.0]),
    };

    const transfer: Transferable[] = [vertices.buffer, indices.buffer];
    if (normals) transfer.push(normals.buffer);

    self.postMessage({ ok: true, data }, transfer);
  } catch (err) {
    self.postMessage({ ok: false, message: (err as Error).message });
  }
});
