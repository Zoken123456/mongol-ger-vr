import * as THREE from 'three';

// ══════════════════════════════════════════════════════════════════
// БҮРЭЭС КЛАСС  (гадар бүрхэвч — дээврийн гадна давхарга)
//
// Параметрүүд:
//   topR   — орой радиус (м)
//   botR   — доод радиус (м)
//   roofH  — дээврийн өндөр (м)
//   wallH  — ханын өндөр (байрлал тооцоонд)
//
// Үйлдлүүд:
//   toggle()     — нуух / харуулах
//   setVisible(v)— харагдах байдал тохируулах
//   place(x,y,z) — байрлуулах
//   getObject()  — THREE.Group буцаах
// ══════════════════════════════════════════════════════════════════
export class Bvrees {
    constructor(topR, botR, roofH, wallH) {
        this.topR  = topR;
        this.botR  = botR;
        this.roofH = roofH;
        this.wallH = wallH;
        this.group      = new THREE.Group();
        this.group.name = 'bvrees';
        this.group.userData.toggleable = true;
        this.group.userData.label      = 'Бүрээс';
        this._build();
    }

    _build() {
        const outerMat = new THREE.MeshStandardMaterial({
            color: 0xEEE8D0, roughness: 0.92, metalness: 0, side: THREE.FrontSide
        });
        const eaveMat  = new THREE.MeshStandardMaterial({
            color: 0xE4DEC4, roughness: 0.9,  metalness: 0, side: THREE.DoubleSide
        });

        // Гадна дээврийн бүрхэвч (деевэрээс бага зэрэг том)
        const roofGeo  = new THREE.CylinderGeometry(
            this.topR + 0.06, this.botR + 0.1, this.roofH + 0.12, 48, 1, true);
        const roofMesh = new THREE.Mesh(roofGeo, outerMat);
        roofMesh.position.y       = this.wallH + (this.roofH + 0.12) / 2;
        roofMesh.castShadow       = true;
        roofMesh.receiveShadow    = true;
        roofMesh.userData.isClickMesh = true;
        this.group.add(roofMesh);

        // Захын унжлага (eave drape) — ханатай нийлэх хэсэг
        const eaveGeo  = new THREE.CylinderGeometry(
            this.botR + 0.1, this.botR + 0.18, 0.28, 48, 1, true);
        const eaveMesh = new THREE.Mesh(eaveGeo, eaveMat);
        eaveMesh.position.y    = this.wallH - 0.06;
        eaveMesh.castShadow    = true;
        eaveMesh.userData.isClickMesh = true;
        this.group.add(eaveMesh);
    }

    toggle()      { this.group.visible = !this.group.visible; return this; }
    setVisible(v) { this.group.visible = v; return this; }
    place(x, y, z) { this.group.position.set(x, y, z); return this; }
    getObject()    { return this.group; }
}
