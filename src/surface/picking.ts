import * as THREE from "../vendor/three.r154.js";

export type VertexData = {
  index: number;
  point: THREE.Vector3;
  object: THREE.Object3D;
  volCoord?: { x: number; y: number; z: number };
};

export const getVertexData = (
  intersection: THREE.Intersection,
  mesh: THREE.Mesh,
  center: THREE.Vector3,
): VertexData => {
  const intersect_object = intersection.object;
  const intersect_face = intersection.face;
  const intersect_indices = intersect_face
    ? [intersect_face.a, intersect_face.b, intersect_face.c]
    : [];

  const { x: cx, y: cy, z: cz } = center;
  const inv_matrix = new THREE.Matrix4()
    .copy(intersect_object.matrixWorld)
    .invert();
  const intersect_point = intersection.point.clone().applyMatrix4(inv_matrix);
  const position = mesh.geometry.getAttribute("position").array;

  let intersect_vertex_index = intersect_indices[0];
  let intersect_vertex_coords = new THREE.Vector3(
    position[intersect_vertex_index * 3],
    position[intersect_vertex_index * 3 + 1],
    position[intersect_vertex_index * 3 + 2],
  );
  let min_distance = intersect_point.distanceTo(
    new THREE.Vector3(
      intersect_vertex_coords.x - cx,
      intersect_vertex_coords.y - cy,
      intersect_vertex_coords.z - cz,
    ),
  );

  for (let i = 1; i < intersect_indices.length; i++) {
    const index = intersect_indices[i];
    const coords = new THREE.Vector3(
      position[index * 3],
      position[index * 3 + 1],
      position[index * 3 + 2],
    );
    const distance = intersect_point.distanceTo(
      new THREE.Vector3(coords.x - cx, coords.y - cy, coords.z - cz),
    );
    if (distance < min_distance) {
      intersect_vertex_index = index;
      intersect_vertex_coords = coords;
      min_distance = distance;
    }
  }

  return {
    index: intersect_vertex_index,
    point: intersect_vertex_coords,
    object: intersect_object,
  };
};
