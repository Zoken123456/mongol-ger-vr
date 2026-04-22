import * as THREE from 'three';

// Туслах функц: хоёр цэгийн хооронд хайрцаг "бар" үүсгэх
export function createBar(vStart, vEnd, thickness, material) {
    const dist = vStart.distanceTo(vEnd);
    const bar = new THREE.Mesh(
        new THREE.BoxGeometry(thickness, thickness, dist),
        material
    );
    bar.position.copy(vStart).add(vEnd).divideScalar(2);
    bar.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        vEnd.clone().sub(vStart).normalize()
    );
    return bar;
}
