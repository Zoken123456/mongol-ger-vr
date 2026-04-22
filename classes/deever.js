import * as THREE from 'three';

// ══════════════════════════════════════════════════════════════════
// ДЭЭВЭР КЛАСС  (дээврийн эсгий бүрхэвч — 2 хэсэг)
//
// Параметрүүд:
//   topR   — тооно хэсгийн радиус (м)
//   botR   — доод (ханын дээд) радиус (м)
//   height — дээврийн өндөр (м)
//   wallH  — ханын өндөр (байрлал тооцооны тулд)
//
// Үйлдлүүд:
//   toggle(i)       — i=0|1 хэсгийг нуух/харуулах; i=-1 бүгд
//   setVisible(i,v) — i=0|1 харагдах байдал тохируулах; i=-1 бүгд
//   getPanels()     — 2 Group буцаах
//   place(x,y,z)    — байрлуулах
//   getObject()     — THREE.Group буцаах
// ══════════════════════════════════════════════════════════════════
export class Deever {
    constructor(topR, botR, height, wallH) {
        this.topR    = topR;
        this.botR    = botR;
        this.height  = height;
        this.wallH   = wallH;
        this.group      = new THREE.Group();
        this.group.name = 'deever';
        this._panels    = [];
        this._build();
    }

    _build() {
        const outerMat = new THREE.MeshStandardMaterial({
            color: 0xEDE8C8, roughness: 0.88, metalness: 0, side: THREE.FrontSide
        });
        const innerMat = new THREE.MeshStandardMaterial({
            color: 0xD8C89A, roughness: 0.9,  metalness: 0, side: THREE.BackSide
        });

        // 2 хагас тойрог — урд (0→PI) ба хойд (PI→2PI)
        [0, 1].forEach(i => {
            const tStart = i * Math.PI;
            const geo    = new THREE.CylinderGeometry(
                this.topR, this.botR, this.height, 24, 1, true, tStart, Math.PI);

            const panel       = new THREE.Group();
            panel.name        = `deever-${i + 1}`;
            panel.userData.toggleable = true;
            panel.userData.label      = `Дээвэр ${i + 1}`;

            const outer = new THREE.Mesh(geo, outerMat.clone());
            outer.castShadow       = true;
            outer.receiveShadow    = true;
            outer.userData.isClickMesh = true;
            panel.add(outer);

            const inner = new THREE.Mesh(geo, innerMat.clone());
            panel.add(inner);

            panel.position.y = this.wallH + this.height / 2;

            this._panels.push(panel);
            this.group.add(panel);
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
