import * as THREE from 'three';

// ══════════════════════════════════════════════════════════════════
// БАГАНА КЛАСС  — Иш + Далбаа + Тархи
//
//   Иш     — нарийн гол бие (доод хэсэг)
//   Далбаа — дунд өргөн чимэглэлийн хавтан
//   Тархи  — дээд V-хэлбэрийн сэрээ (тооно тулдаг)
// ══════════════════════════════════════════════════════════════════
export class Bagana {
    constructor(height = 3.8, radius = 0.06) {
        this.height = height;
        this.radius = radius;
        this.group      = new THREE.Group();
        this.group.name = 'bagana';
        this.build();
    }

    build() {
        const matWood = new THREE.MeshStandardMaterial({ color: 0x8B3A0A, roughness: 0.72, metalness: 0.0 });
        const matRed  = new THREE.MeshStandardMaterial({ color: 0xCC0000, roughness: 0.55, metalness: 0.05 });
        const matGold = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.35, metalness: 0.5 });

        const H  = this.height;
        const R  = this.radius;        // нарийн ишний радиус

        // ── ИШ — нарийн гол бие ──────────────────────────────────
        const ishH = H * 0.58;
        const ish  = new THREE.Mesh(
            new THREE.CylinderGeometry(R, R * 1.1, ishH, 14),
            matWood);
        ish.position.y = ishH / 2;
        ish.castShadow = true;
        this.group.add(ish);

        // Суурь (улаан дугуй тулгуур)
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(R * 2.8, R * 3.0, 0.07, 18),
            matRed);
        base.position.y = 0.035;
        base.castShadow = true;
        this.group.add(base);

        // Ишний улаан зурвас (3 ширхэг)
        [0.18, 0.38, 0.56].forEach(t => {
            const band = new THREE.Mesh(
                new THREE.CylinderGeometry(R * 1.25, R * 1.25, 0.045, 14),
                matRed);
            band.position.y = ishH * t;
            this.group.add(band);
        });

        // ── ДАЛБАА — дунд өргөн хавтан ───────────────────────────
        const dalbaaY = ishH + 0.02;
        const dalbaaH = H * 0.20;
        const dalbaaW = R * 5.5;       // өргөн

        // Гол биеийн шилжилт (нарийнаас өргөн рүү)
        const neck = new THREE.Mesh(
            new THREE.CylinderGeometry(dalbaaW * 0.42, R * 1.1, 0.12, 14),
            matWood);
        neck.position.y = dalbaaY + 0.06;
        this.group.add(neck);

        // Далбааны гол хавтан (BoxGeometry — хавтгай тавцан)
        const dalbaa = new THREE.Mesh(
            new THREE.BoxGeometry(dalbaaW, dalbaaH, R * 2.2),
            matWood);
        dalbaa.position.y = dalbaaY + 0.12 + dalbaaH / 2;
        dalbaa.castShadow = true;
        this.group.add(dalbaa);

        // Далбааны доод улаан зураас
        const dLine1 = new THREE.Mesh(
            new THREE.BoxGeometry(dalbaaW + 0.02, 0.04, R * 2.4),
            matRed);
        dLine1.position.y = dalbaaY + 0.14;
        this.group.add(dLine1);

        // Далбааны дээд улаан зураас
        const dLine2 = new THREE.Mesh(
            new THREE.BoxGeometry(dalbaaW + 0.02, 0.04, R * 2.4),
            matRed);
        dLine2.position.y = dalbaaY + 0.12 + dalbaaH - 0.02;
        this.group.add(dLine2);

        // Далбааны алтан дундын чимэглэл
        const dGold = new THREE.Mesh(
            new THREE.BoxGeometry(dalbaaW * 0.7, dalbaaH * 0.45, R * 1.2),
            matGold);
        dGold.position.y = dalbaaY + 0.12 + dalbaaH / 2;
        this.group.add(dGold);

        // ── ТАРХИ — дээд V/U-хэлбэрийн сэрээ ────────────────────
        // Тооно тулдаг 2 гар — X тэнхлэгт тарсан
        const tarhiBaseY = dalbaaY + 0.12 + dalbaaH;
        const armLen     = H * 0.24;
        const armAngle   = Math.PI / 6;   // 30° гадагшаа налсан

        // Тархийн суурь хэсэг (нарийн)
        const tarhiNeck = new THREE.Mesh(
            new THREE.CylinderGeometry(R * 0.9, dalbaaW * 0.42, 0.1, 12),
            matWood);
        tarhiNeck.position.y = tarhiBaseY + 0.05;
        this.group.add(tarhiNeck);

        // Гар үүсгэх функц
        const makeArm = (side) => {
            const arm = new THREE.Mesh(
                new THREE.CylinderGeometry(R * 0.85, R * 0.95, armLen, 12),
                matWood);
            // Гарын дунд цэг
            const sx = side * Math.sin(armAngle) * armLen / 2;
            const sy = tarhiBaseY + 0.1 + Math.cos(armAngle) * armLen / 2;
            arm.position.set(sx, sy, 0);
            arm.rotation.z = -side * armAngle;
            arm.castShadow = true;
            this.group.add(arm);

            // Гарын үзүүрт улаан малгай
            const capX = side * Math.sin(armAngle) * armLen;
            const capY = tarhiBaseY + 0.1 + Math.cos(armAngle) * armLen;
            const cap  = new THREE.Mesh(
                new THREE.CylinderGeometry(R * 1.6, R * 0.85, 0.1, 12),
                matRed);
            cap.position.set(capX, capY + 0.05, 0);
            cap.rotation.z = -side * armAngle;
            cap.castShadow = true;
            this.group.add(cap);

            // Үзүүрт алтан тойрог
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(R * 1.4, R * 0.3, 8, 18),
                matGold);
            ring.position.set(capX, capY + 0.12, 0);
            ring.rotation.z = -side * armAngle;
            this.group.add(ring);
        };

        makeArm(-1);  // зүүн гар
        makeArm( 1);  // баруун гар

        // Тархийн дунд улаан холбоос
        const tLink = new THREE.Mesh(
            new THREE.BoxGeometry(dalbaaW * 0.5, 0.06, R * 1.8),
            matRed);
        tLink.position.y = tarhiBaseY + 0.12;
        this.group.add(tLink);
    }

    place(x, y, z) {
        this.group.position.set(x, y, z);
        return this;
    }

    getObject() { return this.group; }
}
