declare module "gifti-reader-js" {
  class DataArray {
    getData(): any;
    getDataAsync(onProgress: any, onFinish: any): void;
    getDimensions(): any;
    getNumElements(dimIndex: any): any;
    isAscii(): any;
    isBase64Binary(): any;
    isBase64Encoded(): any;
    isColors(): any;
    isFloat32(): any;
    isGzipBase64Binary(): any;
    isInt32(): any;
    isNormals(): any;
    isPointSet(): any;
    isQuad(): any;
    isScalar(): any;
    isTriangles(): any;
    isTriple(): any;
    isUnsignedInt8(): any;
  }

  class GIFTI {
    getColorsDataArray(): DataArray;
    getNormalsDataArray(): DataArray;
    getNumPoints(): any;
    getNumTriangles(): any;
    getPointsDataArray(): DataArray;
    getTrianglesDataArray(): DataArray;
  }

  function parse(xmlStr: any): GIFTI;
  function isThisFormat(filename: any): any;

  export { parse, isThisFormat, DataArray, GIFTI };
}
