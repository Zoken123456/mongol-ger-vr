import * as THREE from 'three';

// ══════════════════════════════════════════════════════════════════
// ТУУРГА КЛАСС  (ханын эсгий бүрхэвч — 2 хэсэг)
//
// Параметрүүд:
//   radius    — гэрийн радиус (м)
//   wallH     — ханын өндөр (м)
//   doorAngle — хаалганы өнцөг (радиан)
//
// Үйлдлүүд:
//   toggle(i)       — i=0|1 хэсгийг нуух/харуулах; i=-1 бүгд
//   setVisible(i,v) — i=0|1 харагдах байдал тохируулах; i=-1 бүгд
//   getPanels()     — 2 Group буцаах (click-д ашиглана)
//   place(x,y,z)    — байрлуулах
//   getObject()     — THREE.Group буцаах
// ══════════════════════════════════════════════════════════════════
export class Tuurga {
    constructor(radius, wallH, doorAngle = Math.PI / 10) {
        this.radius     = radius;
        this.wallH      = wallH;
        this.doorAngle  = doorAngle;
        this.group      = new THREE.Group();
        this.group.name = 'tuurga';
        this._panels    = [];
        this._build();
    }

    _build() {
        const R   = this.radius + 0.04;
        const H   = this.wallH;
        const da  = this.doorAngle;

        const mat = new THREE.MeshStandardMaterial({
            color: 0xF5EDCC, roughness: 0.9, metalness: 0, side: THREE.DoubleSide
        });

        // theta=PI/2 → +X (хаалга байрлах тал)
        // gap дуусах → panel эхэлнэ
        const gapEnd   = Math.PI / 2 + da / 2;
        const totalArc = Math.PI * 2 - da;
        const half     = totalArc / 2;

        [0, 1].forEach(i => {
            const tStart = gapEnd + i * half;
            const geo    = new THREE.CylinderGeometry(
                R, R, H * 0.98, 40, 1, true, tStart, half);

            const mesh = new THREE.Mesh(geo, mat.clone());
            mesh.position.y        = H * 0.48;
            mesh.castShadow        = true;
            mesh.receiveShadow     = true;
            mesh.userData.isClickMesh = true;

            const panel       = new THREE.Group();
            panel.name        = `tuurga-${i + 1}`;
            panel.userData.toggleable = true;
            panel.userData.label      = `Туурга ${i + 1}`;
            panel.add(mesh);

            this._panels.push(panel);
            this.group.add(panel);
        });

        // Улаан зах — доод ба дээд
        const bandMat = new THREE.MeshStandardMaterial({
            color: 0xCC0000, roughness: 0.55, metalness: 0.05
        });
        [0.08, H - 0.06].forEach(y => {
            const b = new THREE.Mesh(
                new THREE.TorusGeometry(R + 0.01, 0.055, 10, 80), bandMat);
            b.rotation.x = Math.PI / 2;
            b.position.y = y;
            this.group.add(b);
        });
    }

    toggle(i) {
        if (i === -1) this._panels.forEach(p => { p.visible = !p.visible; });
        else if (this._panels[i]) this._panels[i].visible = !this._panels[i].visible;
        return this;
    }

    setVisible(i, v) {
        if (i === -1) this._panels.forEach(p => { p.visible = v; });
        else if (this._panels[i]) this._panels[i].visible = v;
        return this;
    }

    getPanels()     { return this._panels; }
    place(x, y, z)  { this.group.position.set(x, y, z); return this; }
    getObject()     { return this.group; }
}
