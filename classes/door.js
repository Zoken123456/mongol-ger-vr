import * as THREE from 'three';

// ══════════════════════════════════════════════════════════════════
// ХААЛГА КЛАСС
//
// Параметрүүд:
//   height — хаалганы өндөр (м)
//   width  — хаалганы өргөн (м)
//
// Үйлдлүүд:
//   place(x,y,z,angleY) — байрлуулах, эргүүлэх
//   open()              — нээх
//   close()             — хаах
//   update(delta)       — animate loop-д дуудах
//   getObject()         — THREE.Group буцаах
// ══════════════════════════════════════════════════════════════════
export class Door {
    constructor(height = 1.8, width = 1.1) {
        this.height  = height;
        this.width   = width;
        this._openT  = 0;   // 0 = хаалттай, 1 = нээлттэй
        this._target = 0;

        this.group      = new THREE.Group();
        this.group.name = 'door';
        this._leaf      = null;
        this.build();
    }

    build() {
        while (this.group.children.length)
            this.group.remove(this.group.children[0]);

        // Хүрээ улаан, навч ялгаатай тод хүрэн модон
        const matFrame = new THREE.MeshStandardMaterial({ color: 0xC02818, roughness: 0.65, metalness: 0.0 });
        const matWood  = new THREE.MeshStandardMaterial({ color: 0x5A2A10, roughness: 0.78, metalness: 0.0 });
        const matGold  = new THREE.MeshStandardMaterial({ color: 0xE8B028, roughness: 0.35, metalness: 0.65 });

        const H = this.height;
        const W = this.width;
        const thick = 0.10;   // хүрээний зузаан (нимгэн)
        const depth = 0.10;   // хүрээний гүн

        // ── Зүүн, баруун тулгуур ───────────────────────────────────
        [-W / 2 - thick / 2, W / 2 + thick / 2].forEach(x => {
            const post = new THREE.Mesh(
                new THREE.BoxGeometry(thick, H + thick, depth),
                matFrame);
            post.position.set(x, H / 2, 0);
            post.castShadow = true;
            this.group.add(post);
        });

        // ── Дээд тасалбар ─────────────────────────────────────────
        const lintel = new THREE.Mesh(
            new THREE.BoxGeometry(W + thick * 2 + 0.04, thick, depth),
            matFrame);
        lintel.position.set(0, H + thick / 2, 0);
        lintel.castShadow = true;
        this.group.add(lintel);

        // ── Босгон ──────────────────────────────────────────────────
        const sill = new THREE.Mesh(
            new THREE.BoxGeometry(W + thick * 2 + 0.04, thick * 0.5, depth),
            matFrame);
        sill.position.set(0, thick * 0.25, 0);
        sill.castShadow = true;
        this.group.add(sill);

        // ── Хаалганы навч (pivot: баруун захаас эргэнэ) ─────────────
        // Навчны эхлэлийн цэг = хүрээний дотор баруун захад
        this._leaf = new THREE.Group();
        this._leaf.position.set(W / 2, 0, 0);

        // Модон хавтан (навч) — frame-аас илүү жижиг бөгөөд хүрэн өнгөтэй
        const panel = new THREE.Mesh(
            new THREE.BoxGeometry(W * 0.92, (H - thick * 0.6) * 0.96, 0.06),
            matWood);
        // frame-аас 0.08м гадагш товойж — Z-тал
        panel.position.set(-W / 2, H / 2 + thick * 0.15, depth * 0.55);
        panel.castShadow = true;
        panel.receiveShadow = true;
        this._leaf.add(panel);

        // Дотор хэвтээ туяа (2 ширхэг)
        [0.28, 0.65].forEach(ratio => {
            const rail = new THREE.Mesh(
                new THREE.BoxGeometry(W * 0.9, 0.06, 0.04),
                matGold);
            rail.position.set(-W / 2, H * ratio, 0.055);
            this._leaf.add(rail);
        });

        // Босоо голын зураас
        const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, H * 0.85, 0.04),
            matGold);
        stripe.position.set(-W * 0.35, H * 0.5, 0.055);
        this._leaf.add(stripe);

        // Алтан дугуй чимэглэл (3 ширхэг)
        for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(0.08, 0.012, 8, 24),
                matGold);
            ring.position.set(-W * 0.35, H * (0.2 + i * 0.25), 0.06);
            ring.rotation.x = 0;
            this._leaf.add(ring);
        }

        // Бариул (зүүн тал)
        const handle = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 12, 12),
            matGold);
        handle.position.set(-W * 0.88, H * 0.5, 0.07);
        this._leaf.add(handle);

        this.group.add(this._leaf);
    }

    // Байрлуулах ба эргүүлэх
    place(x, y, z, angleY = 0) {
        this.group.position.set(x, y, z);
        this.group.rotation.y = angleY;
        return this;
    }

    // Нээх
    open() {
        this._target = 1;
        return this;
    }

    // Хаах
    close() {
        this._target = 0;
        return this;
    }

    // Animate loop-д дуудах
    update(delta) {
        const speed = 1.8;
        if (this._openT < this._target) {
            this._openT = Math.min(this._target, this._openT + delta * speed);
        } else if (this._openT > this._target) {
            this._openT = Math.max(this._target, this._openT - delta * speed);
        }
        if (this._leaf) {
            // 90° нээлт — хаалга нөгөө талаасаа (баруун pivot) гадагшаа эргэнэ
            this._leaf.rotation.y = -(Math.PI / 2) * this._openT;
        }
    }

    getObject() { return this.group; }
}
