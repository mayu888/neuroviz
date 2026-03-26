/// <reference lib="webworker" />
import { MniObjReader } from "../parsers/min-obj-reader.js";
import type { ModelData } from "../types/index.js";

function toRgbFloat32(raw: Float32Array | Uint8Array, numVertices: number): Float32Array {
  const color = new Float32Array(numVertices * 3);
  const scale = raw instanceof Uint8Array ? 1 / 255 : 1;
  if (raw.length >= numVertices * 4) {
    for (let i = 0; i < numVertices; i++) {
      color[i * 3]     = raw[i * 4]     * scale;
      color[i * 3 + 1] = raw[i * 4 + 1] * scale;
      color[i * 3 + 2] = raw[i * 4 + 2] * scale;
    }
  } else {
    const r = raw[0] * scale, g = raw[1] * scale, b = raw[2] * scale;
    for (let i = 0; i < numVertices; i++) {
      color[i * 3] = r; color[i * 3 + 1] = g; color[i * 3 + 2] = b;
    }
  }
  return color;
}

self.addEventListener("message", (e: MessageEvent<{ buffer: ArrayBuffer }>) => {
  try {
    const text = new TextDecoder().decode(e.data.buffer);
    const reader = new MniObjReader();
    reader.parse(text);

    const { vertices, normals, colors } = reader;
    const numVertices = vertices.length / 3;
    const indices = reader.getIndices(0)!;
    const color = toRgbFloat32(colors, numVertices);

    const data: ModelData = { vertices, shapes: [{ indices }], normals, color };

    const transfer: Transferable[] = [vertices.buffer, indices.buffer, color.buffer];
    if (normals) transfer.push(normals.buffer);

    self.postMessage({ ok: true, data }, transfer);
  } catch (err) {
    self.postMessage({ ok: false, message: (err as Error).message });
  }
});
