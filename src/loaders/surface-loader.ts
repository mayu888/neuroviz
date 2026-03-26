import { fileReadAsText, fileReadAsArrayBuffer } from "../core/loader";
import { processColorMap } from "../surface/color-mapper";
import { ColorMap, ModelData, TkRas } from "../types";
import { giiSurfaceFileRead, giiSurfaceFileReadFromBuffer } from "./gifti-loader";
import { minObjSurfaceFileRead, minObjSurfaceFileReadFromBuffer } from "./min-obj-loader";
import { freeSurferSurfaceFileRead, freeSurferSurfaceFileReadFromBuffer, freeSurferCurvFileRead } from "./freesurfer-loader";
import { parseOverlayInWorker } from "../worker/model-worker-clients.js";

function getPathname(path: string): string {
  try { return new URL(path).pathname; } catch { return path; }
}

async function detectFromBuffer(buffer: ArrayBuffer): Promise<ModelData> {
  const bytes = new Uint8Array(buffer, 0, 5);
  // <?xml → GIfTI
  if (bytes[0] === 0x3C && bytes[1] === 0x3F) return giiSurfaceFileReadFromBuffer(buffer);
  // P → MNI OBJ
  if (bytes[0] === 0x50)                       return minObjSurfaceFileReadFromBuffer(buffer);
  // FF FF FE → FreeSurfer surface
  if (bytes[0] === 0xFF && bytes[1] === 0xFF && bytes[2] === 0xFE)
    return freeSurferSurfaceFileReadFromBuffer(buffer);
  throw new Error("Cannot determine model type from file content.");
}

export const loadModelFromURL = async (path: string): Promise<ModelData> => {
  const pathname = getPathname(path);

  if (/\.gii(\.gz)?$/i.test(pathname)) return giiSurfaceFileRead(path);
  if (/\.obj(\.gz)?$/i.test(pathname)) return minObjSurfaceFileRead(path);
  if (/[/\\](lh|rh)\.(pial|white|inflated|sphere|orig|smoothwm)(\.gz)?$/i.test(pathname))
    return freeSurferSurfaceFileRead(path);

  // 扩展名无法识别 → 读文件头，按魔数判断
  const buffer = await fileReadAsArrayBuffer(path);
  return detectFromBuffer(buffer);
};

export const loadModelFromFile = (file: ArrayBuffer): Promise<ModelData> => {
  return detectFromBuffer(file);
};

export const loadCurv = async (path: string): Promise<Float32Array> => {
  return freeSurferCurvFileRead(path);
};

export const loadOverlayFromURL = async (path: string): Promise<Float32Array> => {
  const text = await fileReadAsText(path, "arraybuffer");
  return parseOverlayInWorker(text);
};

export const loadOverlayFromFile = async (buffer: ArrayBuffer): Promise<Float32Array> => {
  const text = new TextDecoder().decode(buffer);
  return parseOverlayInWorker(text);
};

export const loadColorMapFromURL = async (path: string): Promise<ColorMap> => {
  const data = await fileReadAsText(path);
  return processColorMap(data);
};

export const loadColorMapFromFile = (buffer: ArrayBuffer): ColorMap => {
  const text = new TextDecoder().decode(buffer);
  return processColorMap(text);
};

export const loadTkRasFromURL = async (path: string): Promise<TkRas> => {
  const data = await fileReadAsText(path);
  return JSON.parse(data) as TkRas;
};

export const loadTkRasFromFile = (buffer: ArrayBuffer): TkRas => {
  const text = new TextDecoder().decode(buffer);
  return JSON.parse(text) as TkRas;
};