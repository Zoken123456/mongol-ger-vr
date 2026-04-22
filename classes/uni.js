import * as THREE from 'three';
import { createBar } from './utils.js';

// ══════════════════════════════════════════════════════════════════
// УНЬ КЛАСС  (дээврийн туяа — тооноос ханын дээд ирмэг хүртэл)
// ══════════════════════════════════════════════════════════════════
export class Uni {
    constructor(count = 52, gerR = 5, wallH = 2.6, topH = 4, toonoR = 1.2) {
        this.count  = count;
        this.gerR   = gerR;
        this.wallH  = wallH;
        this.topH   = topH;
        this.toonoR = toonoR;
        this.group      = new THREE.Group();
        this.group.name = 'uni';
        this.build();
    }

    build() {
        while (this.group.children.length)
            this.group.remove(this.group.children[0]);

        const matWood = new THREE.MeshStandardMaterial({ color: 0x9B4A10, roughness: 0.72, metalness: 0.0 });

        for (let i = 0; i < this.count; i++) {
            const a = (i / this.count) * Math.PI * 2;
            const bar = createBar(
                new THREE.Vector3(this.toonoR * Math.cos(a), this.topH,  this.toonoR * Math.sin(a)),
                new THREE.Vector3(this.gerR   * Math.cos(a), this.wallH, this.gerR   * Math.sin(a)),
                0.055, matWood);
            bar.castShadow = true;
            this.group.add(bar);
        }
    }

    place(x, y, z) {
        this.group.position.set(x, y, z);
        return this;
    }

    getObject() { return this.group; }
}
