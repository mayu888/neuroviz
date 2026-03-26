import { fileReadAsText } from "../core/loader";
import { ModelData } from "../types";
import { parseGiftiInWorker } from "../worker/gifti-worker-client.js";

export function giiSurfaceFileReadFromBuffer(buffer: ArrayBuffer): Promise<ModelData> {
  return parseGiftiInWorker({ buffer });
}

export const giiSurfaceFileRead = async (path: string): Promise<ModelData> => {
  const isGzip = path.includes("gz");
  if (isGzip) {
    const text = await fileReadAsText(path, "arraybuffer");
    return parseGiftiInWorker({ text });
  }
  const text = await fileReadAsText(path, "text");
  return parseGiftiInWorker({ text });
};
