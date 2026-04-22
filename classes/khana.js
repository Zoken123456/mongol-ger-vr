import * as THREE from 'three';
import { createBar } from './utils.js';

// ══════════════════════════════════════════════════════════════════
// ХАНА КЛАСС  (нэг хэсгийн хана — тор загвар)
//
// Параметрүүд:
//   tolgoinToo   — толгойн тоо (босоо давхарга)
//   hajuuAmniToo — хажуу амны тоо (хэвтээ сегмент)
//   niitenUrgun  — нэг ромбо нүдний талын урт (м)
//   radius       — гэрийн радиус (м)
//   gerHeight    — гэрийн нийт өндөр (м)
//   heightRatio  — ханын өндрийн харьцаа (0~1)
//   startAngle   — эхлэх өнцөг (радиан)
//   endAngle     — дуусах өнцөг (радиан)
//
// Үйлдлүүд:
//   place(x,y,z)      — байрлуулах
//   unfold()          — бүрэн дэлгэх
//   fold()            — эвхэх
//   setFoldRatio(r)   — дэлгэлтийн хэмжээ тохируулах (0.1 ~ 1.0)
//   setVisible(v)     — харагдах/нуугдах
//   getHeight()       — одоогийн өндөр авах
//   getObject()       — THREE.Group буцаах
// ══════════════════════════════════════════════════════════════════
export class Khana {
    constructor(
        tolgoinToo   = 4,
        hajuuAmniToo = 10,
        niitenUrgun  = 0.5,
        radius       = 5,
        gerHeight    = 4,
        heightRatio  = 0.65,
        startAngle   = 0,
        endAngle     = Math.PI * 2
    ) {
        this.tolgoinToo   = tolgoinToo;
        this.hajuuAmniToo = hajuuAmniToo;
        this.niitenUrgun  = niitenUrgun;
        this.radius       = radius;
        this.gerHeight    = gerHeight;
        this.heightRatio  = heightRatio;
        this.startAngle   = startAngle;
        this.endAngle     = endAngle;
        this._foldRatio   = 1.0;
        this._visible     = true;
        // Material-ийг нэг удаа үүсгэж дахин ашиглана (memory leak-аас зайлсхийх)
        this._mat = new THREE.MeshStandardMaterial({ color: 0x8B3A0A, roughness: 0.78, metalness: 0.0 });

        this.group      = new THREE.Group();
        this.group.name = 'khana_segment';
        this.build();
    }

    build() {
        // Хуучин geometry-г dispose хийж, mesh-үүдийг устгах
        for (const child of this.group.children) {
            if (child.geometry) child.geometry.dispose();
        }
        this.group.clear();

        const R     = this.radius - 0.05;
        const mat   = this._mat;
        const thick = Math.max(0.02, this.niitenUrgun * 0.06);
        const kH    = this.gerHeight * this.heightRatio; // өндөр хэвээр үлдэнэ

        // Эвхэхэд arc нь дундаасаа 2 тийш шахагдана
        const midAngle = (this.startAngle + this.endAngle) / 2;
        const halfSpan = ((this.endAngle - this.startAngle) / 2) * this._foldRatio;
        const effStart = midAngle - halfSpan;
        const span     = halfSpan * 2;
        const seg      = span / this.hajuuAmniToo;

        for (let i = 0; i < this.hajuuAmniToo; i++) {
            const a  = effStart + i * seg;
            const na = effStart + (i + 1) * seg;

            for (let l = 0; l < this.tolgoinToo; l++) {
                const y0 = (l / this.tolgoinToo) * kH;
                const y1 = ((l + 1) / this.tolgoinToo) * kH;

                // \ диагональ
                const b1 = createBar(
                    new THREE.Vector3(R * Math.cos(a),  y1, R * Math.sin(a)),
                    new THREE.Vector3(R * Math.cos(na), y0, R * Math.sin(na)),
                    thick, mat);
                b1.castShadow = true;
                this.group.add(b1);

                // / диагональ
                const b2 = createBar(
                    new THREE.Vector3(R * Math.cos(a),  y0, R * Math.sin(a)),
                    new THREE.Vector3(R * Math.cos(na), y1, R * Math.sin(na)),
                    thick, mat);
                b2.castShadow = true;
                this.group.add(b2);
            }
        }
    }

    // Байрлуулах
    place(x, y, z) {
        this.group.position.set(x, y, z);
        return this;
    }

    // Бүрэн дэлгэх
    unfold() {
        this._foldRatio = 1.0;
        this.build();
        return this;
    }

    // Эвхэх
    fold() {
        this._foldRatio = 0.15;
        this.build();
        return this;
    }

    // Дэлгэлтийн хэмжээ тохируулах (0.1 ~ 1.0)
    setFoldRatio(r) {
        this._foldRatio = Math.max(0.1, Math.min(1.0, r));
        this.build();
        return this;
    }

    setVisible(v)  { this.group.visible = v; this._visible = v; return this; }
    getVisible()   { return this._visible; }
    getObject()    { return this.group; }
    getHeight()    { return this.gerHeight * this.heightRatio * this._foldRatio; }
}
