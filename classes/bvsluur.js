import * as THREE from 'three';

// ══════════════════════════════════════════════════════════════════
// БҮСЛҮҮР КЛАСС  (гэрийн гадна олсон бүс — 3 ширхэг)
//
// Параметрүүд:
//   radius    — гэрийн радиус (м)
//   wallH     — ханын өндөр (м)
//   doorAngle — хаалганы өнцөг (радиан)
//
// Үйлдлүүд:
//   toggle(i)       — i=0|1|2 бүсийг нуух/харуулах; i=-1 бүгд
//   setVisible(i,v) — i=0|1|2 харагдах байдал тохируулах; i=-1 бүгд
//   getBands()      — 3 Group буцаах
//   place(x,y,z)    — байрлуулах
//   getObject()     — THREE.Group буцаах
// ══════════════════════════════════════════════════════════════════
export class Bvsluur {
    constructor(radius, wallH, doorAngle = Math.PI / 10) {
        this.radius     = radius;
        this.wallH      = wallH;
        this.doorAngle  = doorAngle;
        this.group      = new THREE.Group();
        this.group.name = 'bvsluur';
        this._bands     = [];
        this._build();
    }

    _build() {
        const R   = this.radius + 0.09;
        const da  = this.doorAngle;
        const arc = Math.PI * 2 - da;

        const yPos = [
            this.wallH * 0.12,
            this.wallH * 0.5,
            this.wallH * 0.88
        ];

        yPos.forEach((y, i) => {
            const mat = new THREE.MeshStandardMaterial({
                color: 0xE8901A, roughness: 0.82, metalness: 0.0, side: THREE.DoubleSide
            });

            const wrapper = new THREE.Group();
            wrapper.rotation.y = -da / 2;   // gap-г хаалганы +X байрлалд нийлүүлнэ

            // Хавтгай туурганы дагуу нэхсэн бүс — нимгэн open-ended cylinder
            const band = new THREE.Mesh(
                new THREE.CylinderGeometry(R, R, 0.16, 60, 1, true,
                                           0, arc),
                mat);
            band.castShadow = true;
            band.userData.isClickMesh = true;
            wrapper.add(band);

            const outer       = new THREE.Group();
            outer.name        = `bvsluur-${i + 1}`;
            outer.userData.toggleable = true;
            outer.userData.label      = `Бүслүүр ${i + 1}`;
            outer.position.y  = y;
            outer.add(wrapper);

            this._bands.push(outer);
            this.group.add(outer);
        });
    }

    toggle(i) {
        if (i === -1) this._bands.forEach(b => { b.visible = !b.visible; });
        else if (this._bands[i]) this._bands[i].visible = !this._bands[i].visible;
        return this;
    }

    setVisible(i, v) {
        if (i === -1) this._bands.forEach(b => { b.visible = v; });
        else if (this._bands[i]) this._bands[i].visible = v;
        return this;
    }

    getBands()      { return this._bands; }
    place(x, y, z)  { this.group.position.set(x, y, z); return this; }
    getObject()     { return this.group; }
}
