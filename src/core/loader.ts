import * as pako from "@progress/pako-esm";
import * as THREE from "../vendor/three.r154.js";
import { Coordinate } from "../types/index.js";

function decompressIfGzip(buf: ArrayBuffer): ArrayBuffer {
  const magic = new Uint8Array(buf, 0, 2);
  if (magic[0] === 0x1f && magic[1] === 0x8b) {
    return pako.inflate(new Uint8Array(buf)).buffer as ArrayBuffer;
  }
  return buf;
}

export const fileReadAsText = async (filePath: string, responseType: "text" | "arraybuffer" = "text"): Promise<string> => {
  const fileLoader = new THREE.FileLoader();
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  fileLoader.setResponseType(responseType);
  fileLoader.load(
    filePath,
    (data) => {
      if (responseType === "arraybuffer") {
        resolve(pako.inflate(new Uint8Array(data as ArrayBuffer), { to: "string" }));
      } else {
        resolve(data as string);
      }
    },
    undefined,
    (err) => reject(new Error(`Failed to load "${filePath}": ${(err as ErrorEvent).message ?? err}`)),
  );
  return promise;
};

export const fileReadAsArrayBuffer = async (filePath: string): Promise<ArrayBuffer> => {
  const fileLoader = new THREE.FileLoader();
  const { promise, resolve, reject } = Promise.withResolvers<ArrayBuffer>();
  fileLoader.setResponseType("arraybuffer");
  fileLoader.load(
    filePath,
    (data) => resolve(decompressIfGzip(data as ArrayBuffer)),
    undefined,
    (err) => reject(new Error(`Failed to load "${filePath}": ${(err as ErrorEvent).message ?? err}`)),
  );
  return promise;
};

export  const  surfaceCoordToVolume = (surfCoords?: Coordinate, tkras2ras?: { vox2ras: number[][]; vox2ras_tkr_inv: number[][] }): Coordinate | undefined => {
  if (!tkras2ras || !surfCoords) return undefined;
  const vox2ras = new THREE.Matrix4().fromArray(tkras2ras.vox2ras.flat()).transpose();
  const vox2ras_tkr_inv = new THREE.Matrix4().fromArray(tkras2ras.vox2ras_tkr_inv.flat()).transpose();
  const transformMatrix = new THREE.Matrix4().multiplyMatrices(vox2ras, vox2ras_tkr_inv);
  const surfVec = new THREE.Vector4(surfCoords.x, surfCoords.y, surfCoords.z, 1);
  surfVec.applyMatrix4(transformMatrix);
  return {
    x: Number(surfVec.x.toPrecision(4)),
    y: Number(surfVec.y.toPrecision(4)),
    z: Number(surfVec.z.toPrecision(4)),
  };
};