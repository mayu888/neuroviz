import { fileReadAsArrayBuffer } from "../core/loader.js";
import { ModelData } from "../types/index.js";
import { parseMniObjInWorker } from "../worker/model-worker-clients.js";

export function minObjSurfaceFileReadFromBuffer(buffer: ArrayBuffer): Promise<ModelData> {
  return parseMniObjInWorker(buffer);
}

export const minObjSurfaceFileRead = async (path: string): Promise<ModelData> => {
  return parseMniObjInWorker(await fileReadAsArrayBuffer(path));
};
