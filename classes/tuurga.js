import * as THREE from 'three';

// Цэнхэр монгол хээтэй эсгийн texture зурна (canvas → CanvasTexture)
function _makeKheeTexture() {
    const W = 1024, H = 512;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    // Эсгийн (цагаан) суурь
    ctx.fillStyle = '#F4EDD4';
    ctx.fillRect(0, 0, W, H);
    // Бага зэргийн текстур — санамсаргүй цэгүүд
    ctx.fillStyle = 'rgba(150,130,90,0.12)';
    for (let i = 0; i < 400; i++) {
        ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }

    const blue = '#14337A';
    const blueD= '#0B204A';

    // ── Дээд цэнхэр "алх" хээ (Greek-key / meander) бүс ──
    const bandY = 32, bandH = 64;
    ctx.fillStyle = blue;
    ctx.fillRect(0, bandY, W, bandH);
    ctx.fillStyle = '#F4EDD4';
    const step = 80;
    for (let x = 0; x < W; x += step) {
        // Эргэлдсэн сангарьд хээ
        ctx.fillRect(x + 8,  bandY + 8,  step - 16, 12);
        ctx.fillRect(x + 8,  bandY + 8,  12,        bandH - 24);
        ctx.fillRect(x + 28, bandY + 24, 24,        12);
        ctx.fillRect(x + 40, bandY + 24, 12,        24);
    }
    // Бүсний дээд/доод нарийн шугам
    ctx.fillStyle = blueD;
    ctx.fillRect(0, bandY - 4, W, 4);
    ctx.fillRect(0, bandY + bandH, W, 4);

    // ── Доод хэсэгт давтан байрлах "хас" тэмдэг ──
    function drawKhas(cx, cy, size, color) {
        const s = size;
        const t = Math.max(3, s * 0.14); // шугамын зузаан
        ctx.fillStyle = color;
        // Гол тэнхлэг босоо + хөндлөн
        ctx.fillRect(cx - t/2, cy - s/2, t, s);
        ctx.fillRect(cx - s/2, cy - t/2, s, t);
        // 4 үзүүрт "L" хэсэг — 90° эргэж байгаа хэв маягтай
        const a = s/2 - t/2;
        ctx.fillRect(cx - s/2, cy + a - t, s/2, t); // доод зүүн
        ctx.fillRect(cx - s/2, cy - a,      t, s/2 - t); // ?
        ctx.fillRect(cx + t/2, cy - s/2,   s/2, t);  // дээд баруун
        ctx.fillRect(cx + a - t, cy - s/2, t, s/2);
        ctx.fillRect(cx - s/2, cy - a + t, t, s/2 - t);
        ctx.fillRect(cx - a, cy - s/2, t, s/2);
    }

    // Төв хэсэг — тоймтой их том олзий/хас
    const midY = 260;
    // Том "хас" хээ цөөн тоогоор (4 тал руу харсан)
    for (let i = 0; i < 3; i++) {
        const cx = W * (i + 0.5) / 3;
        const r  = 60;
        // Гадна дөрвөлжин хүрээ
        ctx.strokeStyle = blue;
        ctx.lineWidth = 8;
        ctx.strokeRect(cx - r - 16, midY - r - 16, (r + 16) * 2, (r + 16) * 2);
        drawKhas(cx, midY, r * 1.4, blue);
    }

    // ── Доод улаан зах шугам (эсгийн гүрмэл бүс) ──
    ctx.fillStyle = '#A03020';
    ctx.fillRect(0, H - 24, W, 24);
    ctx.fillStyle = '#6E1A10';
    ctx.fillRect(0, H - 4, W, 4);

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 4;
    return tex;
}

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

        const kheeTex = _makeKheeTexture();
        kheeTex.repeat.set(1, 1); // нэг панелд нэг давталт
        const mat = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF, map: kheeTex,
            roughness: 0.9, metalness: 0, side: THREE.DoubleSide
        });

        // CylinderGeometry дотор theta=0 → +Z, theta=π/2 → +X (x=sin θ, z=cos θ).
        // Хаалга нь +X тэнхлэгт байгаа тул цоорхойг theta=π/2 дээр төвлөрүүлнэ.
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

        // Улаан зах хасагдсан (хэрэглэгчийн хүсэлтээр)
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
