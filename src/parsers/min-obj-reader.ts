type ObjType = "polygon" | "line";

interface SurfacePropertiesPolygon {
  ambient: number;
  diffuse: number;
  specularReflectance: number;
  specularScattering: number;
  transparency: number;
}

interface SurfacePropertiesLine {
  width: number;
}

type SurfaceProperties = SurfacePropertiesPolygon | SurfacePropertiesLine;

interface TempResult {
  type: ObjType;
  numVertices: number;
  nitems: number;
  vertices: Float32Array;
  normals?: Float32Array;
  // flag 0: Float32Array(4, 0-1)  flag 1: Float32Array(nitems*4, 0-1)  flag 2: Float32Array(numVertices*4, 0-1)
  colors: Float32Array;
  indices: Uint32Array;
  endIndices: Uint32Array;
  surfaceProperties: SurfaceProperties;
}

interface Shape {
  indices: Uint32Array;
}

export interface ShapeData {
  type: ObjType;
  vertices: Float32Array;
  normals?: Float32Array;
  // flag 0 (single color): Uint8Array(numVertices*4, 0-255), expanded
  // flag 1 (per-polygon):  Float32Array(nitems*4, 0-1)
  // flag 2 (per-vertex):   Float32Array(numVertices*4, 0-1)
  colors: Uint8Array | Float32Array;
  surfaceProperties: SurfaceProperties;
  shapes: Shape[];
}

export class MniObjReader {
  #stack: string[] = [];
  #stackIndex = -1;
  #temp!: TempResult;
  #shapeData!: ShapeData;

  /* ================= PUBLIC API ================= */

  parse(objString: string): void {
    this.#parseRaw(objString);
    this.#buildShapeData();
  }

  get shapeData(): ShapeData {
    return this.#shapeData;
  }

  get numberOfShapes(): number {
    return this.#shapeData.shapes.length;
  }

  getIndices(shapeIndex = 0): Uint32Array | null {
    return this.#shapeData.shapes[shapeIndex]?.indices ?? null;
  }

  get vertices(): Float32Array {
    return this.#shapeData.vertices;
  }

  get normals(): Float32Array | undefined {
    return this.#shapeData.normals;
  }

  get colors(): Uint8Array | Float32Array {
    return this.#shapeData.colors;
  }

  get surfaceProperties(): SurfaceProperties {
    return this.#shapeData.surfaceProperties;
  }

  /* ================= CORE PARSER ================= */

  #parseRaw(objString: string): void {
    this.#stack = objString.trim().split(/\s+/).reverse();
    this.#stackIndex = this.#stack.length - 1;

    const objectClass = this.#pop();

    const type: ObjType =
      objectClass === "P" ? "polygon" :
      objectClass === "L" ? "line" :
      (() => { throw new Error(`Invalid object class: ${objectClass}`); })();

    this.#temp = {
      type,
      numVertices: 0,
      nitems: 0,
      vertices: new Float32Array(),
      colors: new Float32Array(),
      indices: new Uint32Array(),
      endIndices: new Uint32Array(),
      surfaceProperties: {} as SurfaceProperties,
    };

    this.#parseSurfaceProperties();

    this.#temp.numVertices = this.#popInt();
    this.#temp.vertices = this.#parseFloatArray(this.#temp.numVertices * 3);

    if (type === "polygon") {
      this.#temp.normals = this.#parseFloatArray(this.#temp.numVertices * 3);
    }

    this.#temp.nitems = this.#popInt();

    this.#parseColors();
    this.#parseEndIndices();
    // Everything remaining in the stack is the index list
    this.#parseIndices();

    if (type === "line") {
      this.#rebuildLineIndices();
    }
  }

  #buildShapeData(): void {
    const t = this.#temp;

    let colors: Uint8Array | Float32Array = t.colors;
    // flag 0: single RGBA → expand to per-vertex Uint8Array (0-255)
    if (colors.length === 4) {
      colors = this.#expandSingleColor(colors, t.vertices.length / 3);
    }

    this.#shapeData = {
      type: t.type,
      vertices: t.vertices,
      normals: t.normals,
      colors,
      surfaceProperties: t.surfaceProperties,
      shapes: [{ indices: t.indices }],
    };
  }

  /* ================= PARSE HELPERS ================= */

  #parseSurfaceProperties(): void {
    if (this.#temp.type === "polygon") {
      this.#temp.surfaceProperties = {
        ambient: this.#popFloat(),
        diffuse: this.#popFloat(),
        specularReflectance: this.#popFloat(),
        specularScattering: this.#popFloat(),
        transparency: this.#popFloat(),
      };
    } else {
      this.#temp.surfaceProperties = {
        width: this.#popFloat(),
      };
    }
  }

  #parseColors(): void {
    const flag = this.#popInt();
    let count: number;
    if (flag === 0) count = 4;
    else if (flag === 1) count = this.#temp.nitems * 4;
    else if (flag === 2) count = this.#temp.numVertices * 4;
    else throw new Error(`Invalid color flag: ${flag}`);
    this.#temp.colors = this.#parseFloatArray(count);
  }

  #parseEndIndices(): void {
    this.#temp.endIndices = this.#parseUintArray(this.#temp.nitems);
  }

  #parseIndices(): void {
    this.#temp.indices = this.#parseUintArray(this.#stackIndex + 1);
  }

  #rebuildLineIndices(): void {
    const { indices, endIndices, nitems } = this.#temp;
    let size = 0;
    for (let i = 0; i < nitems; i++) {
      const start = i === 0 ? 0 : endIndices[i - 1];
      const end = endIndices[i];
      size += (end - start - 1) * 2;
    }
    const result = new Uint32Array(size);
    let ptr = 0;
    for (let i = 0; i < nitems; i++) {
      const start = i === 0 ? 0 : endIndices[i - 1];
      const end = endIndices[i];
      result[ptr++] = indices[start];
      for (let j = start + 1; j < end - 1; j++) {
        result[ptr++] = indices[j];
        result[ptr++] = indices[j];
      }
      result[ptr++] = indices[end - 1];
    }
    this.#temp.indices = result;
  }

  /* ================= LOW LEVEL ================= */

  #expandSingleColor(color: Float32Array, vertexCount: number): Uint8Array {
    const result = new Uint8Array(vertexCount * 4);
    const [r, g, b, a] = color.map((v) => Math.round(v * 255));
    for (let i = 0; i < result.length; i += 4) {
      result[i] = r; result[i + 1] = g; result[i + 2] = b; result[i + 3] = a;
    }
    return result;
  }

  #parseFloatArray(count: number): Float32Array {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) arr[i] = this.#popFloat();
    return arr;
  }

  #parseUintArray(count: number): Uint32Array {
    const arr = new Uint32Array(count);
    for (let i = 0; i < count; i++) arr[i] = this.#popInt();
    return arr;
  }

  #pop(): string {
    return this.#stack[this.#stackIndex--];
  }

  #popFloat(): number {
    return parseFloat(this.#pop());
  }

  #popInt(): number {
    return parseInt(this.#pop(), 10);
  }
}
