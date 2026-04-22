import * as THREE from 'three';
import { createBar } from './utils.js';

// ══════════════════════════════════════════════════════════════════
// ТООНО КЛАСС  (дээврийн нүх — бөмбгөр хэлбэртэй, чимэглэлтэй)
// ══════════════════════════════════════════════════════════════════
export class Toono {
    constructor(radius = 1.2, tubeR = 0.08, beams = 12) {
        this.radius = radius;
        this.tubeR  = tubeR;
        this.beams  = beams;
        this.group      = new THREE.Group();
        this.group.name = 'toono';
        this.build();
    }

    build() {
        const matDark   = new THREE.MeshStandardMaterial({ color: 0x5C3317, roughness: 0.7,  metalness: 0.0 });
        const matRed    = new THREE.MeshStandardMaterial({ color: 0xCC2222, roughness: 0.55, metalness: 0.05 });
        const matWood   = new THREE.MeshStandardMaterial({ color: 0x8B3A0A, roughness: 0.75, metalness: 0.0 });
        const matRib    = new THREE.MeshStandardMaterial({ color: 0xB8431A, roughness: 0.6,  metalness: 0.0 });
        const matGold   = new THREE.MeshStandardMaterial({ color: 0xE0B040, roughness: 0.4,  metalness: 0.4 });
        const matGreen  = new THREE.MeshStandardMaterial({ color: 0x2E8B3E, roughness: 0.6,  metalness: 0.0 });
        const matBlue   = new THREE.MeshStandardMaterial({ color: 0x2A5EA8, roughness: 0.6,  metalness: 0.0 });
        const matCream  = new THREE.MeshStandardMaterial({ color: 0xF0E0BC, roughness: 0.7,  metalness: 0.0 });

        const R     = this.radius;
        const DOME  = R * 0.45;            // бөмбгөрийн өндөр (radius-ын ~45%)

        // ── Үндсэн гадна хүрэ (бөмбгөрийн ёроол) ──
        const outer = new THREE.Mesh(
            new THREE.TorusGeometry(R, this.tubeR, 16, 80), matDark);
        outer.rotation.x = Math.PI / 2;
        outer.castShadow = true;
        this.group.add(outer);

        // ── Улаан чимэглэлтэй тойрог (хүрэний дээгүүр) ──
        const redRing = new THREE.Mesh(
            new THREE.TorusGeometry(R * 1.005, 0.045, 10, 80), matRed);
        redRing.rotation.x = Math.PI / 2;
        redRing.position.y = this.tubeR * 0.6;
        this.group.add(redRing);

        // ── Хүрэн дагуу алтан/ногоон жижиг чимэглэлийн цэгүүд ──
        const decoCount = 24;
        for (let i = 0; i < decoCount; i++) {
            const a = (i / decoCount) * Math.PI * 2;
            const colors = [matGold, matGreen, matBlue, matCream];
            const m = colors[i % colors.length];
            const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), m);
            dot.position.set(R * 1.02 * Math.cos(a), this.tubeR * 1.05, R * 1.02 * Math.sin(a));
            this.group.add(dot);
        }

        // ── БӨМБГӨР ХЯР — гадна хүрэнээс төвийн тойрог хүртэл нумарч өгсөнө ──
        const innerR = R * 0.18;           // төвийн жижиг тойргийн радиус
        for (let i = 0; i < this.beams; i++) {
            const a = (i / this.beams) * Math.PI * 2;
            const cosA = Math.cos(a), sinA = Math.sin(a);
            const start = new THREE.Vector3(R * cosA, 0, R * sinA);
            const apex  = new THREE.Vector3(R * 0.55 * cosA, DOME * 0.85, R * 0.55 * sinA);
            const peak  = new THREE.Vector3(innerR * cosA, DOME, innerR * sinA);
            const curve = new THREE.CatmullRomCurve3([start, apex, peak]);
            const tube  = new THREE.Mesh(
                new THREE.TubeGeometry(curve, 14, 0.045, 8, false), matRib);
            tube.castShadow = true;
            this.group.add(tube);
        }

        // ── Төвийн жижиг тойрог (бөмбгөрийн оройд) ──
        const apexRing = new THREE.Mesh(
            new THREE.TorusGeometry(innerR, 0.05, 10, 40), matDark);
        apexRing.rotation.x = Math.PI / 2;
        apexRing.position.y = DOME;
        this.group.add(apexRing);

        // ── Мөнхийн тойрог — оройн загалмай хэлбэрийн чимэглэл ──
        const crossLen  = innerR * 1.45;
        const crossThk  = 0.038;
        const crossH    = DOME + 0.005;
        const crossX = new THREE.Mesh(
            new THREE.BoxGeometry(crossLen * 2, crossThk, crossThk * 1.3), matGold);
        crossX.position.y = crossH;
        this.group.add(crossX);
        const crossZ = new THREE.Mesh(
            new THREE.BoxGeometry(crossThk * 1.3, crossThk, crossLen * 2), matGold);
        crossZ.position.y = crossH;
        this.group.add(crossZ);
        // Загалмайн төвийн ногоон цэг — мөнхийн тойргийн төв
        const center = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), matGreen);
        center.position.y = crossH + 0.02;
        this.group.add(center);

        // ── Завсрын тойрог (бөмбгөрийн дунд хэсэг) — нэмэлт чимэглэл ──
        const midRing = new THREE.Mesh(
            new THREE.TorusGeometry(R * 0.55, 0.025, 8, 60), matRed);
        midRing.rotation.x = Math.PI / 2;
        midRing.position.y = DOME * 0.85;
        this.group.add(midRing);
    }

    place(x, y, z) {
        this.group.position.set(x, y, z);
        return this;
    }

    getObject() { return this.group; }
}
