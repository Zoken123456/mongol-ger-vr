import * as THREE from 'three';

/**
 * Орх — тооны дэвсгэр (smoke-hole cover)
 * Flat felt panel on top of the toono ring.
 * Pivots open from the back edge, pulled by a control rope.
 */
export class Orh {
    constructor(toonoR = 1.2) {
        this._isOpen = false;
        this._group  = new THREE.Group();
        this._group.name = 'orh';
        this._group.userData.toggleable = true;

        const feltMat  = new THREE.MeshStandardMaterial({ color: 0xD8C898, roughness: 0.92, side: THREE.DoubleSide });
        const ropeMat  = new THREE.MeshStandardMaterial({ color: 0x8A6030, roughness: 0.85 });
        const slatMat  = new THREE.MeshStandardMaterial({ color: 0x6A4820, roughness: 0.88 });

        const size = toonoR * 2.1;

        // Pivot group — front edge stays fixed, felt swings up from back
        this._pivot = new THREE.Group();
        this._group.add(this._pivot);

        // Felt panel
        this._felt = new THREE.Mesh(new THREE.BoxGeometry(size, 0.04, size), feltMat);
        this._felt.position.set(0, 0, size * 0.5);   // offset so pivot is at z=0 edge
        this._felt.castShadow = true;
        this._felt.userData.isClickMesh = true;
        this._pivot.add(this._felt);

        // Three wooden slats across the felt
        for (let i = 0; i < 3; i++) {
            const slat = new THREE.Mesh(new THREE.BoxGeometry(size * 0.96, 0.04, 0.07), slatMat);
            slat.position.set(0, 0.04, (i - 1) * size * 0.3 + size * 0.5);
            this._pivot.add(slat);
        }

        // Control rope hangs from front edge down the ger side
        const ropeLen = 4.8;
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, ropeLen, 6), ropeMat);
        rope.position.set(size * 0.38, -ropeLen * 0.5 + 0.04, 0);
        this._group.add(rope);
    }

    place(x, y, z) { this._group.position.set(x, y, z); }
    getObject()    { return this._group; }

    open()   { this._pivot.rotation.x = -Math.PI * 0.72; this._isOpen = true; }
    close()  { this._pivot.rotation.x = 0;               this._isOpen = false; }
    toggle() { this._isOpen ? this.close() : this.open(); }
    isOpen() { return this._isOpen; }
    setVisible(v) { this._group.visible = v; }
}
