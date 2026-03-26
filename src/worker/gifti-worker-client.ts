import { ModelData } from "../types/index.js";
import { runWorker } from "./run-worker.js";
import { getWorkerUrl } from "./worker-config.js";

type GiftiInput = { buffer: ArrayBuffer } | { text: string };

export function parseGiftiInWorker(input: GiftiInput): Promise<ModelData> {
  const transfer = "buffer" in input ? [input.buffer] : [];
  return runWorker<GiftiInput, ModelData>(
    getWorkerUrl("gifti.worker.js"),
    input,
    transfer,
  );
}
