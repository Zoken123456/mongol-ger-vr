import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';

// ── Classes-ийн import ───────────────────────────────────────────
import { Khana }   from './classes/khana.js';
import { Door }    from './classes/door.js';
import { Bagana }  from './classes/bagana.js';
import { Toono }   from './classes/toono.js';
import { Uni }     from './classes/uni.js';
import { Tuurga }  from './classes/tuurga.js';
import { Bvsluur } from './classes/bvsluur.js';

// ══════════════════════════════════════════════════════════════════
// PROCEDURAL TEXTURE HELPERS — noise-based normal/roughness maps
// ══════════════════════════════════════════════════════════════════
function _genNoiseCanvas(size, octaves, persist) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(size, size);
    const data = img.data;
    // Simple value noise (multi-octave Math.random + smooth)
    function rand2(x, y) {
        const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        return s - Math.floor(s);
    }
    function smooth(x, y, freq) {
        const ix = Math.floor(x * freq), iy = Math.floor(y * freq);
        const fx = x * freq - ix, fy = y * freq - iy;
        const v00 = rand2(ix, iy);
        const v10 = rand2(ix + 1, iy);
        const v01 = rand2(ix, iy + 1);
        const v11 = rand2(ix + 1, iy + 1);
        const u = fx * fx * (3 - 2 * fx);
        const v = fy * fy * (3 - 2 * fy);
        return (v00 * (1 - u) + v10 * u) * (1 - v) + (v01 * (1 - u) + v11 * u) * v;
    }
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let n = 0, amp = 1, freqMul = 1, total = 0;
            for (let o = 0; o < octaves; o++) {
                n += smooth(x / size, y / size, 8 * freqMul) * amp;
                total += amp;
                amp *= persist;
                freqMul *= 2;
            }
            n /= total;
            const v = Math.floor(n * 255);
            const i = (y * size + x) * 4;
            data[i] = data[i+1] = data[i+2] = v;
            data[i+3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
}

// Сүлжсэн ноостой texture (ноосон normal + жижиг variation)
function _makeWoolTextures() {
    const size = 256;
    const noise = _genNoiseCanvas(size, 4, 0.55);
    const cdata = noise.getContext('2d').getImageData(0, 0, size, size).data;
    // Нормал map
    const normCv = document.createElement('canvas');
    normCv.width = normCv.height = size;
    const nctx = normCv.getContext('2d');
    const normImg = nctx.createImageData(size, size);
    const nd = normImg.data;
    const strength = 2.5;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            const xp = ((y * size + Math.min(x+1, size-1)) * 4);
            const xm = ((y * size + Math.max(x-1, 0)) * 4);
            const yp = ((Math.min(y+1, size-1) * size + x) * 4);
            const ym = ((Math.max(y-1, 0) * size + x) * 4);
            const dx = (cdata[xp] - cdata[xm]) / 255 * strength;
            const dy = (cdata[yp] - cdata[ym]) / 255 * strength;
            const len = Math.sqrt(dx*dx + dy*dy + 1);
            nd[i]   = (-dx / len * 0.5 + 0.5) * 255;
            nd[i+1] = (-dy / len * 0.5 + 0.5) * 255;
            nd[i+2] = (1   / len * 0.5 + 0.5) * 255;
            nd[i+3] = 255;
        }
    }
    nctx.putImageData(normImg, 0, 0);
    const norm = new THREE.CanvasTexture(normCv);
    norm.wrapS = norm.wrapT = THREE.RepeatWrapping;
    norm.repeat.set(2, 2);
    // Roughness map (ноос бараг бүгд rough)
    const rough = new THREE.CanvasTexture(noise);
    rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
    rough.repeat.set(2, 2);
    return { normalMap: norm, roughnessMap: rough };
}

// Модны grain — нарийн босоо зураастай
function _makeWoodTextures() {
    const w = 256, h = 256;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            // Босоо grain (Y-аар лагшилсан) + санамсаргүй жижиг variation
            const base = 0.5 + 0.4 * Math.sin(y * 0.18 + Math.sin(x * 0.04) * 1.2);
            const noise = (Math.random() - 0.5) * 0.15;
            const v = Math.max(0, Math.min(1, base + noise));
            const i = (y * w + x) * 4;
            d[i] = d[i+1] = d[i+2] = Math.floor(v * 255);
            d[i+3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 2);
    return { roughnessMap: t };
}

// Globals (хойно ашиглана)
const _woolMaps = _makeWoolTextures();
const _woodMaps = _makeWoodTextures();

// ══════════════════════════════════════════════════════════════════
// MINECRAFT-STYLE PIXEL TEXTURES
// ══════════════════════════════════════════════════════════════════
function _mkTex(fn, size = 16) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    fn(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

// Shared scatter helper — random pixel noise from palette
function _scatter(ctx, s, palette, density) {
    for (let i = 0; i < s * s * density; i++) {
        ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
        ctx.fillRect(Math.floor(Math.random() * s), Math.floor(Math.random() * s), 1, 1);
    }
}

const MCTex = {
    grass: _mkTex((ctx, s) => {
        ctx.fillStyle = '#5A9128'; ctx.fillRect(0,0,s,s);
        _scatter(ctx, s, ['#4A8020','#6AAE2E','#50881C','#3E7020','#628E24'], 0.5);
    }, 32),
    dirt: _mkTex((ctx, s) => {
        ctx.fillStyle = '#8B6040'; ctx.fillRect(0,0,s,s);
        _scatter(ctx, s, ['#7A5030','#9A7050','#6A4028','#A08058'], 0.35);
    }, 16),
    wood: _mkTex((ctx, s) => {
        ctx.fillStyle = '#8B5A2B'; ctx.fillRect(0,0,s,s);
        for (let y = 0; y < s; y += 4) { ctx.fillStyle = '#6A3A18'; ctx.fillRect(0,y,s,1); }
        _scatter(ctx, s, ['#7A4820','#6A3818'], 0.08);
    }, 16),
    darkWood: _mkTex((ctx, s) => {
        ctx.fillStyle = '#5A2808'; ctx.fillRect(0,0,s,s);
        for (let y = 0; y < s; y += 4) { ctx.fillStyle = '#3A1808'; ctx.fillRect(0,y,s,1); }
        _scatter(ctx, s, ['#481E08','#3A1808'], 0.06);
    }, 16),
    felt: _mkTex((ctx, s) => {
        ctx.fillStyle = '#CC0018'; ctx.fillRect(0,0,s,s);
        _scatter(ctx, s, ['#B80014','#E20020','#A8001A','#D8001A'], 0.3);
    }, 16),
    whiteFelt: _mkTex((ctx, s) => {
        ctx.fillStyle = '#E8E4D8'; ctx.fillRect(0,0,s,s);
        _scatter(ctx, s, ['#D8D4C8','#F0EDE4','#DCDAD0'], 0.25);
    }, 16),
    stone: _mkTex((ctx, s) => {
        ctx.fillStyle = '#8A8878'; ctx.fillRect(0,0,s,s);
        _scatter(ctx, s, ['#787068','#9A9888','#686858','#A0A090'], 0.3);
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = '#585850';
            ctx.fillRect(Math.floor(Math.random()*(s-4)), Math.floor(Math.random()*(s-4)), Math.ceil(Math.random()*4), 1);
        }
    }, 16),
    gold: _mkTex((ctx, s) => {
        ctx.fillStyle = '#FFD700'; ctx.fillRect(0,0,s,s);
        _scatter(ctx, s, ['#E8C200','#FFE030','#D4AA00'], 0.25);
    }, 16),
    metal: _mkTex((ctx, s) => {
        ctx.fillStyle = '#686870'; ctx.fillRect(0,0,s,s);
        for (let i = 0; i < s*s*0.2; i++) {
            const v = Math.floor(80 + Math.random()*60);
            ctx.fillStyle = `rgb(${v},${v},${v+8})`;
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 1, 1);
        }
    }, 16),
    carpet: _mkTex((ctx, s) => {
        ctx.fillStyle = '#AA1500'; ctx.fillRect(0,0,s,s);
        for (let x = 0; x < s; x += 4) { ctx.fillStyle = '#880000'; ctx.fillRect(x,0,1,s); }
        for (let y = 0; y < s; y += 4) { ctx.fillStyle = '#880000'; ctx.fillRect(0,y,s,1); }
        for (let x = 2; x < s; x += 4)
            for (let y = 2; y < s; y += 4)
                { ctx.fillStyle = '#FFD700'; ctx.fillRect(x-1,y-1,2,2); }
    }, 16),
};

// Material helper — clones texture internally so repeat changes don't corrupt shared instances
function MCMat(color, map, rep = 4, rough = 0.85, metal = 0) {
    const t = map ? map.clone() : null;
    if (t) t.repeat.set(rep, rep);
    return new THREE.MeshStandardMaterial({ color, map: t, roughness: rough, metalness: metal });
}

// ══════════════════════════════════════════════════════════════════
// ДОТОР ТАВИЛГА (Furniture)
// ══════════════════════════════════════════════════════════════════
class Furniture {
    constructor() {
        this._group = new THREE.Group();
        this._group.name = 'furniture';
        this._parts = {};
        this._buildAll();
    }

    _buildAll() {
        this._parts.or      = this._buildOr();
        this._parts.zuuh    = this._buildZuuh();
        this._parts.shiree  = this._buildShiree();
        this._parts.avdar   = this._buildAvdar();
        this._parts.shrine  = this._buildShrine();
        this._parts.airag   = this._buildAirag();
        this._parts.kitchen = this._buildKitchen();
        this._parts.manArea = this._buildManArea();
        Object.values(this._parts).forEach(p => this._group.add(p));
    }

    // ── Ор (хойт талд — хаалгын эсрэг) ─────────────────────────────
    _buildOr() {
        const g      = new THREE.Group();
        const wood   = MCMat(0xFFFFFF, MCTex.darkWood, 3, 0.78);
        const felt   = MCMat(0xFFFFFF, MCTex.felt, 2, 0.92);
        const pillow = MCMat(0xFFFFFF, MCTex.whiteFelt, 2, 0.85);

        // Орны хайрцаг — хойт талд (−X), зүүн хэсэгт (−Z)
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.38, 2.1), wood);
        base.position.set(-3.8, 0.19, -0.4); g.add(base);

        // Улаан дэвсгэр
        const mat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.06, 1.95), felt);
        mat.position.set(-3.8, 0.41, -0.4); g.add(mat);

        // Дэр × 2
        [-0.55, 0.55].forEach(dz => {
            const p = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.16, 0.55), pillow);
            p.position.set(-3.8, 0.54, dz); g.add(p);
        });

        // Толгойн тулгуур
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 2.1), wood);
        head.position.set(-4.3, 0.47, -0.4); g.add(head);

        return g;
    }

    // ── Тулга (уламжлалт монгол 3 чулуут галын тулга) ─────────────
    _buildZuuh() {
        const g = new THREE.Group();

        const stoneMt = new THREE.MeshStandardMaterial({ color: 0x4A4840, roughness: 0.97, flatShading: true });
        const coalMt  = new THREE.MeshStandardMaterial({ color: 0x2A1A0A, roughness: 0.92 });
        const logMt   = new THREE.MeshStandardMaterial({ color: 0x3A1E0A, roughness: 0.95 });
        const charMt  = new THREE.MeshStandardMaterial({ color: 0x1A0E06, roughness: 0.98,
                            emissive: new THREE.Color(0x441000), emissiveIntensity: 0.6 });
        const emberMt = new THREE.MeshStandardMaterial({ color: 0xFF3300, roughness: 0.65,
                            emissive: new THREE.Color(0xFF1800), emissiveIntensity: 1.4 });
        const fire1Mt = new THREE.MeshStandardMaterial({ color: 0xFF5500, roughness: 0.4,
                            emissive: new THREE.Color(0xFF3000), emissiveIntensity: 1.6,
                            transparent: true, opacity: 0.92 });
        const fire2Mt = new THREE.MeshStandardMaterial({ color: 0xFFAA00, roughness: 0.4,
                            emissive: new THREE.Color(0xFF8800), emissiveIntensity: 1.1,
                            transparent: true, opacity: 0.85 });
        const fireCMt = new THREE.MeshStandardMaterial({ color: 0xFFFF88, roughness: 0.2,
                            emissive: new THREE.Color(0xFFEE55), emissiveIntensity: 2.4,
                            transparent: true, opacity: 0.78 });
        const potMt   = new THREE.MeshStandardMaterial({ color: 0x1A1A1A, roughness: 0.42, metalness: 0.8 });
        const ashMt   = new THREE.MeshStandardMaterial({ color: 0x787068, roughness: 0.98 });
        const tripMt  = new THREE.MeshStandardMaterial({ color: 0x282010, roughness: 0.96 });

        // ── 3 том тулгын чулуу ─────────────────────────────────────
        for (let i = 0; i < 3; i++) {
            const a  = (i / 3) * Math.PI * 2 - Math.PI / 6;
            const st = new THREE.Mesh(new THREE.SphereGeometry(0.27, 7, 5), stoneMt);
            st.scale.set(1.1 + Math.random()*0.12, 0.78 + Math.random()*0.1, 1.0 + Math.random()*0.1);
            st.position.set(Math.cos(a) * 0.4, 0.18, Math.sin(a) * 0.4);
            g.add(st);
        }

        // ── Үнс суурь ────────────────────────────────────────────────
        const ash = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.04, 12), ashMt);
        ash.position.set(0, 0.01, 0); g.add(ash);

        // ── Түлш — 3 бүдүүн мод гурвалжлан давхарласан ──────────────
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2;
            const log = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, 0.78, 8), logMt);
            log.rotation.z = Math.PI / 2;
            log.rotation.y = a;
            log.position.set(Math.cos(a) * 0.14, 0.07, Math.sin(a) * 0.14);
            g.add(log);
        }
        // Нүүрсэн мод (charred log at bottom)
        const char1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.52, 7), charMt);
        char1.rotation.z = 0.5;
        char1.position.set(-0.1, 0.06, 0.08); g.add(char1);

        // ── Хөөж буй нүүрс ──────────────────────────────────────────
        const coal = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.05, 10), coalMt);
        coal.position.set(0, 0.05, 0); g.add(coal);
        const embers = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.04, 10), emberMt);
        embers.position.set(0, 0.08, 0); g.add(embers);

        // ── Гал — 4 давхар конус ─────────────────────────────────────
        const fl1 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.52, 8), fire1Mt);
        fl1.position.set(0, 0.34, 0); g.add(fl1);
        const fl2 = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.72, 7), fire2Mt);
        fl2.position.set(0.025, 0.48, 0.015); g.add(fl2);
        const fl3 = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.42, 6), fireCMt);
        fl3.position.set(-0.01, 0.30, 0.01); g.add(fl3);
        const fl4 = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.22, 5), fireCMt);
        fl4.position.set(0, 0.18, 0); g.add(fl4);

        // ── Тогооны гурвалжин тулга (tripod) — 3 нарийн мод ─────────
        for (let i = 0; i < 3; i++) {
            const a   = (i / 3) * Math.PI * 2;
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.92, 6), tripMt);
            leg.position.set(Math.cos(a) * 0.22, 0.46, Math.sin(a) * 0.22);
            leg.rotation.z = -0.28 * Math.cos(a);
            leg.rotation.x =  0.28 * Math.sin(a);
            g.add(leg);
        }
        // Тогооны бариул (hanging ring)
        const hangRing = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 12), tripMt);
        hangRing.position.set(0, 0.92, 0); g.add(hangRing);

        // ── Тогоо — том, хар ─────────────────────────────────────────
        const pot = new THREE.Mesh(new THREE.SphereGeometry(0.30, 14, 11), potMt);
        pot.scale.set(1, 0.70, 1);
        pot.position.set(0, 0.88, 0); g.add(pot);
        const potRim = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.030, 8, 22), potMt);
        potRim.rotation.x = Math.PI * 0.5;
        potRim.position.set(0, 0.90, 0); g.add(potRim);
        // Тогооны таг
        const lid  = new THREE.Mesh(
            new THREE.SphereGeometry(0.27, 12, 7, 0, Math.PI*2, 0, Math.PI*0.38), potMt);
        lid.position.set(0, 0.92, 0); g.add(lid);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.038, 7, 5), potMt);
        knob.position.set(0, 1.06, 0); g.add(knob);

        // ── Галын дулааны гэрэл ──────────────────────────────────────
        const light = new THREE.PointLight(0xFF6600, 3.2, 10);
        light.position.set(0, 0.8, 0); g.add(light);

        return g;
    }

    // ── Монгол намхан ширээ + суудал ─────────────────────────────
    _buildShiree() {
        const g    = new THREE.Group();
        const wood = MCMat(0xFFFFFF, MCTex.wood, 3, 0.78);
        const red  = MCMat(0xFFFFFF, MCTex.felt, 2, 0.6);
        const gold = MCMat(0xFFFFFF, MCTex.gold, 2, 0.35, 0.5);

        // Баруун тал (зүүн хаалгаас) — +Z хэсэгт
        // Намхан ширээний тавцан
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.07, 0.75), wood);
        top.position.set(-1.0, 0.32, 3.5); g.add(top);

        // Улаан хүрэн
        const trim = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.75), red);
        trim.position.set(-1.0, 0.295, 3.5); g.add(trim);

        // Алтан чимэглэл
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.03, 0.04), gold);
        stripe.position.set(-1.0, 0.31, 3.15); g.add(stripe);

        // Хөлүүд (намхан)
        [[0.65, 0.28], [0.65, -0.28], [-0.65, 0.28], [-0.65, -0.28]].forEach(([dx, dz]) => {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.32, 0.07), wood);
            leg.position.set(-1.0 + dx, 0.16, 3.5 + dz); g.add(leg);
        });

        // Суудал × 2 (зэрэгцэн)
        [-0.55, 0.55].forEach(dz => {
            const s = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.5), wood);
            s.position.set(-1.0, 0.2, 3.5 + dz * 1.6); g.add(s);
            [[0.18, 0.16], [0.18, -0.16], [-0.18, 0.16], [-0.18, -0.16]].forEach(([dx2, dz2]) => {
                const sl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), wood);
                sl.position.set(-1.0 + dx2, 0.1, 3.5 + dz * 1.6 + dz2); g.add(sl);
            });
        });
        return g;
    }

    // ── Авдар × 2 (хойморьт — 2 арслантай) ──────────────────────
    _buildAvdar() {
        const g       = new THREE.Group();
        const wood    = MCMat(0xFFFFFF, MCTex.darkWood, 2, 0.75);
        const gold    = MCMat(0xFFFFFF, MCTex.gold, 2, 0.32, 0.6);
        const red     = MCMat(0xFFFFFF, MCTex.felt, 2, 0.6);
        const blue    = new THREE.MeshStandardMaterial({ color: 0x1A3E8C, roughness: 0.65 });
        const arslanM = MCMat(0xFFFFFF, MCTex.gold, 2, 0.28, 0.65);
        const maneM   = new THREE.MeshStandardMaterial({ color: 0xFF8800, roughness: 0.4, metalness: 0.5 });

        const arslan = (cx, cy, cz) => {
            const face = new THREE.Mesh(new THREE.CircleGeometry(0.068, 12), arslanM);
            face.position.set(cx, cy + 0.08, cz); g.add(face);
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                const ray = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.016, 0.01), maneM);
                ray.position.set(cx + Math.cos(a)*0.105, cy + 0.08 + Math.sin(a)*0.105, cz);
                ray.rotation.z = a; g.add(ray);
            }
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.065, 0.01), arslanM);
            body.position.set(cx, cy, cz); g.add(body);
            [-0.06, 0.06].forEach(lx => {
                const leg = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.064, 0.01), arslanM);
                leg.position.set(cx + lx, cy - 0.044, cz); g.add(leg);
            });
            const tail = new THREE.Mesh(
                new THREE.TorusGeometry(0.04, 0.011, 6, 12, Math.PI * 1.15), arslanM);
            tail.rotation.z = -0.45;
            tail.position.set(cx - 0.11, cy + 0.022, cz); g.add(tail);
        };

        // Хоёр авдар — зүүн ба баруун
        [[-1.0], [1.0]].forEach(([oz]) => {
            const bz = oz;   // x stays at -3.8, z offset
            const W = 1.1;
            const box = new THREE.Mesh(new THREE.BoxGeometry(W, 0.65, 0.62), wood);
            box.position.set(-3.8, 0.325, bz); g.add(box);
            const lid = new THREE.Mesh(new THREE.BoxGeometry(W, 0.07, 0.62), wood);
            lid.position.set(-3.8, 0.685, bz); g.add(lid);
            // Урд тал улаан
            const front = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, 0.58, 0.04), red);
            front.position.set(-3.8, 0.32, bz + 0.33); g.add(front);
            // Алтан хүрэн
            [0.56, 0.10].forEach(dy => {
                const fr = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.04, 0.04), gold);
                fr.position.set(-3.8, dy, bz + 0.35); g.add(fr);
            });
            // 2 арслан тус бүр авдарт
            [-0.24, 0.24].forEach(dx => {
                const bg = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.38, 0.03), blue);
                bg.position.set(-3.8 + dx, 0.33, bz + 0.34); g.add(bg);
                arslan(-3.8 + dx, 0.33, bz + 0.36);
            });
            // Бариул
            const h = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), gold);
            h.position.set(-3.8, 0.33, bz + 0.37); g.add(h);
        });

        return g;
    }

    // ── Хоймрын тавиур + бурхан + зул ──────────────────────────
    _buildShrine() {
        const g    = new THREE.Group();
        const wood = MCMat(0xFFFFFF, MCTex.darkWood, 2, 0.75);
        const gold = MCMat(0xFFFFFF, MCTex.gold, 2, 0.28, 0.65);
        const hot  = new THREE.MeshStandardMaterial({ color: 0xFF8800, roughness: 0.5,
                         emissive: new THREE.Color(0xFF4400), emissiveIntensity: 0.7 });
        const bowl = new THREE.MeshStandardMaterial({ color: 0xC8A800, roughness: 0.22, metalness: 0.88 });

        // Тавиур
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.07, 0.32), wood);
        shelf.position.set(-4.0, 1.35, 0); g.add(shelf);
        [-0.86, 0.86].forEach(dx => {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 0.06), wood);
            post.position.set(-4.0 + dx, 1.09, 0); g.add(post);
        });

        // Тахилын аяга × 5
        [-0.62, -0.31, 0, 0.31, 0.62].forEach(dx => {
            const b = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.038, 0.038, 12), bowl);
            b.position.set(-4.0 + dx, 1.408, 0); g.add(b);
        });

        // Зул (butter lamp) × 2 — гэрэлтэй
        [-0.82, 0.82].forEach(dx => {
            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.028, 0.052, 12), bowl);
            base.position.set(-4.0 + dx, 1.405, 0); g.add(base);
            const flame = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.058, 8), hot);
            flame.position.set(-4.0 + dx, 1.466, 0); g.add(flame);
            const light = new THREE.PointLight(0xFF8800, 0.5, 1.4);
            light.position.set(-4.0 + dx, 1.5, 0); g.add(light);
        });

        // Бурхны хүрэ (thangka frame)
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.54, 0.04), gold);
        frame.position.set(-4.45, 1.84, 0); g.add(frame);
        const thangka = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.025),
            new THREE.MeshStandardMaterial({ color: 0xCC7700, roughness: 0.65 }));
        thangka.position.set(-4.45, 1.84, 0.025); g.add(thangka);

        return g;
    }

    // ── Айрагны торсуур + аяга ───────────────────────────────────
    _buildAirag() {
        const g    = new THREE.Group();
        const wood = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.82 });
        const skin = new THREE.MeshStandardMaterial({ color: 0x4A2810, roughness: 0.9  });
        const bwl  = new THREE.MeshStandardMaterial({ color: 0xC8A800, roughness: 0.22, metalness: 0.88 });

        // Уяаны шон
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.15, 8), wood);
        post.position.set(1.8, 0.58, -3.0); g.add(post);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.04), wood);
        bar.position.set(1.8, 1.05, -3.0); g.add(bar);

        // Торсуур (арьсан уут)
        const bag = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skin);
        bag.scale.set(1.0, 1.35, 0.68);
        bag.position.set(1.8, 0.52, -3.0); g.add(bag);

        // Аяга
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.058, 12), bwl);
        bowl.position.set(2.25, 0.03, -3.0); g.add(bowl);

        return g;
    }

    // ── Эмэгтэй хүний гал тогооны хэсэг (зүүн/+Z тал) ──────────
    _buildKitchen() {
        const g       = new THREE.Group();
        const stoneMt = new THREE.MeshStandardMaterial({ color: 0x4A4840, roughness: 0.97 });
        const potMt   = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.45, metalness: 0.75 });
        const woodMt  = new THREE.MeshStandardMaterial({ color: 0x7B4A20, roughness: 0.88 });
        const fireMt  = new THREE.MeshStandardMaterial({ color: 0xFF5500, roughness: 0.5,
                            emissive: new THREE.Color(0xFF2200), emissiveIntensity: 1.1 });
        const clayMt  = new THREE.MeshStandardMaterial({ color: 0xC47840, roughness: 0.92 });
        const bwlMt   = new THREE.MeshStandardMaterial({ color: 0xC8A800, roughness: 0.22, metalness: 0.88 });

        const KX = -1.2, KZ = 3.8;   // гал тогооны төв

        // Тулга — 3 чулуу дугуйлсан
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2;
            const st = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), stoneMt);
            st.scale.set(1.1, 0.62, 0.95);
            st.position.set(KX + Math.cos(a)*0.2, 0.07, KZ + Math.sin(a)*0.2); g.add(st);
        }
        // Гал
        const fire = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 8), fireMt);
        fire.position.set(KX, 0.16, KZ); g.add(fire);
        const fireL = new THREE.PointLight(0xFF6600, 1.4, 4.0);
        fireL.position.set(KX, 0.45, KZ); g.add(fireL);

        // Тогоо — тулга дээр
        const pot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), potMt);
        pot.scale.set(1, 0.72, 1);
        pot.position.set(KX, 0.56, KZ); g.add(pot);
        // Тогооны ирмэг
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 20), potMt);
        rim.rotation.x = Math.PI * 0.5;
        rim.position.set(KX, 0.58, KZ); g.add(rim);

        // Модон сэрээ / хутга тавиур
        const shelfPost = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.95, 7), woodMt);
        shelfPost.position.set(KX + 0.7, 0.475, KZ); g.add(shelfPost);
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.2), woodMt);
        shelf.position.set(KX + 0.72, 0.88, KZ); g.add(shelf);

        // Аяга / сав (шавар + алтан) жижиг тавиур дээр
        [[-0.12, 0], [0, 0], [0.12, 0]].forEach(([dx, dz]) => {
            const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.04, 0.045, 10), bwlMt);
            bowl.position.set(KX + 0.72 + dx, 0.922, KZ + dz); g.add(bowl);
        });

        // Шавар тогоо (жижиг) — хажуу
        const claypot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), clayMt);
        claypot.scale.set(1, 1.1, 1);
        claypot.position.set(KX + 0.5, 0.14, KZ + 0.4); g.add(claypot);

        // Шавар тогооны ам
        const claytop = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.04, 10), clayMt);
        claytop.position.set(KX + 0.5, 0.26, KZ + 0.4); g.add(claytop);

        // Модон сэрээ/хоолой
        const ladle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 7), woodMt);
        ladle.rotation.z = 0.3;
        ladle.position.set(KX + 0.85, 0.9, KZ + 0.1); g.add(ladle);
        const ladleHead = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), woodMt);
        ladleHead.scale.set(1, 0.55, 1);
        ladleHead.position.set(KX + 0.7, 0.96, KZ + 0.1); g.add(ladleHead);

        return g;
    }

    // ── Эрэгтэй хүний хэсэг — сур, бугуйл, эмээл (баруун/−Z тал) ─
    _buildManArea() {
        const g      = new THREE.Group();
        const woodMt = new THREE.MeshStandardMaterial({ color: 0x6A3C18, roughness: 0.85 });
        const leatMt = new THREE.MeshStandardMaterial({ color: 0x3A1C08, roughness: 0.82 });
        const saddMt = new THREE.MeshStandardMaterial({ color: 0x5A2E0A, roughness: 0.78 });
        const metalMt= new THREE.MeshStandardMaterial({ color: 0x888070, roughness: 0.3, metalness: 0.85 });
        const ropeMt = new THREE.MeshStandardMaterial({ color: 0xC8A050, roughness: 0.9 });

        const MX = -1.5, MZ = -3.6;   // эрэгтэй хүний хэсгийн төв

        // Эмээлийн тавиур (A-frame stand)
        [[-0.22, 0.22]].forEach(([dx1, dx2]) => {
            [[dx1, -0.18], [dx1, 0.18], [dx2, -0.18], [dx2, 0.18]].forEach(([sx, sz]) => {
                const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.68, 7), woodMt);
                leg.rotation.z = sx > 0 ? -0.22 : 0.22;
                leg.position.set(MX + sx, 0.34, MZ + sz); g.add(leg);
            });
        });
        const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.4, 7), woodMt);
        topBar.rotation.z = Math.PI * 0.5;
        topBar.position.set(MX, 0.65, MZ); g.add(topBar);

        // Эмээл — арьсан дэр + урд/хойд дугуй
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.32), saddMt);
        seat.position.set(MX, 0.76, MZ); g.add(seat);
        // Урд ба хойд дугуй (pommel & cantle)
        [-0.2, 0.2].forEach(dx => {
            const arc = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.028, 8, 16, Math.PI), saddMt);
            arc.rotation.z = dx > 0 ? -0.15 : 0.15;
            arc.position.set(MX + dx, 0.82, MZ); g.add(arc);
        });
        // Дөрөө (stirrups) × 2
        [-0.05, 0.05].forEach(dz => {
            const strap = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.3, 0.016), leatMt);
            strap.position.set(MX - 0.26, 0.6, MZ + dz * 4); g.add(strap);
            const stirrup = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 6, 14), metalMt);
            stirrup.rotation.x = Math.PI * 0.5;
            stirrup.position.set(MX - 0.26, 0.44, MZ + dz * 4); g.add(stirrup);
        });

        // Ногт (bridle/halter) — ханад өлгөөтэй
        const hX = MX + 0.6, hZ = MZ - 0.3, hY = 1.35;
        const hook = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 6, 10, Math.PI), metalMt);
        hook.position.set(hX, hY + 0.04, hZ); g.add(hook);
        // Хошуу хэсэг (noseband loop)
        const nose = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.014, 7, 16), leatMt);
        nose.position.set(hX, hY - 0.12, hZ); g.add(nose);
        // Хоолой оосор (throat latch strap)
        const strap1 = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.22, 0.014), leatMt);
        strap1.position.set(hX, hY - 0.03, hZ); g.add(strap1);

        // Сур (coiled rawhide rope) — газар дээр
        const surR = new THREE.TorusGeometry(0.16, 0.022, 7, 22);
        const sur1 = new THREE.Mesh(surR, ropeMt);
        sur1.rotation.x = Math.PI * 0.5;
        sur1.position.set(MX + 0.5, 0.022, MZ + 0.35); g.add(sur1);
        const sur2 = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 6, 18), ropeMt);
        sur2.rotation.x = Math.PI * 0.5;
        sur2.position.set(MX + 0.5, 0.044, MZ + 0.35); g.add(sur2);

        // Бугуйл (wristguard) — арьсан, ханад өлгөөтэй
        const bg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.042, 0.09, 10, 1, true), leatMt);
        bg.position.set(MX + 0.55, hY - 0.2, hZ + 0.22); g.add(bg);
        // Металл бэхэлгээ
        [0, 1].forEach(i => {
            const band = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.008, 6, 12), metalMt);
            band.rotation.x = Math.PI * 0.5;
            band.position.set(MX + 0.55, hY - 0.2 + i * 0.07, hZ + 0.22); g.add(band);
        });

        return g;
    }

    setVisible(name, v) {
        if (this._parts[name]) this._parts[name].visible = v;
    }

    getObject3D() { return this._group; }
}

// ══════════════════════════════════════════════════════════════════
// МОНГОЛ ГЭР — бүгдийг нэгтгэх класс
// ══════════════════════════════════════════════════════════════════
class MongolianGer {
    constructor(radius = 5, height = 4) {
        this.radius     = radius;
        this.height     = height;
        this.khanaRatio = 0.65;
        this._group     = new THREE.Group();
        this._group.name = 'ger';
        this.parts = {};

        this._khanas    = [];
        this._door      = null;
        this._furniture = null;

        this._build();
    }

    _build() {
        const R = this.radius, H = this.height, kr = this.khanaRatio;
        const wallH  = H * kr;
        const toonoR = 1.2;

        // ── 5 ХАНА ───────────────────────────────────────────────
        const doorAngle   = Math.PI / 10;
        const totalArc    = Math.PI * 2 - doorAngle;
        const arcPerPanel = totalArc / 5;
        let   currentAngle = doorAngle / 2;

        for (let i = 0; i < 5; i++) {
            const sa = currentAngle;
            const ea = currentAngle + arcPerPanel;

            const kh = new Khana(4, Math.max(6, 10), 0.5, R, H, kr, sa, ea);
            kh.place(0, 0, 0);
            this._group.add(kh.getObject());
            this._khanas.push(kh);

            currentAngle += arcPerPanel;
        }

        // ── ХААЛГА ────────────────────────────────────────────────
        // Khana: cos(a)→X, sin(a)→Z тул angle=0 = +X тэнхлэг дагуу
        // Гадагш харах: rotation.y = -PI/2 (local +Z → world +X)
        this._door = new Door(wallH, 1.1);
        const wallRadius = R - 0.05;
        this._door.place(wallRadius, 0, 0, -Math.PI / 2);
        this._door.getObject().translateZ(0.02);
        this._group.add(this._door.getObject());
        this.parts['door'] = this._door.getObject();

        // ── БАГАНА × 2 — хаалгатай перпендикуляр (Z тэнхлэг дагуу) ──
        const bagGroup = new THREE.Group(); bagGroup.name = 'bagana';
        // Багана z=±1.0 — тооно radius(1.2) дотор байна, roof дундуур гарахгүй
        // Иш+Далбаа+Тархи бүхий багана — тархийн гар toono ring-ийг тулна
        const b1 = new Bagana(H - 0.22, 0.055); b1.place(0, 0,  1.0);
        const b2 = new Bagana(H - 0.22, 0.055); b2.place(0, 0, -1.0);
        bagGroup.add(b1.getObject()); bagGroup.add(b2.getObject());
        this._group.add(bagGroup);
        this.parts['bagana'] = bagGroup;

        // ── ТООНО — жаахан дээшгүү бомбогор ─────────────────────
        const toonoY = H + 0.38;   // тооно бага зэрэг дээш — бомбогор хэлбэр
        const toono = new Toono(toonoR, 0.08, 12);
        toono.place(0, toonoY, 0);
        this._group.add(toono.getObject());
        this.parts['toono'] = toono.getObject();

        // ── УНЬ — доод захыг R-0.15 болгож дээвэр дотор орно ────
        const un = new Uni(52, R - 0.15, wallH, toonoY, toonoR - 0.06);
        un.place(0, 0, 0);
        this._group.add(un.getObject());
        this.parts['un'] = un.getObject();

        // ── ТУУРГА — 2 хэсэг ──────────────────────────────────────
        this._tuurga = new Tuurga(R, wallH, doorAngle);
        this._tuurga.place(0, 0, 0);
        this._group.add(this._tuurga.getObject());
        this.parts['tuurga'] = this._tuurga.getObject();

        // ── БҮСЛҮҮР — 3 ширхэг ───────────────────────────────────
        this._bvsluur = new Bvsluur(R, wallH, doorAngle);
        this._bvsluur.place(0, 0, 0);
        this._group.add(this._bvsluur.getObject());
        this.parts['bvsluur'] = this._bvsluur.getObject();

        // ── ДЭЭВЭР — нэг ширхэг ───────────────────────────────────
        const roofH = toonoY - wallH;
        const _roofMat = new THREE.MeshStandardMaterial({ color: 0xE8D8B0, roughness: 0.82, side: THREE.DoubleSide });
        const _roofMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(toonoR + 0.05, R + 0.05, roofH, 32, 1, true), _roofMat);
        _roofMesh.position.set(0, wallH + roofH / 2, 0);
        _roofMesh.castShadow = true; _roofMesh.receiveShadow = true;
        const _roofGroup = new THREE.Group(); _roofGroup.add(_roofMesh);
        this._group.add(_roofGroup);
        this.parts['roof'] = _roofGroup;


        // ── ДОТОР ТАВИЛГА ─────────────────────────────────────────
        this._furniture = new Furniture();
        this._group.add(this._furniture.getObject3D());
        this.parts['furniture'] = this._furniture.getObject3D();

        // ── ГАЗАР ─────────────────────────────────────────────────
        const floorGroup = new THREE.Group();

        // Шаргал модон шал (гол хэсэг)
        const floor = new THREE.Mesh(
            new THREE.CircleGeometry(R - 0.08, 64),
            new THREE.MeshStandardMaterial({ color: 0xD4A45A, roughness: 0.85, metalness: 0.0 }));
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0.01;
        floor.receiveShadow = true;
        floorGroup.add(floor);

        // Улаан дугуй хивс (голд) — Minecraft carpet texture
        const _carpTex = MCTex.carpet.clone(); _carpTex.repeat.set(6, 6);
        const carpet = new THREE.Mesh(
            new THREE.CircleGeometry(R * 0.55, 48),
            new THREE.MeshStandardMaterial({ color: 0xFFFFFF, map: _carpTex, roughness: 0.9 }));
        carpet.rotation.x = -Math.PI / 2;
        carpet.position.y = 0.015;
        carpet.receiveShadow = true;
        floorGroup.add(carpet);

        // Хивсний алтан тойрог хүрэн
        const ring1 = new THREE.Mesh(
            new THREE.RingGeometry(R * 0.53, R * 0.56, 48),
            new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide }));
        ring1.rotation.x = -Math.PI / 2;
        ring1.position.y = 0.02;
        floorGroup.add(ring1);

        // Гадна тойрог хүрэн зах
        const ring2 = new THREE.Mesh(
            new THREE.RingGeometry(R - 0.2, R - 0.05, 64),
            new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8, metalness: 0.0, side: THREE.DoubleSide }));
        ring2.rotation.x = -Math.PI / 2;
        ring2.position.y = 0.02;
        floorGroup.add(ring2);

        this._group.add(floorGroup);
        this.parts['floor'] = floorGroup;
    }

    setKhanaVisible(i, v) {
        if (i === -1) this._khanas.forEach(k => k.setVisible(v));
        else if (this._khanas[i]) this._khanas[i].setVisible(v);
    }

    setKhanaFold(i, r) {
        if (i === -1) this._khanas.forEach(k => k.setFoldRatio(r));
        else if (this._khanas[i]) this._khanas[i].setFoldRatio(r);
    }

    openDoor()  { if (this._door) this._door.open(); }
    closeDoor() { if (this._door) this._door.close(); }

    setFurnitureVis(name, v) { if (this._furniture) this._furniture.setVisible(name, v); }

    setPartVisibility(name, v) {
        if (this.parts[name]) this.parts[name].visible = v;
    }

    // ── Шинэ класс дэлгэрэнгүй хандалт ──────────────────────────
    getTuurga()  { return this._tuurga; }
    getBvsluur() { return this._bvsluur; }

    update(delta) {
        if (this._door) this._door.update(delta);
    }

    getObject3D()      { return this._group; }
    setPosition(x,y,z) { this._group.position.set(x, y, z); }

    explodeParts(distance = 3) {
        Object.entries(this.parts).forEach(([, obj], i) => {
            const angle = (i / Object.keys(this.parts).length) * Math.PI * 2;
            obj.position.x = Math.cos(angle) * distance;
            obj.position.z = Math.sin(angle) * distance;
        });
        this._khanas.forEach((k, i) => {
            const angle = (i / this._khanas.length) * Math.PI * 2;
            k.getObject().position.x = Math.cos(angle) * distance;
            k.getObject().position.z = Math.sin(angle) * distance;
        });
    }

    assembleParts() {
        Object.values(this.parts).forEach(obj => obj.position.set(0, 0, 0));
        this._khanas.forEach(k => k.getObject().position.set(0, 0, 0));
    }
}

// ══════════════════════════════════════════════════════════════════
// SCENE ТОХИРГОО
// ══════════════════════════════════════════════════════════════════
const scene = new THREE.Scene();

// Minecraft-style gradient sky background
let _daySkyTex;
(function buildSky() {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0,    '#1A3D8C');  // тэнгэрийн дээд хэсэг (хөх)
    grad.addColorStop(0.35, '#3A7EC8');  // дунд
    grad.addColorStop(0.68, '#78B8E8');  // доод хэсэг (цайвар)
    grad.addColorStop(0.82, '#C8E8F8');  // horizon цайвар
    grad.addColorStop(1,    '#E8F4F0');  // газрын ойролцоо
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2, 256);
    _daySkyTex = new THREE.CanvasTexture(c);
    _daySkyTex.magFilter = THREE.LinearFilter;
    scene.background = _daySkyTex;
})();

scene.fog = new THREE.FogExp2(0xA8D4F0, 0.006);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500);
camera.position.set(12, 7, 4);   // хаалга харагдахуйц байрлал

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ── PMREM IBL орчны гэрэлтүүлэг — PBR материалд бодит харагдалт өгнө ──
const _pmrem = new THREE.PMREMGenerator(renderer);
_pmrem.compileEquirectangularShader();
const _envScene = new RoomEnvironment();
const _envTex = _pmrem.fromScene(_envScene, 0.04).texture;
scene.environment = _envTex;
scene.environmentIntensity = 0.05;  // зөвхөн PBR тусгал — гэрэлтүүлэг бараг хийхгүй

// ── VR ТОХИРГОО ─────────────────────────────────────────────────
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// ── POST-PROCESSING (SSAO + Bloom + Color grading) — VR-д идэвхгүй болгоно ──

// Дулаан өнгөний шүүлтүүр (color grading)
const _ColorGradeShader = {
    uniforms: {
        tDiffuse:   { value: null },
        warmth:     { value: new THREE.Color(1.05, 0.99, 0.92) },
        saturation: { value: 1.12 },
        contrast:   { value: 1.06 },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform vec3 warmth;
        uniform float saturation;
        uniform float contrast;
        varying vec2 vUv;
        void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            // Saturation
            float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
            c.rgb = mix(vec3(l), c.rgb, saturation);
            // Contrast
            c.rgb = (c.rgb - 0.5) * contrast + 0.5;
            // Warm tint
            c.rgb *= warmth;
            // Vignette зөөлөн
            float d = length(vUv - 0.5);
            c.rgb *= 1.0 - smoothstep(0.45, 0.85, d) * 0.18;
            gl_FragColor = c;
        }
    `,
};

const _composer = new EffectComposer(renderer);
function _initComposer(cam) {
    _composer.passes.length = 0;
    _composer.addPass(new RenderPass(scene, cam));
    // SSAO — гүн бараан туяа объектуудын зайнд
    const _ssao = new SSAOPass(scene, cam, innerWidth, innerHeight);
    _ssao.kernelRadius = 0.4;
    _ssao.minDistance  = 0.0008;
    _ssao.maxDistance  = 0.04;
    _ssao.output = SSAOPass.OUTPUT.Default;
    _composer.addPass(_ssao);
    // Bloom
    const _bloom = new UnrealBloomPass(
        new THREE.Vector2(innerWidth, innerHeight),
        0.10, 0.45, 0.96
    );
    _composer.addPass(_bloom);
    // Color grading
    _composer.addPass(new ShaderPass(_ColorGradeShader));
    // Output
    _composer.addPass(new OutputPass());
}
_initComposer(camera);

// VR товч (WebXR дэмжигддэг браузерт харагдана)
const vrButton = VRButton.createButton(renderer);
vrButton.style.bottom = '30px';
document.body.appendChild(vrButton);

// VR горимд тохируулах гэрэл — listener-ийн өмнө зарлана
const _vrFill = new THREE.PointLight(0xFFEEDD, 0.8, 12);
_vrFill.position.set(0, 2.5, 0);

// VR горимд тохиргоо — нэг listener дотор нэгтгэсэн
// ВАЖНО: xr.getCamera().position-ийг кадр тутамд WebXR tracking дарна,
// иймд хэрэглэгчийг зөөхдөө parent (rig)-ийг л шилжүүлнэ.
// Гэрийн хаалга +X тэнхлэгт байрласан тул rig-ийг хаалганы урд (+X-ийн гадна)
// тавьж, тэдний "урагш" (-Z local) нь дэлхийн -X руу (хаалга руу) харуулна.
renderer.xr.addEventListener('sessionstart', () => {
    const xrCam = renderer.xr.getCamera();
    const rig = xrCam.parent;
    if (rig) {
        rig.position.set(6, 0, 0);
        rig.rotation.y = Math.PI / 2;  // -Z local → -X world (хаалганы зүг)
        rig.updateMatrixWorld(true);
    }
    scene.add(_vrFill);
});
renderer.xr.addEventListener('sessionend', () => {
    const rig = renderer.xr.getCamera().parent;
    if (rig) { rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); }
    scene.remove(_vrFill);
});

// ── VR CONTROLLERS — Teleportation + Ray interaction ─────────────
// Teleport indicator (Minecraft portal-like ring)
const _tpMat = new THREE.MeshBasicMaterial({
    color: 0x44DDFF, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false
});
const _tpRing = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.48, 20), _tpMat);
_tpRing.rotation.x = -Math.PI / 2;
_tpRing.visible = false;
scene.add(_tpRing);

// Teleport indicator inner dot — no rotation needed, parent already rotated
const _tpDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.1, 12),
    new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.55, depthWrite: false })
);
_tpDot.position.y = 0.003;
_tpRing.add(_tpDot);

// VR Controller hand meshes (Minecraft blocky hand)
function _makeVRHand(color = 0xF4C090) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    // Palm block
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.04), mat);
    g.add(palm);
    // Finger blocks
    [-0.024, -0.008, 0.008, 0.024].forEach((fx, i) => {
        const len = i === 0 || i === 3 ? 0.038 : 0.05;
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.013, len, 0.013), mat);
        f.position.set(fx, 0.045 + len / 2, 0);
        g.add(f);
    });
    // Thumb
    const th = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.036, 0.013), mat);
    th.position.set(0.042, 0.01, 0); th.rotation.z = -0.6;
    g.add(th);
    return g;
}

// Ray beam geometry
function _makeRayBeam(color = 0x44CCFF) {
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -10)]);
    return new THREE.Line(geo, new THREE.LineBasicMaterial({
        color, transparent: true, opacity: 0.5, linewidth: 2
    }));
}

const _vrCtrl = [0, 1].map(i => {
    const ctrl = renderer.xr.getController(i);
    const hand = _makeVRHand(i === 0 ? 0xF4C090 : 0xE8B480);
    const ray  = _makeRayBeam(i === 0 ? 0x44CCFF : 0xFF6644);
    ctrl.add(hand);
    ctrl.add(ray);
    scene.add(ctrl);
    return { ctrl, hand, ray, tpReady: false };
});

// ── VR 3D МЕНЮ ── зүүн гарт наалдана, баруун гараар луч чиглүүлж дарна
const _VR_COLS = 4, _VR_ROWS = 8;
const _VR_CV_W = 640, _VR_CV_H = 1024;
const _VR_BW = _VR_CV_W / _VR_COLS;
const _VR_BH = _VR_CV_H / _VR_ROWS;

// Хэсгийн харуулах/нуух toggle — web UI-ийн checkbox-тэй нийлдэг
const _vrTogglePart = (name) => {
    const cb = document.getElementById('check-' + name);
    const v = !(cb?.checked ?? true);
    if (cb) cb.checked = v;
    window.handlePartVisibility(name, v);
};
const _vrToggleAll = () => {
    const cb = document.getElementById('check-all');
    const v = !(cb?.checked ?? true);
    if (cb) cb.checked = v;
    window.handlePartVisibility('all', v);
};

// VR-ын хувьд rig-ийг шилжүүлэн "гадаа/дотор/гарах" хийнэ (walkControls.lock нь VR-д ажиллахгүй)
const _vrTeleportRig = (x, z, ry = Math.PI / 2) => {
    if (!renderer.xr.isPresenting) return;
    const xrCam = renderer.xr.getCamera();
    const rig = xrCam.parent;
    if (!rig) return;
    rig.position.set(x, 0, z);
    rig.rotation.y = ry;
    rig.updateMatrixWorld(true);
};
const _vrWalkOutside = () => _vrTeleportRig(8, 12, Math.PI);      // гадуур — ~8м зайд
const _vrWalkInside  = () => _vrTeleportRig(0, 3.5, Math.PI);     // дотор — хаалган дотор
const _vrWalkExit    = () => _vrTeleportRig(6, 0, Math.PI / 2);   // анхны спавн

const _vrMenuButtons = [
    // Row 1 — Үндсэн үйлдлүүд
    { label: 'ГЭР БАРИХ',  color: '#1E4E8C', action: () => window.buildGer() },
    { label: 'БҮГД',        color: '#3A5A3A', action: () => _vrToggleAll() },
    { label: 'ЭВХЭХ',       color: '#555555', action: () => window.setAllFold(0.12) },
    { label: 'ДЭЛГЭХ',      color: '#555555', action: () => window.setAllFold(1.0) },
    // Row 2 — Ханын scroll (4 slot-ыг нэгтгэсэн slider)
    { label: 'ХАНА', color: '#D89030', isSlider: true, action: () => {} },
    { label: '',     color: '#D89030', isSlider: true, action: () => {} },
    { label: '',     color: '#D89030', isSlider: true, action: () => {} },
    { label: '',     color: '#D89030', isSlider: true, action: () => {} },
    // Row 3 — Хаалга, эргүүлэх, буцах
    { label: 'ХААЛГА НЭЭХ', color: '#2A6E1A', action: () => window.openDoor() },
    { label: 'ХААЛГА ХААХ', color: '#6E1A1A', action: () => window.closeDoor() },
    { label: 'ЭРГҮҮЛЭХ',    color: '#555555', action: () => window.toggleRotation() },
    { label: 'БУЦАХ',       color: '#555555', action: () => window.resetView() },
    // Row 4 — Явах горим + Суралцах
    { label: 'ГАДАА ЯВАХ',  color: '#2A6E1A', action: () => _vrWalkOutside() },
    { label: 'ДОТОР ОРОХ',  color: '#2A6E1A', action: () => _vrWalkInside() },
    { label: 'ГАРАХ',       color: '#6E1A1A', action: () => _vrWalkExit() },
    { label: 'СУРАЛЦАХ',    color: '#5E4A1A', action: () => window.toggleLearnMode() },
    // Row 5 — Хана 1-4
    { label: 'ХАНА 1',      color: '#4A4030', action: () => window.toggleKhana(0) },
    { label: 'ХАНА 2',      color: '#4A4030', action: () => window.toggleKhana(1) },
    { label: 'ХАНА 3',      color: '#4A4030', action: () => window.toggleKhana(2) },
    { label: 'ХАНА 4',      color: '#4A4030', action: () => window.toggleKhana(3) },
    // Row 6 — Хана 5 + модон хэсэг
    { label: 'ХАНА 5',      color: '#4A4030', action: () => window.toggleKhana(4) },
    { label: 'ХААЛГА',      color: '#5A3A1A', action: () => _vrTogglePart('door') },
    { label: 'БАГАНА',      color: '#5A3A1A', action: () => _vrTogglePart('bagana') },
    { label: 'ТООНО',       color: '#5A3A1A', action: () => _vrTogglePart('toono') },
    // Row 7 — Үлдсэн модон хэсэг + туурга
    { label: 'УНЬ',         color: '#5A3A1A', action: () => _vrTogglePart('un') },
    { label: 'ДЭЭВЭР',      color: '#5A3A1A', action: () => _vrTogglePart('roof') },
    { label: 'ГАДНА ТУУРГА', color: '#4A3A2A', action: () => _vrTogglePart('tuurga-1') },
    { label: 'ДОТОР ТУУРГА', color: '#4A3A2A', action: () => _vrTogglePart('tuurga-2') },
    // Row 8 — Бүслүүр + Наадам
    { label: 'ДООД БҮС',    color: '#3A3A4A', action: () => _vrTogglePart('bvsluur-1') },
    { label: 'ДУНД БҮС',    color: '#3A3A4A', action: () => _vrTogglePart('bvsluur-2') },
    { label: 'ДЭЭД БҮС',    color: '#3A3A4A', action: () => _vrTogglePart('bvsluur-3') },
    { label: 'НААДАМ',      color: '#A02828', action: () => window.toggleNaadam() },
    // Row 9 — Цаг агаар (1)
    { label: 'ӨДӨР/ШӨНӨ',   color: '#1E1E4E', action: () => window.toggleDayNight() },
    { label: 'AUTO ЦАГ',    color: '#1E1E4E', action: () => window.toggleAutoCycle() },
    { label: 'БОРОО',       color: '#1A3E5E', action: () => window.toggleRain() },
    { label: 'ЦАС',         color: '#3A5A7A', action: () => window.toggleSnow() },
    // Row 10 — Цаг агаар (2) + Дуу
    { label: 'МАНАН',       color: '#3A3A4A', action: () => window.toggleFog() },
    { label: 'ӨВӨЛ',        color: '#2E5E8A', action: () => window.toggleWinter() },
    { label: 'ДУУ',         color: '#4A2A5E', action: () => window.toggleSound() },
    { label: '',            color: '#2A2A2A', action: () => {} },
];

const _vrCanvas = document.createElement('canvas');
_vrCanvas.width = _VR_CV_W;
_vrCanvas.height = _VR_CV_H;
const _vrCtx = _vrCanvas.getContext('2d');
const _vrTex = new THREE.CanvasTexture(_vrCanvas);
_vrTex.minFilter = THREE.LinearFilter;
_vrTex.magFilter = THREE.LinearFilter;

const _vrMenuMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.64),
    new THREE.MeshBasicMaterial({ map: _vrTex, transparent: true, side: THREE.DoubleSide, depthTest: false })
);
_vrMenuMesh.renderOrder = 999;
// Цэсийг толгой дагасан group-д байршуулна — харааны талбарын төв хэсэгт,
// хаана ч очсон тогтмол харагдана.
const _vrMenuGroup = new THREE.Group();
_vrMenuMesh.position.set(0, -0.10, -0.65);      // голд, бага зэрэг доош, 65см өмнө
_vrMenuMesh.rotation.y = 0;                     // шууд камер руу харуулна
_vrMenuGroup.add(_vrMenuMesh);
scene.add(_vrMenuGroup);
_vrMenuMesh.visible = false;

// Цэсийн group-ийг VR камерын дагуу кадр тутамд дагуулна
const _vrCamPos = new THREE.Vector3();
const _vrCamQuat = new THREE.Quaternion();
function _tickVRMenuHeadLock() {
    if (!renderer.xr.isPresenting) return;
    const xrCam = renderer.xr.getCamera();
    xrCam.getWorldPosition(_vrCamPos);
    xrCam.getWorldQuaternion(_vrCamQuat);
    _vrMenuGroup.position.copy(_vrCamPos);
    _vrMenuGroup.quaternion.copy(_vrCamQuat);
}

let _vrHoverIdx = -1;
let _vrFlashIdx = -1;
let _vrFlashUntil = 0;
let _vrCurrentFold = 1.0;   // тухайн үеийн эвхэлтийн түвшин (0.12-1.0)
let _vrSliderFrac = -1;     // slider дээр hover болсон uv.x (сарних үед)

function _vrShade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 0xFF) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xFF) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xFF) + amt));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function _drawVRMenu() {
    const ctx = _vrCtx;
    ctx.fillStyle = '#2A2A2A';
    ctx.fillRect(0, 0, _VR_CV_W, _VR_CV_H);
    ctx.fillStyle = '#3C3C3C';
    ctx.fillRect(4, 4, _VR_CV_W - 8, _VR_CV_H - 8);

    const now = performance.now();
    const flashing = now < _vrFlashUntil;

    for (let i = 0; i < _vrMenuButtons.length; i++) {
        const btn = _vrMenuButtons[i];
        const col = i % _VR_COLS;
        const row = Math.floor(i / _VR_COLS);

        // Slider — бүх мөрийг нэг үргэлжилсэн бар болгон зурна
        if (btn.isSlider) {
            if (col !== 0) continue; // эхний slot дээр нэг л удаа зурна
            const sy = row * _VR_BH + 8;
            const sh = _VR_BH - 16;
            const sx = 8;
            const sw = _VR_CV_W - 16;
            // Арын хүрз
            ctx.fillStyle = '#1A1A1A';
            ctx.fillRect(sx, sy, sw, sh);
            ctx.fillStyle = '#3A2A1A';
            ctx.fillRect(sx + 2, sy + 2, sw - 4, sh - 4);
            // Одоогийн эвхэлтийн түвшин (дүүргэлт)
            const fillW = Math.max(0, sw * _vrCurrentFold);
            const fillGrad = ctx.createLinearGradient(sx, sy, sx + fillW, sy);
            fillGrad.addColorStop(0, '#B87020');
            fillGrad.addColorStop(1, '#F0A840');
            ctx.fillStyle = fillGrad;
            ctx.fillRect(sx, sy, fillW, sh);
            // Hover preview шугам
            if (_vrSliderFrac >= 0 && i === _vrHoverIdx) {
                const px = sx + sw * _vrSliderFrac;
                ctx.fillStyle = 'rgba(255,255,255,0.22)';
                ctx.fillRect(sx, sy, px - sx, sh);
            }
            // Handle — одоогийн утгын байрлал
            const hx = sx + fillW;
            ctx.fillStyle = '#FFE9B0';
            ctx.fillRect(hx - 6, sy - 5, 12, sh + 10);
            // Шошго
            ctx.fillStyle = '#FFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 24px "Segoe UI", sans-serif';
            ctx.fillText(`ХАНА  —  ${Math.round(_vrCurrentFold * 100)}%`,
                sx + sw / 2, sy + sh / 2);
            continue;
        }

        const x = col * _VR_BW + 8;
        const y = row * _VR_BH + 8;
        const w = _VR_BW - 16;
        const h = _VR_BH - 16;

        const isHover = i === _vrHoverIdx;
        const isFlash = flashing && i === _vrFlashIdx;

        ctx.fillStyle = isFlash ? '#FFFF55' : (isHover ? _vrShade(btn.color, 40) : btn.color);
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#CCCCCC';
        ctx.fillRect(x, y, w, 5);
        ctx.fillRect(x, y, 5, h);
        ctx.fillStyle = '#0A0A0A';
        ctx.fillRect(x, y + h - 5, w, 5);
        ctx.fillRect(x + w - 5, y, 5, h);

        ctx.fillStyle = isFlash ? '#000' : '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const parts = btn.label.split(' ');
        if (parts.length >= 2) {
            ctx.font = 'bold 22px "Segoe UI", sans-serif';
            ctx.fillText(parts[0], x + w / 2, y + h / 2 - 14);
            ctx.fillText(parts.slice(1).join(' '), x + w / 2, y + h / 2 + 14);
        } else {
            ctx.font = 'bold 26px "Segoe UI", sans-serif';
            ctx.fillText(btn.label, x + w / 2, y + h / 2);
        }
    }

    _vrTex.needsUpdate = true;
}
_drawVRMenu();

// VR session эхэлсэн/дууссанд цэсийг эхэнд нуусан — A/X товчоор гаргана
renderer.xr.addEventListener('sessionstart', () => { _vrMenuMesh.visible = false; });
renderer.xr.addEventListener('sessionend',   () => { _vrMenuMesh.visible = false; });

// A (right) эсвэл X (left) товчийг дарахад цэсийг toggle хийнэ
// Controller gamepad mapping: buttons[4] = A/X (үндсэн төрлийн Oculus/Quest controller)
let _vrMenuBtnPrev = false;
function _pollVRMenuToggle() {
    if (!renderer.xr.isPresenting) return;
    const session = renderer.xr.getSession();
    if (!session) return;
    let pressed = false;
    for (const src of session.inputSources) {
        if (src.gamepad && src.gamepad.buttons[4] && src.gamepad.buttons[4].pressed) {
            pressed = true;
            break;
        }
    }
    if (pressed && !_vrMenuBtnPrev) {
        _vrMenuMesh.visible = !_vrMenuMesh.visible;
        if (_vrMenuMesh.visible) _drawVRMenu();
    }
    _vrMenuBtnPrev = pressed;
}

// Controller events — select = trigger (teleport / menu click), squeeze = grip (door)
_vrCtrl.forEach((entry, idx) => {
    entry.ctrl.addEventListener('selectstart', () => { entry.tpReady = true; });
    entry.ctrl.addEventListener('selectend', () => {
        entry.tpReady = false;
        // Хэрэв ямар нэгэн гар цэс дээр луч тогтоосон бол — тэр товчийг дар
        if (_vrHoverIdx >= 0) {
            const btn = _vrMenuButtons[_vrHoverIdx];
            _vrFlashIdx = _vrHoverIdx;
            _vrFlashUntil = performance.now() + 200;
            // Slider — uv.x-ийг ашиглан эвхэлтийн түвшинг тогтооно
            if (btn.isSlider && _vrSliderFrac >= 0) {
                const fold = Math.max(0.12, Math.min(1.0, 0.12 + _vrSliderFrac * 0.88));
                _vrCurrentFold = fold;
                if (window.setAllFold) window.setAllFold(fold);
                _drawVRMenu();
                _tpRing.visible = false;
                return;
            }
            _drawVRMenu();
            try { btn.action(); } catch (e) { console.error('VR menu action error:', e); }
            _tpRing.visible = false;
            return;
        }
        // Teleport — rig rotation-ийг тооцож, world-space delta-гаар шилжүүлнэ
        if (_tpRing.visible) {
            const pos = _tpRing.position;
            const xrCam = renderer.xr.getCamera();
            const rig = xrCam.parent;
            if (rig) {
                const camWorld = new THREE.Vector3();
                xrCam.getWorldPosition(camWorld);
                rig.position.x += pos.x - camWorld.x;
                rig.position.z += pos.z - camWorld.z;
            }
            _tpRing.visible = false;
        }
    });
    // Squeeze (grip) = хаалга нээх/хаах
    entry.ctrl.addEventListener('squeezestart', () => {
        ger.openDoor();
        setTimeout(() => ger.closeDoor(), 3000);
    });
});

// VR raycaster + pre-allocated scratch objects (avoid GC pressure in hot path)
const _vrRay      = new THREE.Raycaster();
const _vrOrigin   = new THREE.Vector3();
const _vrDir      = new THREE.Vector3();
const _vrQuat     = new THREE.Quaternion();

function _tickVRControllers() {
    if (!renderer.xr.isPresenting) { _tpRing.visible = false; _vrHoverIdx = -1; return; }

    const prevHover = _vrHoverIdx;
    const prevSlider = _vrSliderFrac;
    _vrHoverIdx = -1;
    _vrSliderFrac = -1;
    let anyTp = false;

    _vrCtrl.forEach(({ ctrl, ray, tpReady }, idx) => {
        if (!ctrl.visible) return;

        ctrl.getWorldPosition(_vrOrigin);
        ctrl.getWorldQuaternion(_vrQuat);
        _vrDir.set(0, 0, -1).applyQuaternion(_vrQuat);
        _vrRay.set(_vrOrigin, _vrDir);

        // 1) Эхлээд цэстэй огтлолцож байгаа эсэхийг шалгана — аль ч гараар дарж болно
        let hitMenu = false;
        if (_vrMenuMesh.visible) {
            const mh = _vrRay.intersectObject(_vrMenuMesh);
            if (mh.length > 0 && mh[0].uv) {
                const uv = mh[0].uv;
                const col = Math.min(_VR_COLS - 1, Math.floor(uv.x * _VR_COLS));
                const row = Math.min(_VR_ROWS - 1, Math.floor((1 - uv.y) * _VR_ROWS));
                const bi = row * _VR_COLS + col;
                if (bi >= 0 && bi < _vrMenuButtons.length) {
                    _vrHoverIdx = bi;
                    hitMenu = true;
                    // Slider дээр uv.x хадгална — селект үед энэ хувь нь fold болно
                    if (_vrMenuButtons[bi].isSlider) {
                        _vrSliderFrac = Math.max(0, Math.min(1, uv.x));
                    } else {
                        _vrSliderFrac = -1;
                    }
                    ray.scale.z = _vrOrigin.distanceTo(mh[0].point) / 10;
                    ray.material.opacity = 0.9;
                }
            }
        }
        if (hitMenu) return;

        // 2) Teleport луч — зөвхөн trigger даралттай байхад
        if (!tpReady) { ray.scale.z = 1; ray.material.opacity = 0.35; return; }

        const hits = _vrRay.intersectObject(ground);
        if (hits.length > 0) {
            _tpRing.position.copy(hits[0].point).setY(0.01);
            _tpRing.visible = true;
            anyTp = true;
            ray.scale.z = _vrOrigin.distanceTo(hits[0].point) / 10;
            ray.material.opacity = 0.85;
        } else {
            ray.scale.z = 1;
            ray.material.opacity = 0.35;
        }
    });

    if (!anyTp) _tpRing.visible = false;

    // Hover солигдсон, slider дээр гулсуулж байгаа, эсвэл flash үргэлжилж байвал menu-г дахин зур
    if (_vrHoverIdx !== prevHover || Math.abs(_vrSliderFrac - prevSlider) > 0.003 ||
        performance.now() < _vrFlashUntil) {
        _drawVRMenu();
    }
}


const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2.5, 0);
controls.enableDamping = true;
controls.minDistance = 3;
controls.maxDistance = 50;
controls.update();

// ── Гэрэл (дипломын чанар) ──────────────────────────────────────
// Тэнгэр/газар тусгал
const hemi = new THREE.HemisphereLight(0xC8E8FF, 0x8B7355, 0.9);
scene.add(hemi);

// Нар (сүүдэртэй)
const sun = new THREE.DirectionalLight(0xFFD498, 2.6);  // golden-hour дулаан өнгө
sun.position.set(10, 18, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far  = 60;
sun.shadow.camera.left = sun.shadow.camera.bottom = -16;
sun.shadow.camera.right = sun.shadow.camera.top   =  16;
sun.shadow.bias = -0.001;
scene.add(sun);

// Нэмэлт зөөлөн гэрэл (сүүдрийг тэнцвэржүүлнэ)
const fill = new THREE.DirectionalLight(0xD0E8FF, 0.6);
fill.position.set(-8, 5, -5);
scene.add(fill);

// Гадна газар — олон ногоон өнгийн нойстой текстур (зурагт хайстай ойртуулна)
function _makeGrassTexture(size = 512) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    // Суурь дунд ногоон
    ctx.fillStyle = '#5C8838';
    ctx.fillRect(0, 0, size, size);
    // Том толбонуудаар variation
    const patches = ['#3E6820', '#79A848', '#8FB860', '#4A7028', '#67923C', '#5A8030'];
    for (let i = 0; i < 240; i++) {
        ctx.fillStyle = patches[Math.floor(Math.random() * patches.length)] + (
            Math.floor(60 + Math.random() * 80).toString(16).padStart(2, '0')
        );
        const x = Math.random() * size;
        const y = Math.random() * size;
        ctx.beginPath();
        ctx.arc(x, y, 8 + Math.random() * 24, 0, Math.PI * 2);
        ctx.fill();
    }
    // Жижиг өвсний шугам
    ctx.lineWidth = 1;
    for (let i = 0; i < 1500; i++) {
        ctx.strokeStyle = patches[Math.floor(Math.random() * patches.length)];
        const x = Math.random() * size;
        const y = Math.random() * size;
        const len = 1.5 + Math.random() * 3;
        const ang = Math.random() * Math.PI;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
        ctx.stroke();
    }
    // Маш жижиг толбо noise
    for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = `rgba(${30 + Math.floor(Math.random()*40)},${80 + Math.floor(Math.random()*60)},${20 + Math.floor(Math.random()*40)},0.4)`;
        ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
}
const _grassTex = _makeGrassTexture();
_grassTex.repeat.set(40, 40);
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({
        color:     0xFFFFFF,
        map:       _grassTex,
        roughness: 0.92,
        metalness: 0.0
    }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Dirt border edge (Minecraft дэлхийн ирмэг мэт)
const _dirtTex = MCTex.dirt.clone();
_dirtTex.repeat.set(80, 2);
const groundEdge = new THREE.Mesh(
    new THREE.BoxGeometry(202, 0.5, 202),
    new THREE.MeshStandardMaterial({ color: 0xFFFFFF, map: _dirtTex, roughness: 0.97 })
);
groundEdge.position.y = -0.26;
scene.add(groundEdge);

// ── АЛС ХОЛЫН ТОЛГОД, УУЛС — Монголын талын бодит харагдах байдал ──
(function addDistantHills() {
    const hillGrp = new THREE.Group();
    // 2 давхар — ойр ногоон толгод + хол бараан уулс
    const layers = [
        { r: 85,  count: 22, hMin: 4, hMax: 9,  color: 0x4A6A2E, darken: 0.0 },
        { r: 110, count: 18, hMin: 7, hMax: 15, color: 0x2A4020, darken: 0.15 },
    ];
    layers.forEach(({ r, count, hMin, hMax, color, darken }) => {
        for (let i = 0; i < count; i++) {
            const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
            const radius = r + (Math.random() - 0.5) * 14;
            const h = hMin + Math.random() * (hMax - hMin);
            const w = 14 + Math.random() * 10;
            const d = 10 + Math.random() * 8;
            // Low-poly хагас бөмбөлөг мэт толгод — SphereGeometry-ийн дээд хагас
            const geo = new THREE.SphereGeometry(1, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2);
            // Цэгүүдэд санамсаргүй гажуудал өгч бодитой харагдуулна
            const pos = geo.attributes.position;
            for (let v = 0; v < pos.count; v++) {
                const dy = pos.getY(v);
                if (dy > 0.05) {
                    pos.setX(v, pos.getX(v) + (Math.random() - 0.5) * 0.08);
                    pos.setZ(v, pos.getZ(v) + (Math.random() - 0.5) * 0.08);
                    pos.setY(v, dy + (Math.random() - 0.3) * 0.12);
                }
            }
            geo.computeVertexNormals();
            const mat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(color).multiplyScalar(1 - darken),
                roughness: 0.95, metalness: 0, flatShading: true
            });
            const hill = new THREE.Mesh(geo, mat);
            hill.scale.set(w, h, d);
            hill.position.set(Math.cos(ang) * radius, -0.2, Math.sin(ang) * radius);
            hill.rotation.y = Math.random() * Math.PI * 2;
            hill.receiveShadow = true;
            hillGrp.add(hill);
        }
    });
    scene.add(hillGrp);
})();

// ── ГЭР ҮҮСГЭХ ──────────────────────────────────────────────────
const ger = new MongolianGer(5, 4);
ger.setPosition(0, 0, 0);
scene.add(ger.getObject3D());

// Walker бүртгэл (АМЬТАН + ХҮН хөдөлгөөн) — эрт зарлах
const _walkers = [];

// ══════════════════════════════════════════════════════════════════
// АНИМАЦ СИСТЕМ — хэсэг бүрийн нисэн орох / гарах
// ══════════════════════════════════════════════════════════════════
const _anims = new Map();

function animTo(obj, toPos, dur = 0.65, fromPos = null, onDone = null) {
    const from = fromPos ? fromPos.clone() : obj.position.clone();
    obj.visible = true;
    _anims.set(obj.uuid, { obj, from, to: toPos.clone(), t: 0, dur, onDone });
}

function _tickAnims(dt) {
    _anims.forEach((a, k) => {
        a.t += dt / a.dur;
        const p = 1 - Math.pow(1 - Math.min(a.t, 1), 3); // ease-out cubic
        a.obj.position.lerpVectors(a.from, a.to, p);
        if (a.t >= 1) {
            a.obj.position.copy(a.to);
            if (a.onDone) a.onDone();
            _anims.delete(k);
        }
    });
}

// Тус бүрийн home-оос offset (оролтын чиглэл)
const ENTRY_OFFSETS = {
    'tuurga-1':  new THREE.Vector3(-14, 0,  0),
    'tuurga-2':  new THREE.Vector3( 14, 0,  0),
    'bvsluur-1': new THREE.Vector3(  0, 6,  0),
    'bvsluur-2': new THREE.Vector3(  0, 6,  0),
    'bvsluur-3': new THREE.Vector3(  0, 6,  0),
    'bagana':    new THREE.Vector3(  0,-5,  0),
    'toono':     new THREE.Vector3(  0, 8,  0),
};

// Home positions — ger барьсны дараа хадгалах
const _homePos = new Map();
function _storeHome(obj) { _homePos.set(obj.uuid, obj.position.clone()); }
function _getHome(obj)   { return (_homePos.get(obj.uuid) ?? obj.position).clone(); }

[
    ...ger.getTuurga().getPanels(),
    ...ger.getBvsluur().getBands(),
    ger.parts['bagana'],
    ger.parts['toono'],
    ger.parts['roof'],
].forEach(_storeHome);

// ══════════════════════════════════════════════════════════════════
// ГАДНА ОРЧИН — Адуу (уяатай+цамцтай), хонь, хүмүүс
// ══════════════════════════════════════════════════════════════════
function createHorse(x, z, rotY = 0, color = 0x6B3A2A, hasBlanket = false) {
    const g    = new THREE.Group();
    const mat  = new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0E0600, roughness: 0.88 });
    const hoof = new THREE.MeshStandardMaterial({ color: 0x180C04, roughness: 0.9 });

    // Бие
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.62, 0.5), mat);
    body.position.set(0, 0.9, 0); g.add(body);
    // Цээж (урд гүдгэр)
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.48), mat);
    chest.position.set(0.55, 0.88, 0); g.add(chest);
    // Аарц (хойд гүдгэр)
    const rump = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.54, 0.47), mat);
    rump.position.set(-0.55, 0.93, 0); g.add(rump);

    // Хүзүү
    const neckM = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.48, 0.3), mat);
    neckM.position.set(0.62, 1.16, 0); neckM.rotation.z = -0.42; g.add(neckM);

    // Толгой
    const headB = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.26), mat);
    headB.position.set(0.96, 1.48, 0); g.add(headB);
    // Хамар
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.22), mat);
    snout.position.set(1.16, 1.38, 0); g.add(snout);
    // Чих × 2
    [-0.1, 0.1].forEach(ez => {
        const ear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.04), dark);
        ear.position.set(0.88, 1.68, ez); g.add(ear);
    });
    // Нүд × 2
    [-0.13, 0.13].forEach(ez => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), dark);
        eye.position.set(1.0, 1.52, ez); g.add(eye);
    });

    // Дэл
    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.18, 0.06), dark);
    mane.position.set(0.62, 1.44, 0); mane.rotation.z = -0.42; g.add(mane);
    const forelock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.05), dark);
    forelock.position.set(0.92, 1.65, 0); g.add(forelock);

    // Хөлүүд — дээд+доод+туурай (bottom ≈ y=0)
    [[-0.44, -0.17], [-0.44, 0.17], [0.34, -0.17], [0.34, 0.17]].forEach(([lx, lz]) => {
        const upper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.38, 0.14), mat);
        upper.position.set(lx, 0.58, lz); g.add(upper);
        const lower = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.38, 0.1), mat);
        lower.position.set(lx, 0.21, lz); g.add(lower);
        const hoofM = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.17), hoof);
        hoofM.position.set(lx, 0.03, lz); g.add(hoofM);
    });

    // Сүүл
    const tail1 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.15), dark);
    tail1.position.set(-0.76, 1.07, 0); tail1.rotation.z = 0.2; g.add(tail1);
    const tail2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.44, 0.22), dark);
    tail2.position.set(-0.9, 0.74, 0); tail2.rotation.z = 0.38; g.add(tail2);

    // Цамц/хөнжил (blanket) + эмээл + хазаар
    if (hasBlanket) {
        const wMat  = new THREE.MeshStandardMaterial({ color: 0xEEECE4, roughness: 0.86 });
        const bMat  = new THREE.MeshStandardMaterial({ color: 0x2255BB, roughness: 0.7 });
        const leath = new THREE.MeshStandardMaterial({ color: 0x5A2A10, roughness: 0.75 });
        const leathD= new THREE.MeshStandardMaterial({ color: 0x3A1A08, roughness: 0.8 });
        const metal = new THREE.MeshStandardMaterial({ color: 0xC8A848, roughness: 0.4, metalness: 0.7 });

        // Хөнжил (saddle cloth)
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 0.56), wMat);
        top.position.set(0, 1.25, 0); g.add(top);
        [-0.29, 0.29].forEach(bz => {
            const side = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.38, 0.04), wMat);
            side.position.set(0, 1.05, bz); g.add(side);
        });
        const edgeTop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.58), bMat);
        edgeTop.position.set(0, 1.22, 0); g.add(edgeTop);
        [-0.3, 0.3].forEach(bz => {
            const edgeSide = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.04, 0.04), bMat);
            edgeSide.position.set(0, 0.86, bz); g.add(edgeSide);
        });

        // ЭМЭЭЛ — хөнжил дээр модон эмээл
        const saddleBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.48), leath);
        saddleBase.position.set(-0.05, 1.33, 0); g.add(saddleBase);
        // Өндөр өвч (pommel) — хойд болон өмнөх талд
        const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.12), leathD);
        pommel.position.set(0.18, 1.42, 0); g.add(pommel);
        const cantle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.12), leathD);
        cantle.position.set(-0.22, 1.44, 0); g.add(cantle);
        // Алтан гоёл эмээл дээр
        const saddleOrn = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), metal);
        saddleOrn.position.set(0.18, 1.48, 0.06); g.add(saddleOrn);
        // Дөрөөнүүд (stirrups) — 2 тал
        [-0.24, 0.24].forEach(sz => {
            const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 5), leathD);
            rope.position.set(0, 1.12, sz); g.add(rope);
            const stirrup = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 6, 10), metal);
            stirrup.rotation.x = Math.PI / 2;
            stirrup.position.set(0, 0.96, sz); g.add(stirrup);
        });

        // ХАЗААР — морины толгойн нарийн уяа
        const rein = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.02), leath);
        rein.position.set(0.82, 1.38, 0); rein.rotation.z = 0.4; g.add(rein);
        [-0.13, 0.13].forEach(rz => {
            const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 0.02), leath);
            cheek.position.set(0.92, 1.54, rz); cheek.rotation.z = -0.4; g.add(cheek);
        });
        // Носовой хэсэг
        const nosePc = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.26), leath);
        nosePc.position.set(1.05, 1.5, 0); g.add(nosePc);
    }

    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return g;
}

function createSheep(x, z, rotY = 0) {
    const g    = new THREE.Group();
    const wool  = new THREE.MeshStandardMaterial({
        color: 0xF2EFE4, roughness: 0.96, flatShading: true,
        normalMap: _woolMaps.normalMap, roughnessMap: _woolMaps.roughnessMap,
        normalScale: new THREE.Vector2(0.6, 0.6)
    });
    const woolD = new THREE.MeshStandardMaterial({
        color: 0xDCD6C2, roughness: 0.96, flatShading: true,
        normalMap: _woolMaps.normalMap, normalScale: new THREE.Vector2(0.5, 0.5)
    });
    const skin  = new THREE.MeshStandardMaterial({ color: 0xB08868, roughness: 0.9 });
    const dark  = new THREE.MeshStandardMaterial({ color: 0x1A100A, roughness: 0.88 });

    // Үндсэн ноостой бие — цагаан бөмбөлгүүдийн хослол (нойтон/шуурхай low-poly стиль)
    const mainBody = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), wool);
    mainBody.scale.set(1.4, 1.0, 1.05);
    mainBody.position.set(0, 0.58, 0); g.add(mainBody);
    // Нэмэлт ноосны бөмбөлгүүд (гадаргыг fluffy болгоно)
    const puffs = [
        [-0.22,  0.72,  0.15, 0.18],
        [ 0.22,  0.72, -0.15, 0.17],
        [-0.14,  0.76, -0.18, 0.16],
        [ 0.14,  0.76,  0.18, 0.16],
        [ 0.0,   0.86,  0.0,  0.19],
        [-0.32,  0.64,  0.0,  0.2],
        [ 0.28,  0.66,  0.0,  0.2],
    ];
    puffs.forEach(([px, py, pz, pr]) => {
        const p = new THREE.Mesh(new THREE.SphereGeometry(pr, 8, 6),
            Math.random() > 0.5 ? wool : woolD);
        p.position.set(px, py, pz);
        g.add(p);
    });

    // Хүзүү (ноосгүй)
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 0.15), skin);
    neck.position.set(0.34, 0.64, 0);
    neck.rotation.z = -0.3;
    g.add(neck);
    // Толгой — хоёр хэсэг (духтай)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.2), skin);
    head.position.set(0.52, 0.76, 0); g.add(head);
    // Нүүрний ноос (толгой дээр цагаан ороосон)
    const headFluff = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), wool);
    headFluff.position.set(0.48, 0.86, 0);
    headFluff.scale.set(1.3, 0.9, 1.2);
    g.add(headFluff);
    // Хамар
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.14), skin);
    nose.position.set(0.62, 0.72, 0); g.add(nose);
    // Хар хошуу
    const noseT = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.08), dark);
    noseT.position.set(0.67, 0.73, 0); g.add(noseT);
    // Чих × 2
    [-0.1, 0.1].forEach(ez => {
        const ear = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.08), skin);
        ear.position.set(0.44, 0.88, ez); ear.rotation.z = 0.3; g.add(ear);
    });
    // Нүд × 2
    [-0.07, 0.07].forEach(ez => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), dark);
        eye.position.set(0.6, 0.8, ez); g.add(eye);
    });

    // Хөлүүд — дээд (ноостой бор), доод (хар)
    [[-0.22, -0.13], [-0.22, 0.13], [0.18, -0.13], [0.18, 0.13]].forEach(([lx, lz]) => {
        const upper = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.09), skin);
        upper.position.set(lx, 0.28, lz); g.add(upper);
        const lower = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.2, 0.085), dark);
        lower.position.set(lx, 0.1, lz); g.add(lower);
    });
    // Сүүл — жижиг ноосон
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), wool);
    tail.position.set(-0.42, 0.64, 0); g.add(tail);

    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return g;
}

function createPerson(x, z, rotY = 0, isChild = false, coatColor = 0x6A5428) {
    const g    = new THREE.Group();
    const s    = isChild ? 0.62 : 1.0;
    // Deel-ийн доод ба дээд хэсэгт илүү баялаг өнгөний хослол
    const skin    = new THREE.MeshStandardMaterial({ color: 0xE2B382, roughness: 0.82 });
    const coat    = new THREE.MeshStandardMaterial({ color: coatColor, roughness: 0.78 });
    const coatDk  = new THREE.MeshStandardMaterial({
        color: new THREE.Color(coatColor).multiplyScalar(0.75), roughness: 0.8
    });
    const belt    = new THREE.MeshStandardMaterial({ color: 0xD89028, roughness: 0.6 });
    const boot    = new THREE.MeshStandardMaterial({ color: 0x2A1A0E, roughness: 0.85 });
    const hair    = new THREE.MeshStandardMaterial({ color: 0x1A1008, roughness: 0.85 });
    const hatBody = new THREE.MeshStandardMaterial({ color: 0xF0E4C0, roughness: 0.75 });
    const hatBand = new THREE.MeshStandardMaterial({ color: 0x3A2812, roughness: 0.7 });
    const ornOr   = new THREE.MeshStandardMaterial({ color: 0xD84A28, roughness: 0.6 });

    // Гутал — доод хэсэг зузаан, хамраас нь дээшээ муруй (monclassic)
    [-0.08*s, 0.08*s].forEach(lx => {
        const sole = new THREE.Mesh(new THREE.BoxGeometry(0.14*s, 0.07*s, 0.26*s), boot);
        sole.position.set(lx, 0.035*s, 0.04*s); g.add(sole);
        const toe = new THREE.Mesh(new THREE.BoxGeometry(0.12*s, 0.08*s, 0.08*s), boot);
        toe.position.set(lx, 0.11*s, 0.16*s); toe.rotation.x = -0.4; g.add(toe);
    });

    // Хөлүүд (гутлаас дээш)
    [-0.08*s, 0.08*s].forEach(lx => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13*s, 0.35*s, 0.14*s), boot);
        leg.position.set(lx, 0.27*s, 0); g.add(leg);
    });

    // Deel-ийн доод хэсэг (өргөн бүрхүүл) — бэлхүүсээс өвдөг рүү
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.26*s, 0.3*s, 0.42*s, 10), coat);
    skirt.position.set(0, 0.6*s, 0);
    g.add(skirt);
    // Deel-ийн ирмэг (илүү бараан тойрог)
    const skirtEdge = new THREE.Mesh(new THREE.CylinderGeometry(0.302*s, 0.302*s, 0.04*s, 10), coatDk);
    skirtEdge.position.set(0, 0.41*s, 0);
    g.add(skirtEdge);

    // Бүс — алтан шар, бага зэрэг тод харагдана
    const beltM = new THREE.Mesh(new THREE.BoxGeometry(0.42*s, 0.08*s, 0.3*s), belt);
    beltM.position.set(0, 0.84*s, 0); g.add(beltM);

    // Бие (дээд) — deel
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38*s, 0.36*s, 0.24*s), coat);
    torso.position.set(0, 1.05*s, 0); g.add(torso);
    // Хоёр талын зах (зах нь tuurga-д таардаг дөрвөлжин хэлбэр)
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.4*s, 0.08*s, 0.26*s), coatDk);
    collar.position.set(0, 1.24*s, 0); g.add(collar);
    // Өнгөт товч мөрний хэсэгт
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.025*s, 8, 8), ornOr);
    pin.position.set(0.1*s, 1.2*s, 0.13*s); g.add(pin);

    // Мөр
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.48*s, 0.12*s, 0.24*s), coat);
    shoulder.position.set(0, 1.26*s, 0); g.add(shoulder);

    // Гарууд (илүү нарийн)
    [-0.28*s, 0.28*s].forEach(ax => {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11*s, 0.44*s, 0.11*s), coat);
        arm.position.set(ax, 1.04*s, 0); g.add(arm);
        // Гарны цагаан зах
        const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.12*s, 0.06*s, 0.12*s), coatDk);
        cuff.position.set(ax, 0.82*s, 0); g.add(cuff);
        // Гар
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055*s, 8, 8), skin);
        hand.position.set(ax, 0.77*s, 0); g.add(hand);
    });

    // Хүзүү
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.11*s, 0.1*s, 0.11*s), skin);
    neck.position.set(0, 1.34*s, 0); g.add(neck);

    // Толгой — бага зэрэг дөрвөлжин хэлбэртэй (Монгол хэв)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.24*s, 0.26*s, 0.22*s), skin);
    head.position.set(0, 1.52*s, 0); g.add(head);
    // Нүд × 2
    [-0.06*s, 0.06*s].forEach(ex => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018*s, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0x0A0502 }));
        eye.position.set(ex, 1.54*s, 0.11*s); g.add(eye);
    });
    // Үс — малгайн доорхи урд тал
    const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.22*s, 0.04*s, 0.23*s), hair);
    bangs.position.set(0, 1.64*s, 0); g.add(bangs);

    // Малгай — конус хэлбэртэй монгол хэв (2 хэсэг: брим + конус)
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2*s, 0.2*s, 0.04*s, 14), hatBand);
    brim.position.set(0, 1.68*s, 0); g.add(brim);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18*s, 0.18*s, 14), hatBody);
    cone.position.set(0, 1.8*s, 0); g.add(cone);
    // Оройн улаан бөмбөлөг
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.035*s, 8, 8), ornOr);
    orb.position.set(0, 1.92*s, 0); g.add(orb);

    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return g;
}

// ── МОНГОЛ УЯА — 3 шон + уртааш олс ─────────────────────────────
const _uyaaMat = new THREE.MeshStandardMaterial({ color: 0x7B5030, roughness: 0.85 });
const _ropeM   = new THREE.MeshStandardMaterial({ color: 0xB09060, roughness: 0.88 });
const _ropeH   = 1.55;

[9, 13, 17].forEach(px => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.065, 2.1, 8), _uyaaMat);
    pole.position.set(px, 1.05, 20);
    pole.castShadow = true;
    scene.add(pole);
});
[[9, 13], [13, 17]].forEach(([x1, x2]) => {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, x2 - x1, 6), _ropeM);
    seg.position.set((x1 + x2) / 2, _ropeH, 20);
    seg.rotation.z = Math.PI / 2;
    scene.add(seg);
});

// Уяатай адуу (4 морь — 2 нь цамцтай, гэр рүү харсан)
[
    { x:  9.5, color: 0x100808, blanket: true  },
    { x: 11.8, color: 0x7A3818, blanket: false },
    { x: 13.8, color: 0x3A2010, blanket: true  },
    { x: 16.0, color: 0x9A5828, blanket: false },
].forEach(({ x, color, blanket }) => {
    const horse = createHorse(x, 22.5, Math.PI, color, blanket);
    horse.userData.isHorse = true;
    horse.userData.hasSaddle = blanket;
    scene.add(horse);
    // Унжилт олс (уяанаас морины толгой хүртэл)
    const dr = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.3, 6), _ropeM);
    dr.position.set(x, _ropeH - 0.65, 20.8);
    dr.rotation.x = 0.18;
    scene.add(dr);
});

// ── 5 ХОШУУ МАЛ ─────────────────────────────────────────────────

// Үхэр (cow)
function createCow(x, z, rotY = 0, color = 0x8B6050) {
    const g   = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.88 });
    const drk = new THREE.MeshStandardMaterial({ color: 0x1A0A04, roughness: 0.9 });
    // Бие
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.72, 0.58), mat);
    body.position.set(0, 1.0, 0); g.add(body);
    // Хүзүү
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.52, 0.38), mat);
    neck.position.set(0.6, 1.24, 0); neck.rotation.z = -0.3; g.add(neck);
    // Толгой
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.36, 0.34), mat);
    head.position.set(1.0, 1.55, 0); g.add(head);
    // Хамар
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.3), mat);
    snout.position.set(1.22, 1.44, 0); g.add(snout);
    // Эвэр × 2
    [-0.15, 0.15].forEach(ez => {
        const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.01, 0.22, 6), drk);
        horn.position.set(0.92, 1.78, ez); horn.rotation.z = ez > 0 ? 0.5 : -0.5; g.add(horn);
    });
    // Хөлүүд — bottom ≈ y=0
    [[-0.5, -0.2], [-0.5, 0.2], [0.42, -0.2], [0.42, 0.2]].forEach(([lx, lz]) => {
        const upper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.16), mat);
        upper.position.set(lx, 0.62, lz); g.add(upper);
        const lower = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.44, 0.12), mat);
        lower.position.set(lx, 0.22, lz); g.add(lower);
    });
    // Сүүл
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.1), drk);
    tail.position.set(-0.78, 1.1, 0); tail.rotation.z = 0.25; g.add(tail);
    g.position.set(x, 0, z); g.rotation.y = rotY;
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return g;
}

// Тэмээ (camel)
function createCamel(x, z, rotY = 0) {
    const g   = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xC8A060, roughness: 0.88 });
    const drk = new THREE.MeshStandardMaterial({ color: 0x7A5830, roughness: 0.9  });
    // Бие
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.62), mat);
    body.position.set(0, 1.3, 0); g.add(body);
    // Бөхүүд × 2
    [-0.3, 0.3].forEach(dx => {
        const hump = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat);
        hump.scale.set(0.85, 1.0, 0.7); hump.position.set(dx, 1.86, 0); g.add(hump);
    });
    // Хүзүү (урт)
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.88, 0.28), mat);
    neck.position.set(0.68, 1.78, 0); neck.rotation.z = -0.22; g.add(neck);
    // Толгой
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.28), mat);
    head.position.set(1.08, 2.18, 0); g.add(head);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.24), mat);
    snout.position.set(1.28, 2.08, 0); g.add(snout);
    // Урт хөлүүд
    [[-0.5, -0.24], [-0.5, 0.24], [0.42, -0.24], [0.42, 0.24]].forEach(([lx, lz]) => {
        const upper = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.56, 0.15), mat);
        upper.position.set(lx, 0.82, lz); g.add(upper);
        const lower = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.56, 0.12), mat);
        lower.position.set(lx, 0.28, lz); g.add(lower);
    });
    // Сүүл
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.08), drk);
    tail.position.set(-0.82, 1.4, 0); tail.rotation.z = 0.3; g.add(tail);
    g.position.set(x, 0, z); g.rotation.y = rotY;
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return g;
}

// Ямаа (goat)
function createGoat(x, z, rotY = 0, color = 0xD8C8A8) {
    const g   = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const drk = new THREE.MeshStandardMaterial({ color: 0x2A1808, roughness: 0.88 });
    const skin= new THREE.MeshStandardMaterial({ color: 0xC09070, roughness: 0.9 });
    // Бие
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.42, 0.38), mat);
    body.position.set(0, 0.56, 0); g.add(body);
    // Хүзүү
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.2), mat);
    neck.position.set(0.3, 0.8, 0); neck.rotation.z = -0.3; g.add(neck);
    // Толгой
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.22), skin);
    head.position.set(0.48, 0.98, 0); g.add(head);
    // Эвэр × 2
    [-0.09, 0.09].forEach(ez => {
        const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.008, 0.18, 6), drk);
        horn.position.set(0.4, 1.12, ez); horn.rotation.z = ez > 0 ? 0.35 : -0.35; g.add(horn);
    });
    // Сахал
    const beard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.04), drk);
    beard.position.set(0.56, 0.86, 0); g.add(beard);
    // Хөлүүд — bottom ≈ y=0
    [[-0.24, -0.14], [-0.24, 0.14], [0.2, -0.14], [0.2, 0.14]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.38, 0.09), mat);
        leg.position.set(lx, 0.2, lz); g.add(leg);
    });
    g.position.set(x, 0, z); g.rotation.y = rotY;
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return g;
}


// ── МАЛЫН ХАШАА (өвөлжөөний) ─────────────────────────────────────
(function buildHashaa() {
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x7B5530, roughness: 0.88 });
    const postMat  = new THREE.MeshStandardMaterial({ color: 0x5A3C1A, roughness: 0.9  });

    // Хашааны байрлал: x=[-28..−14], z=[−6..12]
    const x0 = -28, x1 = -14, z0 = -6, z1 = 12;
    const pw = 0.1, ph = 1.2, pd = 0.12;

    // Хашааны шон + тор
    const sides = [
        { from: [x0, z0], to: [x1, z0], axis: 'x' },
        { from: [x0, z1], to: [x1, z1], axis: 'x' },
        { from: [x0, z0], to: [x0, z1], axis: 'z' },
        { from: [x1, z0], to: [x1, z1], axis: 'z' },
    ];

    sides.forEach(({ from, to, axis }) => {
        const len = Math.abs(axis === 'x' ? to[0]-from[0] : to[1]-from[1]);
        const cx  = (from[0] + to[0]) / 2;
        const cz  = (from[1] + to[1]) / 2;

        // Дор тор
        [0.3, 0.7].forEach(t => {
            const rail = new THREE.Mesh(
                axis === 'x'
                    ? new THREE.BoxGeometry(len, 0.06, pd)
                    : new THREE.BoxGeometry(pd, 0.06, len),
                fenceMat);
            rail.position.set(cx, ph * t, cz);
            scene.add(rail);
        });

        // Шонгууд
        const n    = Math.ceil(len / 2.2);
        for (let i = 0; i <= n; i++) {
            const t  = i / n;
            const px = axis === 'x' ? from[0] + (to[0]-from[0])*t : from[0];
            const pz = axis === 'z' ? from[1] + (to[1]-from[1])*t : from[1];
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, ph + 0.1, 7), postMat);
            post.position.set(px, (ph+0.1)/2, pz);
            post.castShadow = true;
            scene.add(post);
        }
    });

    // Хашааны дотор хонь + ямаа — хашааны доторх жижиг эргэлт
    const cx0 = (x0+x1)/2, cz0 = (z0+z1)/2;
    const innerPts = [
        [cx0-4, cz0-2], [cx0-2, cz0+1], [cx0,   cz0-3],
        [cx0+2, cz0+2], [cx0-5, cz0+3], [cx0+4, cz0  ],
        [cx0-1, cz0-4], [cx0+3, cz0-2],
    ];
    innerPts.forEach(([sx, sz], i) => {
        const animal = i % 3 === 0 ? createGoat(sx, sz, 0, 0xC8B890) : createSheep(sx, sz, 0);
        scene.add(animal);
        // Хашааны доторх жижиг patrol
        const r = 2.5;
        const wp = [0,1,2,3].map(k => ({
            x: sx + Math.cos(k * Math.PI * 0.5 + i) * r,
            z: sz + Math.sin(k * Math.PI * 0.5 + i) * r,
        }));
        addWalker(animal, wp, 0.5 + Math.random() * 0.3);
    });

    // Гадна хонь — уяаны хажуугаар явна
    [[-2,17],[-1,21],[3,20],[4.5,16],[-3,16],[1,23],[5,18],[2.5,18],[0.5,19]
    ].forEach(([sx, sz], i) => {
        const sh = createSheep(sx, sz, 0);
        scene.add(sh);
        const r = 3;
        addWalker(sh, [0,1,2,3].map(k => ({
            x: sx + Math.cos(k * Math.PI * 0.5 + i) * r,
            z: sz + Math.sin(k * Math.PI * 0.5 + i) * r,
        })), 0.45 + Math.random() * 0.25);
    });

    // Гадна ямаа
    [[6,19],[8,16],[4,22]].forEach(([gx, gz], i) => {
        const gt = createGoat(gx, gz, 0);
        scene.add(gt);
        const r = 3.5;
        addWalker(gt, [0,1,2,3].map(k => ({
            x: gx + Math.cos(k * Math.PI * 0.5 + i * 1.3) * r,
            z: gz + Math.sin(k * Math.PI * 0.5 + i * 1.3) * r,
        })), 0.6 + Math.random() * 0.3);
    });
})();

// ── УУЛЫН ГОРХИ — уулнаас газар малтаж урсана ────────────────────
(function buildStream() {
    // ── Анимацтай усны текстур (Minecraft ус шиг) ──────────────
    const _waterTex = _mkTex((ctx, s) => {
        // Гүн хөх суурь
        ctx.fillStyle = '#1A5E8A'; ctx.fillRect(0, 0, s, s);
        // Гэрлийн туяа — цайвар зураасууд
        _scatter(ctx, s, ['#2A80AA','#1E6A94','#3A90BB','#155070'], 0.35);
        // Тод цагаан гэрлийн толбо
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = 'rgba(160,220,255,0.5)';
            const x = Math.floor(Math.random() * (s - 3));
            const y = Math.floor(Math.random() * (s - 1));
            ctx.fillRect(x, y, 3, 1);
        }
    }, 16);
    _waterTex.repeat.set(3, 3);

    // Хөдөлдөг текстур — UV шилжилтийн хувьд өөр нэг хуулбар
    const _waterTex2 = _waterTex.clone();
    _waterTex2.repeat.set(3, 3);

    const waterMat = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF,
        map: _waterTex,
        transparent: true,
        opacity: 0.82,
        roughness: 0.08,
        metalness: 0.15,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    // Усны мешүүдийг хадгалж, tick-д UV шилжүүлнэ
    const _waterMeshes = [];
    let _waterTime = 0;
    // Голын ёроол — нойтон харанхуй шороо (усны доогуур харагдана)
    const bedMat  = new THREE.MeshStandardMaterial({ color: 0x1A1610, roughness: 0.98 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x4A4840, roughness: 0.92, flatShading: true });
    const bankMat = new THREE.MeshStandardMaterial({ color: 0x6E5838, roughness: 0.95 });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4A7A3A, roughness: 0.9 });

    // Голын зам — Хөвсгөл уулаас гэрийн хажуугаар мяндарч урсана
    // Catmull-Rom curve-р тэгш бус, байгалийн муруйтай
    const ctrlPts = [
        new THREE.Vector3( 12, 0, -82),
        new THREE.Vector3( 11, 0, -72),
        new THREE.Vector3( 14, 0, -62),
        new THREE.Vector3( 18, 0, -52),
        new THREE.Vector3( 16, 0, -40),
        new THREE.Vector3( 20, 0, -28),
        new THREE.Vector3( 25, 0, -16),
        new THREE.Vector3( 23, 0,  -2),
        new THREE.Vector3( 27, 0,  12),
        new THREE.Vector3( 32, 0,  26),
        new THREE.Vector3( 30, 0,  40),
        new THREE.Vector3( 34, 0,  56),
        new THREE.Vector3( 38, 0,  70),
    ];
    const riverCurve = new THREE.CatmullRomCurve3(ctrlPts, false, 'catmullrom', 0.45);
    const STEPS = 120;
    const sampled = riverCurve.getPoints(STEPS);

    const WY   =  0.04;   // усны гадарга
    const BED  = -0.10;   // ёроол

    for (let i = 0; i < sampled.length - 1; i++) {
        const a = sampled[i], b = sampled[i + 1];
        const dx = b.x - a.x, dz = b.z - a.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len < 0.001) continue;
        const cx  = (a.x + b.x) * 0.5;
        const cz  = (a.z + b.z) * 0.5;
        const ang = Math.atan2(dx, dz);

        // Уулнаас доош өргөсөж буй гол — t = 0..1
        const t = i / (sampled.length - 1);
        const w = 2.4 + t * 3.6;                       // 2.4 → 6.0 өргөн
        // Жижиг variation — гол нь жигд биш
        const wVar = w + Math.sin(t * 18) * 0.25;

        // ── Гадна талын ногоон / шороон банк (өргөн) ──
        const bank = new THREE.Mesh(
            new THREE.BoxGeometry(wVar + 2.8, 0.10, len + 0.4), grassMat);
        bank.position.set(cx, 0.05, cz);
        bank.rotation.y = ang;
        bank.receiveShadow = true;
        scene.add(bank);

        // ── Шороон/шавар банк (усны хажууд нарийн) ──
        const mud = new THREE.Mesh(
            new THREE.BoxGeometry(wVar + 1.0, 0.08, len + 0.35), bankMat);
        mud.position.set(cx, 0.08, cz);
        mud.rotation.y = ang;
        scene.add(mud);

        // ── Голын ёроол — харанхуй ──
        const bed = new THREE.Mesh(
            new THREE.BoxGeometry(wVar, 0.18, len + 0.3), bedMat);
        bed.position.set(cx, BED, cz);
        bed.rotation.y = ang;
        scene.add(bed);

        // ── Усны гадарга — Minecraft animated water ──
        const water = new THREE.Mesh(
            new THREE.BoxGeometry(wVar - 0.05, 0.01, len + 0.25), waterMat.clone());
        water.position.set(cx, WY, cz);
        water.rotation.y = ang;
        scene.add(water);
        _waterMeshes.push({ mesh: water, offset: i * 0.04 });
    }

    // ── Голын дагуух чулуунууд — Catmull-Rom-н дагуу хагас живсэн ──
    for (let i = 8; i < sampled.length - 4; i += 7) {
        const p = sampled[i];
        const next = sampled[i + 1];
        const ang = Math.atan2(next.x - p.x, next.z - p.z);
        // Хажуу тийш шилжүүл
        for (const side of [-1, 1]) {
            if (Math.random() > 0.55) continue;
            const t = i / sampled.length;
            const w = 2.4 + t * 3.6;
            const off = (w * 0.5 - 0.2) * side;
            const rx = p.x + Math.cos(ang) * off;
            const rz = p.z - Math.sin(ang) * off;
            const rs = 0.3 + Math.random() * 0.25;
            const rock = new THREE.Mesh(new THREE.SphereGeometry(rs, 6, 5), rockMat);
            rock.scale.set(1.2, 0.5, 0.95);
            rock.position.set(rx, rs * 0.3, rz);
            rock.rotation.y = Math.random() * Math.PI;
            rock.castShadow = true;
            scene.add(rock);
        }
    }

    // ── Уулаас буух хэсгийн МАНАН ──────────────────────────────────
    const MIST_N = 280;
    const mistGeo = new THREE.BufferGeometry();
    const mistPos = new Float32Array(MIST_N * 3);
    for (let i = 0; i < MIST_N; i++) {
        mistPos[i*3]   = 12 + Math.random() * 8;
        mistPos[i*3+1] = Math.random() * 5;
        mistPos[i*3+2] = -82 + Math.random() * 30;
    }
    mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
    const mistMat = new THREE.PointsMaterial({
        color: 0xCCE8F4, size: 0.55, transparent: true, opacity: 0.28, depthWrite: false
    });
    scene.add(new THREE.Points(mistGeo, mistMat));

    window._tickStreamMist = function(dt) {
        // Усны UV scroll — Minecraft ус шиг хөдөлнө
        _waterTime += dt;
        for (const { mesh, offset } of _waterMeshes) {
            if (mesh.material.map) {
                mesh.material.map.offset.set((_waterTime * 0.18 + offset) % 1, (_waterTime * 0.12) % 1);
                mesh.material.map.needsUpdate = true;
            }
        }

        // Манан дээш дрифт
        const p = mistGeo.attributes.position.array;
        for (let i = 0; i < MIST_N; i++) {
            p[i*3+1] += dt * (0.35 + (i % 5) * 0.08);
            p[i*3]   += Math.sin(p[i*3+1] * 0.4 + i) * dt * 0.12;
            if (p[i*3+1] > 6) {
                p[i*3+1] = 0;
                p[i*3]   = 12 + Math.random() * 8;
                p[i*3+2] = -82 + Math.random() * 30;
            }
        }
        mistGeo.attributes.position.needsUpdate = true;

    };
})();

// ══════════════════════════════════════════════════════════════════
// НУУР — Хөвсгөл нуур шиг том, цэнхэр усан гадарга
// ══════════════════════════════════════════════════════════════════
const _lakeTex = _mkTex((ctx, s) => {
    ctx.fillStyle = '#1B72C0'; ctx.fillRect(0, 0, s, s);
    _scatter(ctx, s, ['#155EA8','#2488D8','#1068B4','#2A80CC','#0E5898'], 0.32);
    // shimmer streaks
    for (let i = 0; i < 5; i++) {
        ctx.fillStyle = 'rgba(160,225,255,0.45)';
        ctx.fillRect(Math.floor(Math.random()*(s-5)), Math.floor(Math.random()*s), 5, 1);
    }
}, 32);
_lakeTex.repeat.set(22, 14);

const _lakeMat = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF, map: _lakeTex,
    transparent: true, opacity: 0.90,
    roughness: 0.04, metalness: 0.28,
    depthWrite: false, side: THREE.FrontSide
});
const _lakeMesh = new THREE.Mesh(new THREE.PlaneGeometry(160, 62, 1, 1), _lakeMat);
_lakeMesh.rotation.x = -Math.PI / 2;
_lakeMesh.position.set(-2, 0.07, -57);
scene.add(_lakeMesh);

// Эргийн зурвас — нарийн шарлаг элс
const _shoreMat = new THREE.MeshStandardMaterial({ color: 0xAA9060, roughness: 0.95 });
[[-2, -26, 162, 4], [-2, -88, 162, 4]].forEach(([sx, sz, sw, sd]) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.06, sd), _shoreMat);
    s.position.set(sx, 0.04, sz);
    scene.add(s);
});

window._tickLake = function(dt) {
    _lakeTex.offset.x = (_lakeTex.offset.x + dt * 0.025) % 1;
    _lakeTex.offset.y = (_lakeTex.offset.y + dt * 0.012) % 1;
    _lakeTex.needsUpdate = true;
};

// ══════════════════════════════════════════════════════════════════
// УУЛ + МОД — Хөвсгөл нуурын орчны уул шиг (цастай оргил, нарсан ой)
// ══════════════════════════════════════════════════════════════════

// ── Мод (нарс + хус) — сайжруулсан ────────────────────────────────
function createTree(x, z, type = 'pine', h = 5) {
    const g = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({
        color: type === 'birch' ? 0xE0DDD0 : 0x5A3818, roughness: 0.88
    });
    const leafMat = type === 'pine'
        ? new THREE.MeshStandardMaterial({ color: 0x1E4A20, roughness: 0.9, flatShading: true })
        : new THREE.MeshStandardMaterial({ color: 0xAACC66, roughness: 0.86, flatShading: true });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.16, h * 0.42, 7), trunkMat);
    trunk.position.y = h * 0.21; g.add(trunk);

    if (type === 'pine') {
        // 4 давхар конус — Хөвсгөлийн нарс шиг нарийн, өндөр
        [0, 1, 2, 3].forEach(i => {
            const r = h * 0.28 - i * h * 0.055;
            const ht = h * 0.36 - i * 0.18;
            const cone = new THREE.Mesh(new THREE.ConeGeometry(r, ht, 7), leafMat);
            cone.position.y = h * 0.35 + i * h * 0.18; g.add(cone);
        });
    } else {
        const crown = new THREE.Mesh(new THREE.SphereGeometry(h * 0.26, 7, 6), leafMat);
        crown.scale.set(1.1, 0.9, 1);
        crown.position.y = h * 0.72; g.add(crown);
        // Хусны цагаан иш — судал
        for (let i = 0; i < 4; i++) {
            const mark = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.01),
                new THREE.MeshStandardMaterial({ color: 0x888880, roughness: 0.9 }));
            mark.position.set(0, h * 0.1 + i * h * 0.08, 0.16);
            g.add(mark);
        }
    }
    g.position.set(x, 0, z);
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return g;
}

// ── Уул барих функц — конус суурьтай, хадан гадаргуутай, цастай оргилтой ─
function buildMountain(x, z, rx, ry, rz, baseColor, hasSnow = true) {
    const colorBase = new THREE.Color(baseColor);
    const colorRock = new THREE.Color(0x4A4538);
    const colorDark = new THREE.Color(0x2E2A22);
    const colorSnow = new THREE.Color(0xEFF3F7);

    // Олон оройт хадан конус хийх туслах функц
    function makePeak(radius, height, segs, hSegs, jitter, snow, seed) {
        const g = new THREE.ConeGeometry(radius, height, segs, hSegs);
        const pos = g.attributes.position;
        const colors = [];
        const rng = (i) => {
            const s = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
            return s - Math.floor(s);
        };
        for (let i = 0; i < pos.count; i++) {
            const px = pos.getX(i);
            const py = pos.getY(i);
            const pz = pos.getZ(i);
            const heightRatio = (py / height) + 0.5;       // 0 = доод, 1 = оргил
            const radial = Math.sqrt(px * px + pz * pz);
            const angle  = Math.atan2(pz, px);

            // Хадны хагарал — radial (өргөн) + ridge (босоо хяр)
            const noise = (Math.sin(px * 6.3 + pz * 4.7 + seed) * 0.5
                         + Math.cos(pz * 5.1 - px * 7.2 + seed * 2) * 0.5);
            const ridge = Math.sin(angle * 5 + seed) * 0.35
                        + Math.sin(angle * 11 + seed * 3) * 0.15;
            const taper = 1 - heightRatio * 0.55;          // дээш нь нарийсна
            const disp  = (noise * 0.4 + ridge * 0.35) * jitter * taper;

            if (radial > 0.001) {
                pos.setX(i, px + (px / radial) * disp * radius);
                pos.setZ(i, pz + (pz / radial) * disp * radius);
            }
            // Оргилын хэсэгт босоо чигийн хэвгий
            if (heightRatio > 0.7) {
                pos.setY(i, py + (rng(i) - 0.5) * jitter * height * 0.18);
            }

            // Вертекс өнгө: доод-ногоон → дунд-хадан → дээд-цас
            const c = new THREE.Color();
            const snowLine = snow ? 0.78 : 1.1;
            if (heightRatio > snowLine) {
                c.copy(colorSnow);
            } else if (heightRatio > snowLine - 0.12) {
                const t = (heightRatio - (snowLine - 0.12)) / 0.12;
                c.lerpColors(colorRock, colorSnow, t);
            } else if (heightRatio > 0.45) {
                const t = (heightRatio - 0.45) / 0.35;
                c.lerpColors(colorBase, colorRock, t);
            } else {
                const t = heightRatio / 0.45;
                const low = colorBase.clone().lerp(colorDark, 0.25);
                c.lerpColors(low, colorBase, t);
            }
            // Хадны цоохор өнгө
            const tint = (rng(i + 100) - 0.5) * 0.08;
            c.r = Math.max(0, Math.min(1, c.r + tint));
            c.g = Math.max(0, Math.min(1, c.g + tint));
            c.b = Math.max(0, Math.min(1, c.b + tint));
            colors.push(c.r, c.g, c.b);
        }
        g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        g.computeVertexNormals();
        return g;
    }

    const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.97,
        metalness: 0.02,
        flatShading: true
    });

    // Үндсэн оргил
    const seedA = (x * 13.7 + z * 7.3) % 1000;
    const mainGeom = makePeak(1, 1, 18, 12, 0.32, hasSnow, seedA);
    const main = new THREE.Mesh(mainGeom, mat);
    main.scale.set(rx, ry * 1.7, rz);
    main.position.set(x, ry * 0.78, z);
    main.castShadow = true;
    main.receiveShadow = true;
    scene.add(main);

    // Хоёрдогч оргил — байгалийн уулсын profile
    const subGeom = makePeak(1, 1, 14, 8, 0.28, hasSnow, seedA + 99);
    const sub = new THREE.Mesh(subGeom, mat);
    const subAng = (seedA % 6.28);
    const offX = Math.cos(subAng) * rx * 0.55;
    const offZ = Math.sin(subAng) * rz * 0.55;
    sub.scale.set(rx * 0.62, ry * 1.25, rz * 0.62);
    sub.position.set(x + offX, ry * 0.58, z + offZ);
    sub.rotation.y = subAng;
    sub.castShadow = true;
    sub.receiveShadow = true;
    scene.add(sub);

    // Гуравдагч жижиг хяр — хажуугаас нь
    const ridgeGeom = makePeak(1, 1, 10, 6, 0.22, false, seedA + 211);
    const ridge = new THREE.Mesh(ridgeGeom, mat);
    const ridgeAng = subAng + Math.PI * 0.7;
    ridge.scale.set(rx * 0.42, ry * 0.85, rz * 0.42);
    ridge.position.set(x + Math.cos(ridgeAng) * rx * 0.7, ry * 0.4, z + Math.sin(ridgeAng) * rz * 0.7);
    ridge.castShadow = true;
    scene.add(ridge);

    // Ногоон ой — уулын бэл хүртэл нарс мод
    const treeCount = Math.floor(rx * 1.8);
    for (let t = 0; t < treeCount; t++) {
        const ang  = Math.random() * Math.PI * 2;
        const dist = rx * (0.3 + Math.random() * 0.45);
        const tx   = x + Math.cos(ang) * dist;
        const tz   = z + Math.sin(ang) * dist;
        const th   = 4 + Math.random() * 4;
        scene.add(createTree(tx, tz, 'pine', th));
    }
}

// ── Хөвсгөлийн уулс — 6 том уул, цастай оргилтой ─────────────────
buildMountain(  40, -62, 22, 28, 20, 0x556655, true );   // баруун
buildMountain( -32, -72, 26, 32, 23, 0x4A5A4A, true );   // зүүн
buildMountain(  10, -88, 38, 38, 32, 0x404E40, true );   // хойд гол (том)
buildMountain( -62, -58, 22, 24, 20, 0x506050, true );   // зүүн алс
buildMountain(  68, -52, 18, 22, 17, 0x5A6858, true );   // баруун алс
buildMountain( -10, -100,44, 42, 38, 0x384838, true );   // хамгийн алс (хамгийн том)
buildMountain(  22, -72, 18, 24, 15, 0xA89060, false);   // нуурын эргийн голын нүцгэн толгод
buildMountain( -48, -80, 20, 26, 18, 0x445044, true );   // зүүн алсын нэмэлт

// ══════════════════════════════════════════════════════════════════
// ОВОО — Монголын тахилгын чулуун овоолго, хий мориор хадагтай
// ══════════════════════════════════════════════════════════════════
function createOvoo(x, z, scale = 1) {
    const g = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({
        color: 0x6E6258, roughness: 0.96, flatShading: true
    });
    const stoneDark = new THREE.MeshStandardMaterial({
        color: 0x4A4238, roughness: 0.96, flatShading: true
    });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5A3818, roughness: 0.85 });
    const blueScarf = new THREE.MeshStandardMaterial({
        color: 0x2E78C8, roughness: 0.55, side: THREE.DoubleSide,
        emissive: 0x1A4A7E, emissiveIntensity: 0.12
    });
    const yellowScarf = new THREE.MeshStandardMaterial({
        color: 0xFFD555, roughness: 0.55, side: THREE.DoubleSide
    });

    // ── Чулуун овоолго — суурь өргөн, дээш нь нарийсна ──
    const layers = [
        { y: 0.00, r: 1.6, n: 12, sz: [0.55, 0.85] },
        { y: 0.45, r: 1.25, n: 10, sz: [0.45, 0.7] },
        { y: 0.85, r: 0.95, n: 8, sz: [0.4, 0.6] },
        { y: 1.20, r: 0.7, n: 6, sz: [0.35, 0.5] },
        { y: 1.50, r: 0.45, n: 4, sz: [0.3, 0.42] },
    ];
    layers.forEach((L, li) => {
        for (let i = 0; i < L.n; i++) {
            const a = (i / L.n) * Math.PI * 2 + li * 0.3;
            const sx = L.sz[0] + Math.random() * (L.sz[1] - L.sz[0]);
            const sy = sx * (0.7 + Math.random() * 0.3);
            const sz2 = sx * (0.85 + Math.random() * 0.25);
            const stone = new THREE.Mesh(
                new THREE.DodecahedronGeometry(1, 0), li % 2 === 0 ? stoneMat : stoneDark);
            stone.scale.set(sx, sy, sz2);
            stone.position.set(
                Math.cos(a) * L.r * (0.7 + Math.random() * 0.3),
                L.y + Math.random() * 0.1,
                Math.sin(a) * L.r * (0.7 + Math.random() * 0.3)
            );
            stone.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            stone.castShadow = true;
            stone.receiveShadow = true;
            g.add(stone);
        }
    });

    // ── Төв модон шон (хий мориор хадаг үдэх шон) ──
    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 3.4, 8), woodMat);
    pole.position.y = 1.7 + 1.7;
    pole.castShadow = true;
    g.add(pole);

    // ── Шонгийн оройд гурвалжин туг (хий морь / тэнгэрийн морь) ──
    const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.5), yellowScarf);
    flag.position.set(0.35, 3.05, 0);
    flag.rotation.y = Math.PI / 2;
    g.add(flag);

    // ── ХАДАГ — цэнхэр торгон цуваа дараалуулна (шонноос овоо руу) ──
    const scarfCount = 14;
    for (let i = 0; i < scarfCount; i++) {
        // Шонгийн дээд хэсгээс овоогийн зах руу татна
        const a = (i / scarfCount) * Math.PI * 2;
        const ex = Math.cos(a) * 1.8;
        const ez = Math.sin(a) * 1.8;
        const startY = 2.6 + Math.random() * 0.2;
        const endY   = 0.2 + Math.random() * 0.5;
        // Curve: дунд хэсэгт нэг бага доош сулрана
        const mid = new THREE.Vector3(ex * 0.55, (startY + endY) * 0.42, ez * 0.55);
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, startY, 0),
            mid,
            new THREE.Vector3(ex, endY, ez)
        ]);
        // Туузан хадаг — нарийн ribbon
        const ribbonGeo = new THREE.TubeGeometry(curve, 16, 0.022, 4, false);
        const ribbon = new THREE.Mesh(ribbonGeo, blueScarf);
        g.add(ribbon);
    }

    // Ground patch — овоогийн доорх хатсан газар
    const patch = new THREE.Mesh(
        new THREE.CircleGeometry(2.4, 18),
        new THREE.MeshStandardMaterial({ color: 0x6A5A3A, roughness: 0.95 }));
    patch.rotation.x = -Math.PI / 2;
    patch.position.y = 0.02;
    patch.receiveShadow = true;
    g.add(patch);

    g.scale.setScalar(scale);
    g.position.set(x, 0, z);
    return g;
}

// Овоо — нуурнаас (z<-26) хол, гэрээс баруун өмнө, тал нутгийн талбайд
scene.add(createOvoo(-38, 6, 1.0));

// ══════════════════════════════════════════════════════════════════
// БӨХ — Монгол үндэсний бөх 2 ширхэг, барилдаж буй байрлалд
// (Зодог, Шуудаг, Гутал — Үндэсний хувцастай)
// ══════════════════════════════════════════════════════════════════
function createWrestler(x, z, rotY = 0, jacketColor = 0xC8221C, shortColor = 0xC8554C) {
    const g = new THREE.Group();

    const skin   = new THREE.MeshStandardMaterial({ color: 0xCB9D78, roughness: 0.88 });
    const jack   = new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.72 });
    const trim   = new THREE.MeshStandardMaterial({ color: 0xFFD555, roughness: 0.5, metalness: 0.25 });
    const shorts = new THREE.MeshStandardMaterial({ color: shortColor, roughness: 0.75 });
    const boot   = new THREE.MeshStandardMaterial({ color: 0x2E1F12, roughness: 0.88 });
    const hair   = new THREE.MeshStandardMaterial({ color: 0x12100A, roughness: 0.9 });

    const LEAN = 0.22;   // өмнө тийш бөгтийсөн өнцөг

    // ── Цээж (нүцгэн — зодог нь хажуу/арыг л бүрхэнэ) ──
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.62, 0.32), skin);
    torso.position.y = 1.05;
    torso.rotation.x = LEAN;
    g.add(torso);

    // ── ЗОДОГ — арын панель ──
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.62, 0.05), jack);
    back.position.set(0, 1.05, -0.16);
    back.rotation.x = LEAN;
    g.add(back);

    // Зодогийн хажуу (мөр→бэлхүүс хүртэл)
    [-0.295, 0.295].forEach(sx => {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.62, 0.32), jack);
        side.position.set(sx, 1.05, 0);
        side.rotation.x = LEAN;
        g.add(side);
    });

    // Алтан хүрэм (нөмрөгийн зах) — мөр дагуу
    const collarL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.06), trim);
    collarL.position.set(-0.13, 1.32, 0.1);
    collarL.rotation.set(LEAN, 0, 0.4);
    g.add(collarL);
    const collarR = collarL.clone();
    collarR.position.x = 0.13;
    collarR.rotation.z = -0.4;
    g.add(collarR);

    // Алтан хатгамал — арын панель дээр
    const emblem = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.02), trim);
    emblem.position.set(0, 1.05, -0.19);
    emblem.rotation.x = LEAN;
    g.add(emblem);

    // ── ШУУДАГ — богино өмд ──
    const sho = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.3, 0.36), shorts);
    sho.position.y = 0.62;
    g.add(sho);
    // Шуудагны цагаан зах
    const shoTrim = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.04, 0.38),
        new THREE.MeshStandardMaterial({ color: 0xF0E6CC, roughness: 0.85 }));
    shoTrim.position.y = 0.78;
    g.add(shoTrim);

    // ── ХӨЛ — өргөн зогсолт, бага зэрэг гулайсан ──
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.5, 0.24), skin);
    legL.position.set(-0.18, 0.32, 0.18);
    legL.rotation.x = -0.22;
    g.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.5, 0.24), skin);
    legR.position.set(0.18, 0.34, -0.1);
    legR.rotation.x = 0.18;
    g.add(legR);

    // ── ГУТАЛ — монгол гутал, тэгш хошуутай ──
    const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.34), boot);
    bootL.position.set(-0.18, 0.1, 0.28);
    g.add(bootL);
    const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.34), boot);
    bootR.position.set(0.18, 0.1, -0.02);
    g.add(bootR);

    // ── ГАР — урагшаа сунгасан, өрсөлдөгчийн мөр гэдсэн авсан ──
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.58, 0.18), skin);
    armL.position.set(-0.34, 1.12, 0.32);
    armL.rotation.set(-1.0, 0, 0.18);
    g.add(armL);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.58, 0.18), skin);
    armR.position.set(0.34, 1.12, 0.32);
    armR.rotation.set(-1.0, 0, -0.18);
    g.add(armR);

    // Гарын зодогийн ханцуй (мөр орчмын улаан)
    [-0.34, 0.34].forEach(sx => {
        const sl = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.16, 0.2), jack);
        sl.position.set(sx, 1.32, 0.08);
        sl.rotation.x = LEAN;
        g.add(sl);
    });

    // ── ХҮЗҮҮ + ТОЛГОЙ (доош хазайсан) ──
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.18), skin);
    neck.position.set(0, 1.42, 0.05);
    neck.rotation.x = LEAN;
    g.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), skin);
    head.position.set(0, 1.55, 0.18);
    head.rotation.x = 0.55;
    g.add(head);

    // Үс
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.10, 0.34), hair);
    hairTop.position.set(0, 1.71, 0.13);
    hairTop.rotation.x = 0.55;
    g.add(hairTop);

    // Сүүдэр
    g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    return g;
}

// Хоёр бөх — овоогийн хажуу талд, бие биенийгээ ашсан байрлалд
// X-тэнхлэг дагуу нүүр тулсан: улаан зодогт vs хөх зодогт
scene.add(createWrestler(-31, 14, -Math.PI / 2, 0xC8221C, 0x9C2B22));   // Улаан, баруун тийш харна
scene.add(createWrestler(-27, 14,  Math.PI / 2, 0x2A5EA8, 0x1E3F7A));   // Хөх, зүүн тийш харна

// Бөхийн хажууд "зул" — улаан хивс / монгол хээт ширтэг
const _matMt = new THREE.MeshStandardMaterial({ color: 0x8B3A2A, roughness: 0.92 });
const arena = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), _matMt);
arena.rotation.x = -Math.PI / 2;
arena.position.set(-29, 0.03, 14);
arena.receiveShadow = true;
scene.add(arena);

// Хээт хүрээ (алтан тойрог)
const arenaRing = new THREE.Mesh(
    new THREE.RingGeometry(3.0, 3.2, 32),
    new THREE.MeshStandardMaterial({ color: 0xE0B040, roughness: 0.45, metalness: 0.4, side: THREE.DoubleSide }));
arenaRing.rotation.x = -Math.PI / 2;
arenaRing.position.set(-29, 0.04, 14);
scene.add(arenaRing);

// ══════════════════════════════════════════════════════════════════
// УТАА — гэрийн тооноос гарах нарийхан утаа (амьдралын шинж)
// ══════════════════════════════════════════════════════════════════
(function buildSmoke() {
    const N = 60;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const lifetime = new Float32Array(N);
    for (let i = 0; i < N; i++) {
        pos[i * 3]     = (Math.random() - 0.5) * 0.4;
        pos[i * 3 + 1] = 4.4 + Math.random() * 0.3;     // тооноос гарна
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
        lifetime[i] = Math.random() * 4;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
        color: 0xCCC8C0, size: 0.55, transparent: true,
        opacity: 0.42, depthWrite: false
    });
    const smoke = new THREE.Points(geo, mat);
    scene.add(smoke);

    window._tickSmoke = function(dt) {
        const p = geo.attributes.position.array;
        for (let i = 0; i < N; i++) {
            lifetime[i] += dt;
            // Утаа дээш нэгэн тэгш салхиар хийсэгнэ
            p[i * 3]     += Math.sin(lifetime[i] * 0.7 + i) * dt * 0.18;
            p[i * 3 + 1] += dt * (0.6 + (i % 5) * 0.12);
            p[i * 3 + 2] += Math.cos(lifetime[i] * 0.5 + i * 0.3) * dt * 0.12;
            if (p[i * 3 + 1] > 9 || lifetime[i] > 6) {
                p[i * 3]     = (Math.random() - 0.5) * 0.3;
                p[i * 3 + 1] = 4.4;
                p[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
                lifetime[i]  = 0;
            }
        }
        geo.attributes.position.needsUpdate = true;
    };
})();

// ── Нарсан ой — уулнаас тавиур руу буух ──────────────────────────
// Баруун талын ой
[[-35,-18],[-40,-14],[-38,-27],[-45,-21],[-32,-31],[-42,-34],
 [-50,-18],[-55,-25],[-48,-32],[-36,-40],[-44,-38],[-30,-24]
].forEach(([tx,tz]) => scene.add(createTree(tx, tz, 'pine', 4.5 + Math.random() * 4)));

// Зүүн талын хус + нарс холимог
[[30,-17],[35,-23],[28,-29],[38,-14],[32,-27],[42,-18],
 [36,-32],[25,-22],[44,-26],[38,-38]
].forEach(([tx,tz], i) =>
    scene.add(createTree(tx, tz, i % 3 === 0 ? 'birch' : 'pine', 4 + Math.random() * 3)));

// Голын хажуугийн нарс
[[16,-55],[18,-48],[20,-40],[22,-32],[14,-60]].forEach(([tx,tz]) =>
    scene.add(createTree(tx, tz, 'pine', 5 + Math.random() * 3)));

// ── ҮХЭР ТЭРЭГ (уламжлалт монгол 2 дугуйт тэрэг) ─────────────────
function createOxCart(x, z, rotY = 0) {
    const g      = new THREE.Group();
    const woodMt = MCMat(0xFFFFFF, MCTex.wood,     2, 0.88);
    const drkMt  = MCMat(0xFFFFFF, MCTex.darkWood, 2, 0.92);
    const metMt  = new THREE.MeshStandardMaterial({ color: 0x404040, roughness: 0.35, metalness: 0.85 });
    const ropeMt = new THREE.MeshStandardMaterial({ color: 0xB09060, roughness: 0.95 });

    const WY = 0.65;           // wheel center height
    const WR = 0.65;           // wheel radius  (large!)
    const AZ = 0.3;            // axle Z (rear area of platform)
    const PW = 1.4;            // platform width (X)
    const PL = 1.55;           // platform length (Z)
    const PH = WY + 0.28;      // platform floor height
    const WX = PW / 2 + 0.28; // wheel lateral offset

    // ── Шонгор — 2 урт дугуй модон хэл (long round shaft poles) ──
    const SHAFT_L = 6.8;
    const SHAFT_CZ = AZ - PL / 2 - SHAFT_L / 2; // center of shaft cylinder
    [-0.22, 0.22].forEach(sx => {
        const shaft = new THREE.Mesh(
            new THREE.CylinderGeometry(0.044, 0.062, SHAFT_L, 9),
            drkMt
        );
        shaft.rotation.x = Math.PI / 2;
        shaft.position.set(sx, PH - 0.1, SHAFT_CZ);
        g.add(shaft);
    });

    // Уг хөндлөн мод (yoke crossbar near shaft tips)
    const yokeZ = SHAFT_CZ - SHAFT_L / 2 + 0.55;
    const yoke  = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.68, 8), drkMt);
    yoke.rotation.z = Math.PI / 2;
    yoke.position.set(0, PH - 0.12, yokeZ);
    g.add(yoke);

    // Оосор — уяалт (lashing ropes at yoke)
    [-0.28, 0.28].forEach(rx => {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.45, 6), ropeMt);
        rope.position.set(rx, PH - 0.14, yokeZ);
        rope.rotation.z = 0.32;
        g.add(rope);
    });

    // ── Тавцан — нээлттэй самбар (open slat platform) ─────────────
    // Two longitudinal side beams under slats
    [-(PW / 2 - 0.05), PW / 2 - 0.05].forEach(bx => {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, PL), drkMt);
        beam.position.set(bx, PH - 0.05, AZ);
        g.add(beam);
    });
    // Cross slats with visible gaps (8 slats)
    const SLAT_N = 8;
    for (let i = 0; i < SLAT_N; i++) {
        const sz = AZ - PL / 2 + (i + 0.5) * (PL / SLAT_N);
        const slat = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.065, 0.09), woodMt);
        slat.position.set(0, PH, sz);
        g.add(slat);
    }

    // ── Тэнхлэг (axle, along X) ─────────────────────────────────────
    const axle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.058, 0.058, PW + 0.6, 10),
        drkMt
    );
    axle.rotation.z = Math.PI / 2;
    axle.position.set(0, WY, AZ);
    g.add(axle);

    // ── Дугуй × 2 (large spoked wheels, wheel plane = YZ) ──────────
    [-WX, WX].forEach(wx => {
        // Гадна тойрог (rim)
        const rim = new THREE.Mesh(new THREE.TorusGeometry(WR, 0.065, 8, 22), drkMt);
        rim.rotation.y = Math.PI / 2;
        rim.position.set(wx, WY, AZ);
        g.add(rim);

        // Металл хүрд (iron tire)
        const tire = new THREE.Mesh(new THREE.TorusGeometry(WR, 0.027, 6, 22), metMt);
        tire.rotation.y = Math.PI / 2;
        tire.position.set(wx + Math.sign(wx) * 0.055, WY, AZ);
        g.add(tire);

        // Тоног (spokes) × 8 — rotation.x rotates within YZ plane
        for (let s = 0; s < 8; s++) {
            const a = (s / 8) * Math.PI * 2;
            const spoke = new THREE.Mesh(
                new THREE.CylinderGeometry(0.026, 0.026, WR * 1.84, 6),
                woodMt
            );
            spoke.rotation.x = a;
            spoke.position.set(wx, WY, AZ);
            g.add(spoke);
        }

        // Голын тойрог (hub)
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.15, 9), drkMt);
        hub.rotation.z = Math.PI / 2;
        hub.position.set(wx, WY, AZ);
        g.add(hub);
    });

    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return g;
}

// Тэрэг — гэрийн баруун талд, хаалгатай ойролцоо
scene.add(createOxCart(10, 4, Math.PI * 0.15));

// Хүмүүс — уяаны дэргэд
// Эрэгтэй — хүрэн deel
const _personMan   = createPerson(15.5, 19.5, Math.PI + 0.15, false, 0x6A4A28);
// Эмэгтэй — хөх deel (монгол уламжлалт)
const _personWoman = createPerson(20.5, 19.2, Math.PI - 0.2,  false, 0x2A4878);
// Хүүхэд — улбар шар deel
const _personChild = createPerson(18.0, 14.8, Math.PI + 0.4,  true,  0xB56428);
[_personMan, _personWoman, _personChild].forEach(p => {
    p.userData.isPerson  = true;
    p.userData.personLabel = p === _personChild ? 'Хүүхэд' : (p === _personWoman ? 'Эмэгтэй' : 'Эрэгтэй');
    scene.add(p);
});

// ══════════════════════════════════════════════════════════════════
// ЦАГ АГААР — өдөр/шөнө, бороо, цас, манан
// ══════════════════════════════════════════════════════════════════

// ── Өдөр / Шөнө ─────────────────────────────────────────────────
let _isNight = false;
const _nightBg = new THREE.Color(0x06090F);
const _dayFog  = new THREE.Color(0xC5DFF0);
const _nightFog= new THREE.Color(0x06090F);

// ── НАР — fog нөлөөлдөггүй, camera-д ойр байрлуулж том харагдана ─
const _sunMat = new THREE.MeshBasicMaterial({
    color: 0xFFEE55, fog: false
});
const _sunSphere = new THREE.Mesh(new THREE.SphereGeometry(3.5, 20, 16), _sunMat);
_sunSphere.position.set(55, 48, -70);
scene.add(_sunSphere);
// Нарны гэрэлт цагариг
const _sunHaloMat = new THREE.MeshBasicMaterial({
    color: 0xFFDD88, transparent: true, opacity: 0.22, fog: false, side: THREE.DoubleSide
});
const _sunHalo = new THREE.Mesh(new THREE.RingGeometry(3.8, 7.5, 32), _sunHaloMat);
_sunHalo.position.copy(_sunSphere.position);
_sunHalo.lookAt(camera.position);
scene.add(_sunHalo);

// ── САР ─────────────────────────────────────────────────────────
const _moonMat = new THREE.MeshBasicMaterial({ color: 0xDDE8F4, fog: false });
const _moonSphere = new THREE.Mesh(new THREE.SphereGeometry(2.2, 18, 14), _moonMat);
_moonSphere.position.set(-48, 58, -72);
_moonSphere.visible = false;
scene.add(_moonSphere);
// Сарны хүрэн гэрэл
const _moonHaloMat = new THREE.MeshBasicMaterial({
    color: 0xAABBCC, transparent: true, opacity: 0.15, fog: false, side: THREE.DoubleSide
});
const _moonHalo = new THREE.Mesh(new THREE.RingGeometry(2.5, 5.5, 32), _moonHaloMat);
_moonHalo.position.copy(_moonSphere.position);
_moonHalo.visible = false;
scene.add(_moonHalo);

const _moonGlow = new THREE.PointLight(0x8899CC, 0.7, 150);
_moonGlow.position.copy(_moonSphere.position);
_moonGlow.visible = false;
scene.add(_moonGlow);

// ── ОДОД — fog=false, camera-д ойрхон (r=120) ───────────────────
const STAR_COUNT = 2000;
const _starGeo = new THREE.BufferGeometry();
(function () {
    const pos = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.random() * Math.PI * 0.46;
        const r     = 110 + Math.random() * 30;
        pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
        pos[i*3+1] = Math.abs(r * Math.cos(phi)) + 5;
        pos[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
    }
    _starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
})();
const _starMat = new THREE.PointsMaterial({
    color: 0xFFFFFF, size: 0.7,
    transparent: true, opacity: 0.0, depthWrite: false, fog: false
});
const _starPoints = new THREE.Points(_starGeo, _starMat);
scene.add(_starPoints);

// ══════════════════════════════════════════════════════════════════
// ӨДӨР / ШӨНӨ — тасралтгүй мөчлөг (sun arc + sky gradient)
// ══════════════════════════════════════════════════════════════════
const CYCLE_SECONDS = 120;  // 1 өдөр ≈ 2 минут auto-mode-д
let _timeOfDay = 0.7;       // нар жаргах ойролцоо — алтан цаг (зургийн өнгөтэй ойртуулна)
let _autoCycle = false;

// Өнгөний key-frames (top ба bottom gradient)
const _skyKeys = [
    { t: 0.00, top: 0x020308, bottom: 0x0B1020 },  // шөнө дунд
    { t: 0.22, top: 0x1A2A50, bottom: 0x4A3A60 },  // үүр харанхуй
    { t: 0.27, top: 0x3A5080, bottom: 0xF08248 },  // нар гарах
    { t: 0.35, top: 0x6AA8E0, bottom: 0xD8E8F8 },  // өглөө
    { t: 0.50, top: 0x1A3D8C, bottom: 0xE8F4F0 },  // үд
    { t: 0.68, top: 0x3870C0, bottom: 0xF5E8D0 },  // үдээс хойш
    { t: 0.74, top: 0x4A3060, bottom: 0xE84828 },  // нар жаргах
    { t: 0.80, top: 0x1A1C40, bottom: 0x4A2050 },  // бүрэнхий
    { t: 1.00, top: 0x020308, bottom: 0x0B1020 },
];

function _lerpHex(a, b, t) {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    return (
        (Math.round(ar + (br - ar) * t) << 16) |
        (Math.round(ag + (bg - ag) * t) << 8)  |
         Math.round(ab + (bb - ab) * t)
    );
}

function _sampleSky(t) {
    let a = _skyKeys[0], b = _skyKeys[_skyKeys.length - 1];
    for (let i = 0; i < _skyKeys.length - 1; i++) {
        if (t >= _skyKeys[i].t && t <= _skyKeys[i+1].t) {
            a = _skyKeys[i]; b = _skyKeys[i+1]; break;
        }
    }
    const f = (t - a.t) / Math.max(0.0001, b.t - a.t);
    return { top: _lerpHex(a.top, b.top, f), bottom: _lerpHex(a.bottom, b.bottom, f) };
}

// Динамик тэнгэрийн canvas (gradient)
const _skyCanvas = document.createElement('canvas');
_skyCanvas.width = 2; _skyCanvas.height = 256;
const _skyCtx = _skyCanvas.getContext('2d');
const _dynSkyTex = new THREE.CanvasTexture(_skyCanvas);
_dynSkyTex.magFilter = THREE.LinearFilter;

function _paintSky(topHex, bottomHex) {
    const top = '#' + topHex.toString(16).padStart(6, '0');
    const bot = '#' + bottomHex.toString(16).padStart(6, '0');
    const g = _skyCtx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.0,  top);
    g.addColorStop(0.65, _lerpAsHex(topHex, bottomHex, 0.5));
    g.addColorStop(1.0,  bot);
    _skyCtx.fillStyle = g;
    _skyCtx.fillRect(0, 0, 2, 256);
    _dynSkyTex.needsUpdate = true;
}
function _lerpAsHex(a, b, t) {
    const x = _lerpHex(a, b, t);
    return '#' + x.toString(16).padStart(6, '0');
}

// Анхны sky-г шууд тооцож орлуулна (нарны цагариг/буд одоогийн байрлалаа хадгалж үлдэнэ)
(function () {
    const s = _sampleSky(_timeOfDay);
    _paintSky(s.top, s.bottom);
    scene.background = _dynSkyTex;
})();

// Нарны нумны радиус (X-Y хавтгайд)
const SUN_ARC_R = 82;
const SUN_Z_BIAS = -62;

let _fogOn = false;

function _tickDayNight(dt) {
    if (_autoCycle) _timeOfDay = (_timeOfDay + dt / CYCLE_SECONDS) % 1;

    // Нар: 0.25 → зүүн тал горизонт, 0.5 → толгой дээр, 0.75 → баруун горизонт
    const ang = (_timeOfDay - 0.25) * Math.PI * 2;
    const sx = Math.cos(ang) * SUN_ARC_R;
    const sy = Math.sin(ang) * SUN_ARC_R;
    _sunSphere.position.set(sx, sy, SUN_Z_BIAS);
    _sunHalo.position.copy(_sunSphere.position);
    _moonSphere.position.set(-sx, -sy, SUN_Z_BIAS);
    _moonHalo.position.copy(_moonSphere.position);
    _moonGlow.position.copy(_moonSphere.position);

    const sunPitch = sy / SUN_ARC_R;        //  1 үд, 0 горизонт, -1 шөнө дунд
    const sunUp    = sy >  1.0;
    const moonUp   = -sy > 1.0;
    _sunSphere.visible  = sunUp;
    _sunHalo.visible    = sunUp;
    _moonSphere.visible = moonUp;
    _moonHalo.visible   = moonUp;
    _moonGlow.visible   = moonUp;

    // Нарны өнгө — үд цайвар, горизонт дээр улбар шар
    const warm = Math.max(0, 1 - Math.max(0, sunPitch) * 2.5);
    const sunColor = _lerpHex(0xFFF4D6, 0xFF6028, warm);
    _sunMat.color.setHex(sunColor);
    _sunHaloMat.color.setHex(_lerpHex(0xFFDD88, 0xFF5010, warm));
    _sunHaloMat.opacity = 0.22 + warm * 0.14;

    // Гэрэлтүүлэг — нарны өргөгдөлтэй пропорциональ
    const dayLvl   = Math.max(0, sunPitch);
    const nightLvl = Math.max(0, -sunPitch);
    sun.intensity  = 0.06 + dayLvl * 2.9;
    sun.color.setHex(sunColor);
    hemi.intensity = 0.12 + dayLvl * 0.85;
    fill.intensity = 0.04 + dayLvl * 0.6;

    // Од — нар 5° доош буух үед гарна
    _starMat.opacity = Math.min(0.92, Math.max(0, -sunPitch - 0.03) * 1.6);

    // Тэнгэрийн өнгө (өвөл болбол сэрүүн сүүн туяа руу холино)
    const sky = _sampleSky(_timeOfDay);
    const skyTop = _winterOn ? _lerpHex(sky.top,    0xB8D0E8, 0.28) : sky.top;
    const skyBot = _winterOn ? _lerpHex(sky.bottom, 0xE4ECF4, 0.32) : sky.bottom;
    _paintSky(skyTop, skyBot);

    // Манан өнгө, нягтрал
    scene.fog.color.setHex(skyBot);
    if (!_fogOn) scene.fog.density = 0.008 + nightLvl * 0.012 + (_winterOn ? 0.010 : 0);

    // _isNight-г UI btn-daynight-ийн label хадгалахад ашиглана
    _isNight = sunPitch < 0;
}

window.toggleDayNight = function () {
    // Хамгийн ойрын "өдөр/шөнө"-д snap (auto-cycle-ыг зогсооно)
    _autoCycle = false;
    _timeOfDay = _timeOfDay > 0.25 && _timeOfDay < 0.75 ? 0.0 : 0.5;
    _tickDayNight(0);
    const btn = document.getElementById('btn-daynight');
    if (btn) btn.textContent = _timeOfDay === 0.0 ? '☀️ Өдөр' : '🌙 Шөнө';
    const autoBtn = document.getElementById('btn-autocycle');
    if (autoBtn) autoBtn.textContent = '🕐 Auto цаг';
};

window.toggleAutoCycle = function () {
    _autoCycle = !_autoCycle;
    const btn = document.getElementById('btn-autocycle');
    if (btn) btn.textContent = _autoCycle ? '🕐 Auto OFF' : '🕐 Auto цаг';
};

// Slider-аар цагийг тохируулах
window.setTimeOfDay = function (t) {
    _autoCycle = false;
    _timeOfDay = Math.max(0, Math.min(1, t));
    _tickDayNight(0);
    // Slider дагалдсан нар/сар icon
    const left = document.getElementById('dn-icon-left');
    const right = document.getElementById('dn-icon-right');
    if (left)  left.textContent  = (_timeOfDay < 0.25 || _timeOfDay > 0.75) ? '🌙' : '🌅';
    if (right) right.textContent = (_timeOfDay >= 0.4 && _timeOfDay < 0.6) ? '☀' : '🌇';
};

// ── Манан ────────────────────────────────────────────────────────
window.toggleFog = function () {
    _fogOn = !_fogOn;
    scene.fog.density = _fogOn ? 0.050 : 0.010;
    const btn = document.getElementById('btn-fog');
    if (btn) btn.textContent = _fogOn ? '🌫 Манан OFF' : '🌫 Манан';
};

// ── Бороо & Цас — particle systems ──────────────────────────────
const PARTICLE_COUNT = 2200;

function _makeParticles(color, size) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        pos[i*3]   = (Math.random() - 0.5) * 80;
        pos[i*3+1] = Math.random() * 28;
        pos[i*3+2] = (Math.random() - 0.5) * 80;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.72, depthWrite: false });
    return new THREE.Points(geo, mat);
}

const _rain  = _makeParticles(0xAAD4EE, 0.08);
const _snow  = _makeParticles(0xEEF4FF, 0.18);
_rain.visible = false;
_snow.visible = false;
scene.add(_rain);
scene.add(_snow);

let _rainOn = false, _snowOn = false;

window.toggleRain = function () {
    _rainOn = !_rainOn;
    _rain.visible = _rainOn;
    if (_rainOn) { _snowOn = false; _snow.visible = false; }
    const btn = document.getElementById('btn-rain');
    if (btn) btn.textContent = _rainOn ? '🌧 OFF' : '🌧 Бороо';
};

window.toggleSnow = function () {
    _snowOn = !_snowOn;
    _snow.visible = _snowOn;
    if (_snowOn) { _rainOn = false; _rain.visible = false; }
    const btn = document.getElementById('btn-snow');
    if (btn) btn.textContent = _snowOn ? '❄️ OFF' : '❄️ Цас';
};

// Particle tick — animation loop дотор дуудна
function _tickWeather(dt) {
    if (_rainOn) {
        const pos = _rain.geometry.attributes.position.array;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            pos[i*3+1] -= 14 * dt;
            if (pos[i*3+1] < 0) { pos[i*3+1] = 26 + Math.random() * 2; }
        }
        _rain.geometry.attributes.position.needsUpdate = true;
    }
    if (_snowOn) {
        const pos = _snow.geometry.attributes.position.array;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            pos[i*3+1] -= 1.4 * dt;
            pos[i*3]   += Math.sin(pos[i*3+1] * 0.5 + i) * 0.008;
            if (pos[i*3+1] < 0) { pos[i*3+1] = 26 + Math.random() * 2; }
        }
        _snow.geometry.attributes.position.needsUpdate = true;
    }
}

// ══════════════════════════════════════════════════════════════════
// ӨВЛИЙН ГОРИМ — Winter Mode
//  - цас бүрхсэн газар
//  - гэрийн дээвэр дээрх цас
//  - тоононоос босох утаа
//  - цасан ширхэг (reuses _snow) + сэрүүн тэнгэр
// ══════════════════════════════════════════════════════════════════
let _winterOn = false;

// Цасан газрын texture (MC-style 32px)
const _snowGroundTex = _mkTex((ctx, s) => {
    ctx.fillStyle = '#F2F4F8'; ctx.fillRect(0,0,s,s);
    _scatter(ctx, s, ['#E4E8F0','#FFFFFF','#D8DCE4','#F8FAFF'], 0.30);
}, 32);
_snowGroundTex.wrapS = _snowGroundTex.wrapT = THREE.RepeatWrapping;
_snowGroundTex.magFilter = THREE.NearestFilter;
_snowGroundTex.minFilter = THREE.NearestMipmapNearestFilter;
_snowGroundTex.repeat.set(30, 30);
const _originalGroundMap = ground.material.map;

// Гэрийн дээврийн цас — roof: CylinderGeometry(1.25, 5.05, 0.38), wallH=2.6
const _snowRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(1.22, 5.10, 0.44, 32, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xF4F8FC, roughness: 0.95, side: THREE.DoubleSide })
);
_snowRoof.position.set(0, 2.6 + 0.38 / 2 + 0.015, 0);
_snowRoof.castShadow = true;
_snowRoof.receiveShadow = true;
_snowRoof.visible = false;
scene.add(_snowRoof);

// Утаа (тоононоос)
const SMOKE_COUNT = 140;
const _smokeGeo = new THREE.BufferGeometry();
const _smokePos = new Float32Array(SMOKE_COUNT * 3);
const _smokeLife = new Float32Array(SMOKE_COUNT);
for (let i = 0; i < SMOKE_COUNT; i++) {
    _smokePos[i*3] = 0; _smokePos[i*3+1] = 3.05; _smokePos[i*3+2] = 0;
    _smokeLife[i] = Math.random();
}
_smokeGeo.setAttribute('position', new THREE.BufferAttribute(_smokePos, 3));
const _smokeMat = new THREE.PointsMaterial({
    color: 0xDADAD6, size: 0.55, transparent: true, opacity: 0.52, depthWrite: false
});
const _smoke = new THREE.Points(_smokeGeo, _smokeMat);
_smoke.visible = false;
scene.add(_smoke);

function _tickSmoke(dt) {
    if (!_smoke.visible) return;
    const pos = _smokeGeo.attributes.position.array;
    for (let i = 0; i < SMOKE_COUNT; i++) {
        _smokeLife[i] += dt * 0.22;
        if (_smokeLife[i] > 1) {
            _smokeLife[i] = 0;
            pos[i*3]   = (Math.random() - 0.5) * 0.25;
            pos[i*3+1] = 3.05;
            pos[i*3+2] = (Math.random() - 0.5) * 0.25;
        } else {
            pos[i*3+1] += dt * (0.9 + _smokeLife[i] * 0.4);
            pos[i*3]   += Math.sin(_smokeLife[i] * 3.2 + i) * dt * 0.18;
            pos[i*3+2] += Math.cos(_smokeLife[i] * 3.2 + i * 0.7) * dt * 0.18;
        }
    }
    _smokeGeo.attributes.position.needsUpdate = true;
}

window.toggleWinter = function () {
    _winterOn = !_winterOn;
    // Газрын texture
    ground.material.map = _winterOn ? _snowGroundTex : _originalGroundMap;
    ground.material.needsUpdate = true;
    // Дээврийн цас
    _snowRoof.visible = _winterOn;
    // Цасан ширхэг (reuse weather snow)
    if (_winterOn) {
        _snowOn = true; _snow.visible = true;
        _rainOn = false; _rain.visible = false;
        _smoke.visible = true;
    } else {
        _smoke.visible = false;
    }
    // Sync rain/snow button labels
    const sbtn = document.getElementById('btn-snow');
    if (sbtn) sbtn.textContent = _snowOn ? '❄️ OFF' : '❄ Цас';
    const rbtn = document.getElementById('btn-rain');
    if (rbtn) rbtn.textContent = _rainOn ? '🌧 OFF' : '🌧 Бороо';
    const wbtn = document.getElementById('btn-winter');
    if (wbtn) wbtn.textContent = _winterOn ? '🌨 Өвөл OFF' : '🌨 Өвөл';
};

function focusOnGer() {
    camera.position.set(6, 4, 6);
    controls.target.set(0, 2, 0);
    controls.update();
}

// ══════════════════════════════════════════════════════════════════
// ДУУ АВИА — Web Audio API procedural sounds
// ══════════════════════════════════════════════════════════════════
let _audio = null;
let _soundOn = false;

function _initAudio() {
    if (_audio) return _audio;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();

    // Мастер
    const master = ctx.createGain();
    master.gain.value = 0.0;          // унтраалттай эхэлнэ
    master.connect(ctx.destination);

    // ── Салхи (brown noise + low-pass + LFO) ──
    const sr = ctx.sampleRate;
    const windBuf = ctx.createBuffer(1, sr * 4, sr);
    const wd = windBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < wd.length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        wd[i] = last * 3.5;
    }
    const wind = ctx.createBufferSource();
    wind.buffer = windBuf; wind.loop = true;
    const windFilt = ctx.createBiquadFilter();
    windFilt.type = 'lowpass'; windFilt.frequency.value = 420;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.22;
    wind.connect(windFilt).connect(windGain).connect(master);
    wind.start();
    // Салхины хэлбэлзэл (LFO)
    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.11;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 0.13;
    windLfo.connect(windLfoGain).connect(windGain.gain);
    windLfo.start();

    // ── Гал түймэрийн сувгийн gain (ойртох үед сонсогдоно) ──
    const fireGain = ctx.createGain();
    fireGain.gain.value = 0.0;
    fireGain.connect(master);

    // ── Морин хуур (sustained drone: 2 detuned sawtooth + low-pass) ──
    const khuurGain = ctx.createGain();
    khuurGain.gain.value = 0.05;
    khuurGain.connect(master);
    const khFilt = ctx.createBiquadFilter();
    khFilt.type = 'lowpass'; khFilt.frequency.value = 850; khFilt.Q.value = 0.5;
    khFilt.connect(khuurGain);
    const kh1 = ctx.createOscillator();
    kh1.type = 'sawtooth'; kh1.frequency.value = 146.83; kh1.detune.value = -6;
    const kh2 = ctx.createOscillator();
    kh2.type = 'sawtooth'; kh2.frequency.value = 220.00; kh2.detune.value = 4;
    kh1.connect(khFilt); kh2.connect(khFilt);
    kh1.start(); kh2.start();
    const khLfo = ctx.createOscillator();
    khLfo.frequency.value = 0.07;
    const khLfoGain = ctx.createGain();
    khLfoGain.gain.value = 0.025;
    khLfo.connect(khLfoGain).connect(khuurGain.gain);
    khLfo.start();

    _audio = {
        ctx, master, fireGain, windGain, khuurGain,
        nextCrack: 0, nextBird: 0, nextNeigh: 0, nextBleat: 0,
    };
    return _audio;
}

function _playCrack(time, loudness = 1) {
    const a = _audio; if (!a) return;
    const len = 0.06 + Math.random() * 0.05;
    const buf = a.ctx.createBuffer(1, Math.max(1, Math.floor(a.ctx.sampleRate * len)), a.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
        const env = Math.exp(-i / d.length * 6);
        d[i] = (Math.random() * 2 - 1) * env * loudness;
    }
    const src = a.ctx.createBufferSource();
    src.buffer = buf;
    const hp = a.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1100;
    src.connect(hp).connect(a.fireGain);
    src.start(time);
}

function _playBird(time) {
    const a = _audio; if (!a) return;
    const osc = a.ctx.createOscillator();
    osc.type = 'sine';
    const f = 2100 + Math.random() * 1800;
    osc.frequency.setValueAtTime(f, time);
    osc.frequency.exponentialRampToValueAtTime(f * 1.7, time + 0.10);
    osc.frequency.exponentialRampToValueAtTime(f * 0.8, time + 0.22);
    const gn = a.ctx.createGain();
    gn.gain.setValueAtTime(0, time);
    gn.gain.linearRampToValueAtTime(0.06, time + 0.02);
    gn.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
    osc.connect(gn).connect(a.master);
    osc.start(time); osc.stop(time + 0.32);
}

function _playNeigh(time) {
    const a = _audio; if (!a) return;
    const osc = a.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, time);
    osc.frequency.linearRampToValueAtTime(175, time + 0.32);
    osc.frequency.linearRampToValueAtTime(250, time + 0.60);
    osc.frequency.linearRampToValueAtTime(160, time + 0.95);
    const flt = a.ctx.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 700; flt.Q.value = 2.2;
    const gn = a.ctx.createGain();
    gn.gain.setValueAtTime(0, time);
    gn.gain.linearRampToValueAtTime(0.12, time + 0.05);
    gn.gain.setValueAtTime(0.12, time + 0.85);
    gn.gain.exponentialRampToValueAtTime(0.001, time + 1.05);
    osc.connect(flt).connect(gn).connect(a.master);
    osc.start(time); osc.stop(time + 1.1);
}

function _playBleat(time) {
    const a = _audio; if (!a) return;
    const osc = a.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(420, time);
    const lfo = a.ctx.createOscillator();
    lfo.frequency.value = 18;
    const lfoGain = a.ctx.createGain();
    lfoGain.gain.value = 22;
    lfo.connect(lfoGain).connect(osc.frequency);
    const flt = a.ctx.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 800; flt.Q.value = 1.5;
    const gn = a.ctx.createGain();
    gn.gain.setValueAtTime(0, time);
    gn.gain.linearRampToValueAtTime(0.08, time + 0.04);
    gn.gain.setValueAtTime(0.08, time + 0.38);
    gn.gain.exponentialRampToValueAtTime(0.001, time + 0.55);
    osc.connect(flt).connect(gn).connect(a.master);
    osc.start(time); lfo.start(time);
    osc.stop(time + 0.6); lfo.stop(time + 0.6);
}

function _tickSound(dt, camPos) {
    if (!_audio || !_soundOn) return;
    const a = _audio;
    const now = a.ctx.currentTime;
    // Гал зуух эхэн цэг (0,0,0) — ойртох үед crackle чанга болно
    const dx = camPos.x, dy = camPos.y - 0.6, dz = camPos.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    const firePresence = Math.max(0, 1 - dist / 10);
    a.fireGain.gain.setTargetAtTime(0.22 * firePresence, now, 0.4);
    if (firePresence > 0.10 && now >= a.nextCrack) {
        _playCrack(now, 0.5 + Math.random() * 0.6);
        a.nextCrack = now + 0.25 + Math.random() * 0.75;
    }
    // Шувуу (үргэлж цэнэг хэвээр)
    if (now >= a.nextBird) {
        _playBird(now);
        a.nextBird = now + 3.5 + Math.random() * 7;
    }
    // Мориноос үе үе янцгах
    if (now >= a.nextNeigh) {
        _playNeigh(now);
        a.nextNeigh = now + 14 + Math.random() * 22;
    }
    // Хонины майлаан
    if (now >= a.nextBleat) {
        _playBleat(now);
        a.nextBleat = now + 10 + Math.random() * 16;
    }
}

window.toggleSound = function () {
    const a = _initAudio();
    if (!a) return;
    _soundOn = !_soundOn;
    if (a.ctx.state === 'suspended') a.ctx.resume();
    a.master.gain.setTargetAtTime(_soundOn ? 0.55 : 0.0, a.ctx.currentTime, 0.25);
    const btn = document.getElementById('btn-sound');
    if (btn) btn.textContent = _soundOn ? '🔊 OFF' : '🔇 Дуу';
};

// ══════════════════════════════════════════════════════════════════
// АМЬТАН + ХҮН ХӨДӨЛГӨӨН (patrol waypoints)
// ══════════════════════════════════════════════════════════════════
function addWalker(mesh, waypoints, speed = 1.4) {
    _walkers.push({ mesh, waypoints, speed, idx: 0, t: 0,
        legT: 0,   // leg swing phase
        legs: []   // leg mesh children for animation
    });
}

// Harvest leg-children of each animal group for leg-swing animation
function _findLegs(group) {
    // Legs are BoxGeometry children at low y positions
    const legs = [];
    group.children.forEach(c => {
        if (c.isMesh && c.geometry && c.geometry.type === 'BoxGeometry' &&
            c.position.y < 0.7 && Math.abs(c.position.x) > 0.1) {
            legs.push(c);
        }
    });
    return legs;
}

function _tickWalkers(dt) {
    for (const w of _walkers) {
        const from = w.waypoints[w.idx];
        const to   = w.waypoints[(w.idx + 1) % w.waypoints.length];
        const dx = to.x - from.x, dz = to.z - from.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.01) { w.idx = (w.idx + 1) % w.waypoints.length; continue; }

        w.t += (w.speed / dist) * dt;
        if (w.t >= 1) {
            w.t = 0;
            w.idx = (w.idx + 1) % w.waypoints.length;
        }

        // Position
        w.mesh.position.x = from.x + dx * w.t;
        w.mesh.position.z = from.z + dz * w.t;

        // Face direction of travel (animals built with +X forward, so offset −π/2)
        w.mesh.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;

        // Simple leg swing
        w.legT += dt * w.speed * 3.5;
        const swing = Math.sin(w.legT) * 0.28;
        if (w.legs.length === 0) w.legs = _findLegs(w.mesh);
        w.legs.forEach((leg, i) => { leg.rotation.x = swing * (i % 2 === 0 ? 1 : -1); });
    }
}

// Register grazing horses — баруун талаар өргөн нутагт бэлчинэ
const _grazeHorses = [
    createHorse(-28, -8,  0.7, 0x7A4828),
    createHorse(-34,  8,  2.0, 0x3A2010),
    createHorse(-26, 26, -0.4, 0xB07040),
];
_grazeHorses.forEach(h => { h.userData.isHorse = true; scene.add(h); });
addWalker(_grazeHorses[0], [
    {x:-28,z:-8},{x:-36,z:2},{x:-42,z:-4},{x:-34,z:-16},{x:-24,z:-12}], 1.4);
addWalker(_grazeHorses[1], [
    {x:-34,z:8},{x:-26,z:16},{x:-38,z:20},{x:-44,z:10},{x:-36,z:2}], 1.1);
addWalker(_grazeHorses[2], [
    {x:-26,z:26},{x:-18,z:32},{x:-30,z:36},{x:-40,z:28},{x:-32,z:20}], 1.3);

// Register cows — гэрийн өмнөд зүгт голын хажуугаар бэлчинэ
const _cows = [
    createCow(-18, -16, 0.4, 0x8B6050),
    createCow(-22, -10, 1.2, 0x5A3820),
    createCow(-14, -22,-0.3, 0x9A7060),
];
_cows.forEach(c => scene.add(c));
addWalker(_cows[0], [
    {x:-18,z:-16},{x:-10,z:-20},{x:-16,z:-10},{x:-24,z:-8},{x:-20,z:-18}], 0.8);
addWalker(_cows[1], [
    {x:-22,z:-10},{x:-14,z:-6},{x:-10,z:-14},{x:-20,z:-18},{x:-26,z:-14}], 0.7);
addWalker(_cows[2], [
    {x:-14,z:-22},{x:-20,z:-28},{x:-8,z:-26},{x:-6,z:-18},{x:-12,z:-14}], 0.9);

// Register camels — зүүн талаар тэмээ аажмаар явна
const _camels = [
    createCamel(22, -14, Math.PI * 0.7),
    createCamel(28, -20, Math.PI * 0.9),
];
_camels.forEach(c => scene.add(c));
addWalker(_camels[0], [
    {x:22,z:-14},{x:32,z:-8},{x:38,z:-16},{x:30,z:-24},{x:20,z:-20}], 0.65);
addWalker(_camels[1], [
    {x:28,z:-20},{x:36,z:-26},{x:42,z:-18},{x:34,z:-10},{x:26,z:-14}], 0.55);

// ── ТАВДУГААР хошуу мал (player-controlled person) placeholder ──

// ══════════════════════════════════════════════════════════════════
// МОНГОЛ АХУУ — гэрийн дотор нүүдэл+суудал хийдэг хүн (rigged)
// ══════════════════════════════════════════════════════════════════
function createMongolInhabitant(coatColor = 0x8A1D22, accentColor = 0xE0B828, skinColor = 0xC88B5A, opts = {}) {
    const {
        scale       = 1.0,
        hairColor   = 0x0B0604,
        hasBeard    = false,
        hasHat      = true,
        pantsColor  = 0x2A1E12,
        gaitSpeed   = 1.0,
    } = opts;

    const root = new THREE.Group();

    const skin   = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.88 });
    const hair   = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.95 });
    const coat   = new THREE.MeshStandardMaterial({ color: coatColor, roughness: 0.82 });
    const trim   = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.68 });
    const beltMt = new THREE.MeshStandardMaterial({ color: 0xE8B028, roughness: 0.55, metalness: 0.25 });
    const boot   = new THREE.MeshStandardMaterial({ color: 0x2A1408, roughness: 0.8 });
    const bootT  = new THREE.MeshStandardMaterial({ color: 0x6E1420, roughness: 0.7 });
    const pants  = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.92 });
    const hatMt  = new THREE.MeshStandardMaterial({ color: 0x3A0C0C, roughness: 0.9 });
    const hatTip = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.55 });
    const eyeMt  = new THREE.MeshStandardMaterial({ color: 0x1A0F06, roughness: 0.4 });
    const mouthM = new THREE.MeshStandardMaterial({ color: 0x5A2814, roughness: 0.9 });

    // ── Pelvis (body pivot — моугалзах, суух үед доошилно) ──
    const body = new THREE.Group();
    body.position.y = 0.86;
    root.add(body);

    // ── ХӨЛ (hip → thigh → knee → shin → foot) ──
    const thighLen = 0.44, shinLen = 0.40;
    function makeLeg(side) {
        const hip = new THREE.Group();
        hip.position.set(side * 0.09, 0, 0);
        body.add(hip);

        const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.14, thighLen, 0.15), pants);
        thigh.position.y = -thighLen / 2;
        hip.add(thigh);

        const knee = new THREE.Group();
        knee.position.y = -thighLen;
        hip.add(knee);

        // Гутлын шагай (shin)
        const shin = new THREE.Mesh(new THREE.BoxGeometry(0.13, shinLen, 0.14), boot);
        shin.position.y = -shinLen / 2;
        knee.add(shin);
        // Гутлын дээд захын улаан тууз
        const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.138, 0.05, 0.148), bootT);
        cuff.position.y = -0.03;
        knee.add(cuff);
        // Ул (хэвтээ)
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.24), boot);
        foot.position.set(0, -shinLen + 0.035, 0.05);
        knee.add(foot);
        // Монгол гутлын сүрлэн хамар (өөд харсан)
        const toe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.08), boot);
        toe.position.set(0, -shinLen + 0.095, 0.18);
        toe.rotation.x = -0.55;
        knee.add(toe);

        return { hip, knee };
    }
    const leftLeg  = makeLeg(-1);
    const rightLeg = makeLeg( 1);

    // ── Бие (торсо pivot — урагш гулзайх боломжтой) ──
    const torsoPivot = new THREE.Group();
    body.add(torsoPivot);

    // Дээлийн доод хэсэг (ташаа орчим)
    const deelLower = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.22, 0.30), coat);
    deelLower.position.y = -0.04;
    torsoPivot.add(deelLower);
    // Дээлийн хормой (хонго)
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.28, 0.34), coat);
    skirt.position.y = -0.22;
    torsoPivot.add(skirt);
    // Бүс (шар торгон бүс)
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.085, 0.33), beltMt);
    belt.position.y = 0.09;
    torsoPivot.add(belt);
    // Бүсний товч
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.02), trim);
    buckle.position.set(0, 0.09, 0.165);
    torsoPivot.add(buckle);

    // Бие (дунд)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.30, 0.28), coat);
    torso.position.y = 0.28;
    torsoPivot.add(torso);
    // Дээлийн урд зах (алтан хөвөө)
    const frontTrim = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.58, 0.02), trim);
    frontTrim.position.set(0.06, 0.12, 0.145);
    torsoPivot.add(frontTrim);
    // Цээж
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.22, 0.28), coat);
    chest.position.y = 0.53;
    torsoPivot.add(chest);
    // Захны тууз (өнгөт)
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.055, 0.26), trim);
    collar.position.y = 0.63;
    torsoPivot.add(collar);

    // Хүзүү
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.1), skin);
    neck.position.y = 0.70;
    torsoPivot.add(neck);

    // ── Толгой (өөрийн pivot-тай — дохих/хазайх) ──
    const head = new THREE.Group();
    head.position.y = 0.80;
    torsoPivot.add(head);
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.22, 0.20), skin);
    head.add(headMesh);
    // Үс
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.07, 0.205), hair);
    hairTop.position.y = 0.095;
    head.add(hairTop);
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.15, 0.04), hair);
    hairBack.position.set(0, 0.02, -0.085);
    head.add(hairBack);
    // Нүд × 2
    [-0.048, 0.048].forEach(ex => {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.025, 0.012), eyeMt);
        eye.position.set(ex, 0.005, 0.102);
        head.add(eye);
    });
    // Хөмсөг × 2
    [-0.048, 0.048].forEach(ex => {
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.012, 0.012), hair);
        brow.position.set(ex, 0.045, 0.102);
        head.add(brow);
    });
    // Ам
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.012, 0.012), mouthM);
    mouth.position.set(0, -0.055, 0.102);
    head.add(mouth);

    // ── Малгай (уламжлалт конус хэлбэрийн) ──
    if (hasHat) {
        const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.035, 14), hatMt);
        hatBrim.position.y = 0.15;
        head.add(hatBrim);
        const hatBody = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.155, 0.16, 14), hatMt);
        hatBody.position.y = 0.245;
        head.add(hatBody);
        const hatKnob = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), hatTip);
        hatKnob.position.y = 0.345;
        head.add(hatKnob);
    }

    // ── Сахал (хөгшин хүнд) ──
    if (hasBeard) {
        const beardMt = new THREE.MeshStandardMaterial({ color: 0xE8E0D0, roughness: 0.95 });
        const beard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.10, 0.03), beardMt);
        beard.position.set(0, -0.09, 0.102);
        head.add(beard);
        const mus = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.02, 0.012), beardMt);
        mus.position.set(0, -0.035, 0.104);
        head.add(mus);
    }

    // ── Гар (shoulder → upperArm → elbow → forearm → hand) ──
    function makeArm(side) {
        const shoulder = new THREE.Group();
        shoulder.position.set(side * 0.24, 0.55, 0);
        torsoPivot.add(shoulder);

        const upperLen = 0.30;
        const upper = new THREE.Mesh(new THREE.BoxGeometry(0.11, upperLen, 0.12), coat);
        upper.position.y = -upperLen / 2;
        shoulder.add(upper);

        const elbow = new THREE.Group();
        elbow.position.y = -upperLen;
        shoulder.add(elbow);

        const foreLen = 0.26;
        const fore = new THREE.Mesh(new THREE.BoxGeometry(0.10, foreLen, 0.11), coat);
        fore.position.y = -foreLen / 2;
        elbow.add(fore);
        // Ханцуйны зах (өнгөт тууз)
        const wristTrim = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.035, 0.118), trim);
        wristTrim.position.y = -foreLen + 0.018;
        elbow.add(wristTrim);
        // Гар
        const hand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.10, 0.09), skin);
        hand.position.y = -foreLen - 0.055;
        elbow.add(hand);

        return { shoulder, elbow };
    }
    const leftArm  = makeArm(-1);
    const rightArm = makeArm( 1);

    root.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

    if (scale !== 1.0) root.scale.setScalar(scale);

    root.userData = {
        body, torsoPivot, head,
        legs: {
            leftHip:  leftLeg.hip,  leftKnee:  leftLeg.knee,
            rightHip: rightLeg.hip, rightKnee: rightLeg.knee,
        },
        arms: {
            leftSh:  leftArm.shoulder,  leftEl:  leftArm.elbow,
            rightSh: rightArm.shoulder, rightEl: rightArm.elbow,
        },
        standY: 0.86,
        sitY:   0.52,
        phase:  0,
        blend:  0,         // 0 = босоо/явах, 1 = суух
        isMoving: false,
        gaitSpeed,
    };

    return root;
}

// ── Pose blending: walking vs sitting ──────────────────────────
function _applyHumanPose(ud, dt) {
    // Цикл фаз — явах үед өсөнө, суусан/зогссон үед зогсоно
    if (ud.isMoving) ud.phase += dt * 8.5 * (ud.gaitSpeed ?? 1);
    const ph = ud.phase;
    const sw = ud.isMoving ? Math.sin(ph) : 0;

    // === ЯВАХ/ЗОГСОХ ПОЗ (A) ===
    const walkHipL  = sw *  0.75;
    const walkHipR  = sw * -0.75;
    // Knee bend — хөлөө өргөх үед илүү нугалагдана (swing phase)
    const walkKneeL = 0.12 + Math.max(0, -Math.sin(ph - 0.4)) * 0.8;
    const walkKneeR = 0.12 + Math.max(0, -Math.sin(ph + Math.PI - 0.4)) * 0.8;
    // Гар ↔ хөл эсрэг чиглэлд ганхана
    const walkShL   = sw * -0.55;
    const walkShR   = sw *  0.55;
    const walkElL   = 0.20 + Math.max(0, sw) * 0.35;
    const walkElR   = 0.20 + Math.max(0, -sw) * 0.35;
    const walkBodyY = ud.standY + (ud.isMoving ? Math.abs(Math.cos(ph)) * 0.035 : 0);
    const walkTilt  = ud.isMoving ? 0.09 : 0.0;
    const walkHeadX = ud.isMoving ? Math.sin(ph * 2) * 0.025 : 0;

    // === СУУХ ПОЗ (B) ===
    const sitHip    = -Math.PI / 2 + 0.12;   // гуя урагш (жаахан доош)
    const sitKnee   =  Math.PI / 2 - 0.08;   // шаант хөл доош
    const sitShL    = -0.35;                  // гар урагш
    const sitShR    = -0.35;
    const sitElL    =  0.95;                  // тохой нугалж, гар өвдөг дээр
    const sitElR    =  0.95;
    const sitBodyY  = ud.sitY;
    const sitTilt   =  0.14;
    const sitHeadX  = -0.05;

    // Blend (cubic smooth)
    const b = ud.blend;
    const bb = b * b * (3 - 2 * b);
    const lerp = (a, c) => a + (c - a) * bb;

    ud.legs.leftHip.rotation.x   = lerp(walkHipL,  sitHip);
    ud.legs.rightHip.rotation.x  = lerp(walkHipR,  sitHip);
    ud.legs.leftKnee.rotation.x  = lerp(walkKneeL, sitKnee);
    ud.legs.rightKnee.rotation.x = lerp(walkKneeR, sitKnee);
    ud.arms.leftSh.rotation.x    = lerp(walkShL,   sitShL);
    ud.arms.rightSh.rotation.x   = lerp(walkShR,   sitShR);
    ud.arms.leftEl.rotation.x    = lerp(walkElL,   sitElL);
    ud.arms.rightEl.rotation.x   = lerp(walkElR,   sitElR);
    ud.body.position.y           = lerp(walkBodyY, sitBodyY);
    ud.torsoPivot.rotation.x     = lerp(walkTilt,  sitTilt);
    ud.head.rotation.x           = lerp(walkHeadX, sitHeadX);

    // Амьсгалын хөдөлгөөн (зогсож эсвэл суух үед нарийн)
    if (!ud.isMoving) {
        const br = Math.sin(performance.now() * 0.0022) * 0.012;
        ud.torsoPivot.scale.y = 1 + br;
        // Цэрцэгнүүр — суух үед бага зэрэг гараа хөдөлгөнө
        if (b > 0.85) {
            ud.arms.leftEl.rotation.x  += Math.sin(performance.now() * 0.0018) * 0.04;
            ud.arms.rightEl.rotation.x += Math.sin(performance.now() * 0.0018 + 1.5) * 0.04;
        }
    } else {
        ud.torsoPivot.scale.y = 1;
    }
}

// ── Activity позууд (per-character loop animations) ────────────
// Эдгээр функцүүд бүх үеийг (гар, хөл, бие) өөрсдөө эзэмшиж бичнэ.
// `t` нь waypoint-д ирснээс хойшх хугацаа (секундээр).

function _resetPose(ud) {
    ud.legs.leftHip.rotation.set(0, 0, 0);
    ud.legs.rightHip.rotation.set(0, 0, 0);
    ud.legs.leftKnee.rotation.set(0, 0, 0);
    ud.legs.rightKnee.rotation.set(0, 0, 0);
    ud.arms.leftSh.rotation.set(0, 0, 0);
    ud.arms.rightSh.rotation.set(0, 0, 0);
    ud.arms.leftEl.rotation.set(0, 0, 0);
    ud.arms.rightEl.rotation.set(0, 0, 0);
    ud.torsoPivot.rotation.set(0, 0, 0);
    ud.torsoPivot.scale.set(1, 1, 1);
    ud.head.rotation.set(0, 0, 0);
}

// Бүлэх (airag churning) — хоёр гараа урагш сунгаад босоогоор шахна
function poseChurn(ud, dt, t) {
    _resetPose(ud);
    const pump = Math.sin(t * 4.5);             // дээш/доош pump
    ud.body.position.y = ud.standY - 0.02;
    ud.torsoPivot.rotation.x = 0.15 + pump * 0.04;
    // Хөл зогсоо хэвээр — жаахан тэжээж тавина
    ud.legs.leftHip.rotation.x  = 0.02;
    ud.legs.rightHip.rotation.x = 0.02;
    ud.legs.leftKnee.rotation.x  = 0.08;
    ud.legs.rightKnee.rotation.x = 0.08;
    // Хоёр гар: мөр урагш, тохой хагас нугалж, pump дагана
    const shBase = -1.25;
    const elBase = 0.85;
    ud.arms.leftSh.rotation.x  = shBase - pump * 0.20;
    ud.arms.rightSh.rotation.x = shBase - pump * 0.20;
    ud.arms.leftSh.rotation.z  =  0.10;
    ud.arms.rightSh.rotation.z = -0.10;
    ud.arms.leftEl.rotation.x  = elBase + pump * 0.25;
    ud.arms.rightEl.rotation.x = elBase + pump * 0.25;
    ud.head.rotation.x = 0.18;
}

// Морь уях (tying horse) — хоёр гар урагш-дээш сунгаж жижиг хөдөлгөөн
function poseTieHorse(ud, dt, t) {
    _resetPose(ud);
    const wobble = Math.sin(t * 2.0);
    ud.body.position.y = ud.standY;
    ud.torsoPivot.rotation.x = 0.08;
    ud.legs.leftHip.rotation.x  = 0.0;
    ud.legs.rightHip.rotation.x = 0.0;
    // Баруун гар дээшээ сунгалт, зүүн гар жаахан доогуур
    ud.arms.rightSh.rotation.x = -1.55 + wobble * 0.08;
    ud.arms.rightSh.rotation.z = -0.25;
    ud.arms.rightEl.rotation.x =  0.55;
    ud.arms.leftSh.rotation.x  = -1.10 + wobble * 0.05;
    ud.arms.leftSh.rotation.z  =  0.30;
    ud.arms.leftEl.rotation.x  =  0.70 + wobble * 0.10;
    ud.head.rotation.x = -0.10;
}

// Түлээ хөрөөдөх (sawing) — хоёр гар урагш-хойш push-pull
function poseSaw(ud, dt, t) {
    _resetPose(ud);
    const saw = Math.sin(t * 5.5);
    ud.body.position.y = ud.standY - 0.04;
    ud.torsoPivot.rotation.x = 0.30 + saw * 0.05;
    // Өргөн зогсолт
    ud.legs.leftHip.rotation.z  =  0.18;
    ud.legs.rightHip.rotation.z = -0.18;
    ud.legs.leftHip.rotation.x  = -0.10;
    ud.legs.rightHip.rotation.x =  0.10;
    ud.legs.leftKnee.rotation.x  = 0.20;
    ud.legs.rightKnee.rotation.x = 0.25;
    // Гар: хоёулаа урагшаа, saw дагаж push/pull
    ud.arms.rightSh.rotation.x = -0.90 + saw * 0.45;
    ud.arms.leftSh.rotation.x  = -0.75 + saw * 0.35;
    ud.arms.rightSh.rotation.z = -0.20;
    ud.arms.leftSh.rotation.z  =  0.20;
    ud.arms.rightEl.rotation.x = 0.55 - saw * 0.25;
    ud.arms.leftEl.rotation.x  = 0.65 - saw * 0.20;
    ud.head.rotation.x = 0.25;
}

// Сүү саах (milking) — суусан, хоүр гар урагш сольж хөдөлнө
function poseMilk(ud, dt, t) {
    _resetPose(ud);
    ud.body.position.y = ud.sitY;
    ud.torsoPivot.rotation.x = 0.35;
    // Суух байрлал: ташаа урагш, өвдөг доогуур
    ud.legs.leftHip.rotation.x  = -Math.PI / 2 + 0.15;
    ud.legs.rightHip.rotation.x = -Math.PI / 2 + 0.15;
    ud.legs.leftKnee.rotation.x  = Math.PI / 2 - 0.10;
    ud.legs.rightKnee.rotation.x = Math.PI / 2 - 0.10;
    // Гар урагш, ээлжлэн татах хөдөлгөөн
    const pullL = Math.sin(t * 6.0);
    const pullR = Math.sin(t * 6.0 + Math.PI);
    ud.arms.leftSh.rotation.x  = -1.05 + pullL * 0.10;
    ud.arms.rightSh.rotation.x = -1.05 + pullR * 0.10;
    ud.arms.leftSh.rotation.z  =  0.15;
    ud.arms.rightSh.rotation.z = -0.15;
    ud.arms.leftEl.rotation.x  = 1.50 - pullL * 0.15;
    ud.arms.rightEl.rotation.x = 1.50 - pullR * 0.15;
    ud.head.rotation.x = 0.25;
}

// ── Waypoint-state machine ─────────────────────────────────────
const _inhabitants = [];
function addInhabitant(npc, waypoints, speed = 1.15) {
    _inhabitants.push({ npc, waypoints, idx: 0, waitT: 0, speed });
}

function _tickInhabitants(dt) {
    for (const n of _inhabitants) {
        const wp = n.waypoints[n.idx];
        const ud = n.npc.userData;

        const dx = wp.x - n.npc.position.x;
        const dz = wp.z - n.npc.position.z;
        const d  = Math.sqrt(dx*dx + dz*dz);

        if (d > 0.06) {
            // Зорилгод хараахан хүрээгүй — алхана
            ud.isMoving = true;
            const step = Math.min(n.speed * dt, d);
            n.npc.position.x += (dx / d) * step;
            n.npc.position.z += (dz / d) * step;

            // Явах чигт толгой эргүүлэх
            const targetRotY = Math.atan2(dx, dz);
            let diff = targetRotY - n.npc.rotation.y;
            while (diff >  Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            n.npc.rotation.y += diff * Math.min(1, dt * 6);

            // Босоо поз руу шилжих
            ud.blend = Math.max(0, ud.blend - dt * 2.2);
            _applyHumanPose(ud, dt);
        } else {
            // Зорилгодоо хүрсэн
            ud.isMoving = false;
            if (wp.type === 'activity' && typeof wp.activity === 'function') {
                // Өөрийн гэсэн үйл хөдлөл (бүлэх, хөрөөдөх, саах гэх мэт)
                if (wp.face) {
                    const fx = wp.face.x - wp.x;
                    const fz = wp.face.z - wp.z;
                    const targetRotY = Math.atan2(fx, fz);
                    let diff = targetRotY - n.npc.rotation.y;
                    while (diff >  Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    n.npc.rotation.y += diff * Math.min(1, dt * 4);
                }
                n.waitT += dt;
                // Activity өөрөө позыг бүхлээр нь эзэмшинэ
                wp.activity(ud, dt, n.waitT);
                if (Number.isFinite(wp.wait) && n.waitT >= wp.wait) {
                    n.waitT = 0;
                    n.idx = (n.idx + 1) % n.waypoints.length;
                }
            } else if (wp.type === 'sit') {
                // Суух поз руу blend
                ud.blend = Math.min(1, ud.blend + dt * 2.0);
                // Заасан цэг рүү харах (ихэвчлэн гал зуух руу)
                if (wp.face) {
                    const fx = wp.face.x - wp.x;
                    const fz = wp.face.z - wp.z;
                    const targetRotY = Math.atan2(fx, fz);
                    let diff = targetRotY - n.npc.rotation.y;
                    while (diff >  Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    n.npc.rotation.y += diff * Math.min(1, dt * 4);
                }
                n.waitT += dt;
                if (n.waitT >= (wp.wait ?? 5)) {
                    n.waitT = 0;
                    n.idx = (n.idx + 1) % n.waypoints.length;
                }
                _applyHumanPose(ud, dt);
            } else {
                // Явах цэг — богино зогсолт
                ud.blend = Math.max(0, ud.blend - dt * 2.2);
                n.waitT += dt;
                if (n.waitT >= (wp.wait ?? 0.15)) {
                    n.waitT = 0;
                    n.idx = (n.idx + 1) % n.waypoints.length;
                }
                _applyHumanPose(ud, dt);
            }
        }
    }
}

// ── Гэрийн дотор амьдардаг ахуу ─────────────────────────────────
const _gerMan = createMongolInhabitant(0x8A1D22, 0xE6B428, 0xC98D5B);
_gerMan.position.set(2.4, 0, 1.7);
_gerMan.userData.isPerson = true;
_gerMan.userData.personLabel = 'Гэрийн эзэн';
scene.add(_gerMan);

// Гал зуухыг тойрсон зам — 3 суудал + 3 явах цэг
addInhabitant(_gerMan, [
    { x:  2.4, z:  1.7, type: 'sit',  face: { x: 0, z: 0 }, wait: 5.5 },
    { x:  1.0, z:  2.8, type: 'walk', wait: 0.15 },
    { x: -1.8, z:  2.2, type: 'sit',  face: { x: 0, z: 0 }, wait: 5.0 },
    { x: -2.3, z:  0.2, type: 'walk', wait: 0.15 },
    { x: -2.3, z: -1.8, type: 'walk', wait: 0.15 },
    { x: -0.5, z: -2.6, type: 'walk', wait: 0.15 },
    { x:  2.0, z: -1.9, type: 'sit',  face: { x: 0, z: 0 }, wait: 5.0 },
    { x:  3.0, z: -0.2, type: 'walk', wait: 0.15 },
], 1.1);

// ══════════════════════════════════════════════════════════════════
// ӨДӨР ТУТМЫН АХУЙ — гэрийн гадна 5 зан үйлтэй хүн
// ══════════════════════════════════════════════════════════════════

// ── Хэрэгслийн factory-ууд ──────────────────────────────────────
function createChurnVessel(x, z) {
    const g = new THREE.Group();
    const woodMt = new THREE.MeshStandardMaterial({ color: 0x5A3820, roughness: 0.86 });
    const darkMt = new THREE.MeshStandardMaterial({ color: 0x2E1A0C, roughness: 0.92 });
    const bandMt = new THREE.MeshStandardMaterial({ color: 0x7A5030, roughness: 0.78 });
    // Сав
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.33, 0.92, 14), woodMt);
    barrel.position.y = 0.46; g.add(barrel);
    // Төмөр зэс бугуйвч × 2
    [0.18, 0.70].forEach(y => {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.322, 0.322, 0.05, 14), bandMt);
        b.position.y = y; g.add(b);
    });
    // Бүлээлхийн шон (дээшээ урт)
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.15, 0.045), darkMt);
    pole.position.y = 1.35; g.add(pole);
    // Шон дээрх бариул (хөндлөн бариул)
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.05), darkMt);
    grip.position.y = 1.88; g.add(grip);
    g.position.set(x, 0, z);
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return g;
}

function createSawhorse(x, z, rotY = 0) {
    const g = new THREE.Group();
    const woodMt = new THREE.MeshStandardMaterial({ color: 0x6B4020, roughness: 0.88 });
    const logMt  = new THREE.MeshStandardMaterial({ color: 0x8A5A30, roughness: 0.92 });
    // X-хөл × 2 (урд, хойд)
    [-0.35, 0.35].forEach(zOff => {
        const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.92, 0.08), woodMt);
        l1.position.set(0, 0.46, zOff); l1.rotation.z =  0.45; g.add(l1);
        const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.92, 0.08), woodMt);
        l2.position.set(0, 0.46, zOff); l2.rotation.z = -0.45; g.add(l2);
    });
    // Хөндлөн давхраа
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.90), woodMt);
    topBar.position.y = 0.82; g.add(topBar);
    // Түлээний мод (хөндлөн)
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.1, 12), logMt);
    log.position.y = 0.98; log.rotation.x = Math.PI / 2; g.add(log);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return g;
}

function createMilkingStool(x, z) {
    const g = new THREE.Group();
    const woodMt = new THREE.MeshStandardMaterial({ color: 0x5A3820, roughness: 0.88 });
    const bucketMt = new THREE.MeshStandardMaterial({ color: 0x8A6040, roughness: 0.86 });
    const bandMt = new THREE.MeshStandardMaterial({ color: 0x3E2616, roughness: 0.85 });
    // Суудал
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 12), woodMt);
    seat.position.y = 0.30; g.add(seat);
    // 3 хөл
    for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.30, 6), woodMt);
        leg.position.set(Math.cos(a) * 0.11, 0.15, Math.sin(a) * 0.11);
        leg.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
        g.add(leg);
    }
    // Хувин (саам авах)
    const bk = new THREE.Group();
    bk.position.set(0.45, 0, 0.1);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.26, 12), bucketMt);
    bucket.position.y = 0.13; bk.add(bucket);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.03, 12), bandMt);
    band.position.y = 0.24; bk.add(band);
    g.add(bk);
    g.position.set(x, 0, z);
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return g;
}

function createLamb(x, z, rotY = 0) {
    const g = new THREE.Group();
    const wool = new THREE.MeshStandardMaterial({ color: 0xF2EDE0, roughness: 0.95 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x1A0F08, roughness: 0.85 });
    // Ноосон бие
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.20), wool);
    body.position.y = 0.34; g.add(body);
    // Урд (хүзүү/толгой)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), skin);
    head.position.set(0.22, 0.42, 0); g.add(head);
    // Чих × 2
    [-0.06, 0.06].forEach(ez => {
        const ear = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.03), skin);
        ear.position.set(0.22, 0.53, ez); g.add(ear);
    });
    // Нүд × 2
    [-0.05, 0.05].forEach(ez => {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.02, 0.01), new THREE.MeshStandardMaterial({ color: 0x000000 }));
        eye.position.set(0.30, 0.44, ez); g.add(eye);
    });
    // 4 хөл
    [[0.12,-0.08],[0.12,0.08],[-0.12,-0.08],[-0.12,0.08]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), skin);
        leg.position.set(lx, 0.12, lz); g.add(leg);
    });
    // Сүүл
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.06), wool);
    tail.position.set(-0.22, 0.38, 0); g.add(tail);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return g;
}

// ── 5 ДҮРЭЭ СПАУН ───────────────────────────────────────────────

// 1) ЭМЭГТЭЙ: Бүлэх (airag churn) — гэрийн өмнөхөн
const _churnWoman = createMongolInhabitant(0xB03A2E, 0xDCB44E, 0xD39466, { hairColor: 0x1A0E04, hasHat: false });
_churnWoman.position.set(2.2, 0, 6.6);
scene.add(_churnWoman);
scene.add(createChurnVessel(2.2, 7.3));
addInhabitant(_churnWoman, [
    { x: 2.2, z: 6.6, type: 'activity', face: { x: 2.2, z: 7.3 }, activity: poseChurn, wait: Infinity }
]);

// 2) ХӨГШИН: Морь уях — баруун урд талд
const _oldMan = createMongolInhabitant(0x4A4A50, 0x8B7D30, 0xC08060, {
    hairColor: 0xE8E0D0, hasBeard: true, pantsColor: 0x1A1408
});
_oldMan.position.set(-13.8, 0, -3.0);
scene.add(_oldMan);
const _tetherHorse = createHorse(-15.5, -3.0, -Math.PI / 2, 0x5A3420, true);
_tetherHorse.userData.isHorse = true;
_tetherHorse.userData.hasSaddle = true;
scene.add(_tetherHorse);
addInhabitant(_oldMan, [
    { x: -13.8, z: -3.0, type: 'activity', face: { x: -15.5, z: -3.0 }, activity: poseTieHorse, wait: Infinity }
]);

// 3) ХҮҮХЭД: Хурга хөөх — ил талбайд гүйнэ
const _child = createMongolInhabitant(0xC89B1A, 0xE6D050, 0xD89870, {
    scale: 0.68, hairColor: 0x1A0E04, hasHat: false, gaitSpeed: 1.9
});
_child.position.set(8, 0, -9);
scene.add(_child);
const _lamb = createLamb(9.5, -9.5, 0);
scene.add(_lamb);
addInhabitant(_child, [
    { x:  8, z: -9,  type: 'walk', wait: 0.1 },
    { x: 13, z: -11, type: 'walk', wait: 0.1 },
    { x: 11, z: -15, type: 'walk', wait: 0.1 },
    { x:  6, z: -13, type: 'walk', wait: 0.1 },
], 2.3);
addWalker(_lamb, [
    { x:  9.5, z: -9.5  },
    { x: 14.0, z: -11.5 },
    { x: 12.0, z: -15.5 },
    { x:  7.0, z: -13.5 },
], 2.0);

// 4) ЭРЭГТЭЙ: Түлээ хөрөөдөх — зүүн талд
const _sawMan = createMongolInhabitant(0x5A3620, 0xD8A030, 0xC08060, { hairColor: 0x0E0604 });
_sawMan.position.set(8.8, 0, 2.5);
scene.add(_sawMan);
scene.add(createSawhorse(9.6, 2.5, Math.PI / 2));
addInhabitant(_sawMan, [
    { x: 8.8, z: 2.5, type: 'activity', face: { x: 9.6, z: 2.5 }, activity: poseSaw, wait: Infinity }
]);

// 5) ЭМЭГТЭЙ: Сүү саах — өмнөд талд үхэр дээр
const _milkWoman = createMongolInhabitant(0x2F6A3A, 0xE0C430, 0xD39466, { hairColor: 0x1A0E04, hasHat: false });
_milkWoman.position.set(-16.5, 0, -14.8);
scene.add(_milkWoman);
const _stationaryCow = createCow(-18.2, -14.8, Math.PI / 2, 0x7A5040);
scene.add(_stationaryCow);
scene.add(createMilkingStool(-16.8, -14.8));
addInhabitant(_milkWoman, [
    { x: -16.5, z: -14.8, type: 'activity', face: { x: -18.2, z: -14.8 }, activity: poseMilk, wait: Infinity }
]);

// ══════════════════════════════════════════════════════════════════
// ANIMATION LOOP  (renderer.setAnimationLoop → VR-д ажиллана)
// ══════════════════════════════════════════════════════════════════
let isRotating = false;
let buildStep  = 0;
let _prevTime  = performance.now();

// ── Дотор явах (PointerLock) ────────────────────────────────────
const walkControls = new PointerLockControls(camera, renderer.domElement);
let isWalking = false;
const move = { w: false, s: false, a: false, d: false };

walkControls.addEventListener('unlock', () => {
    isWalking = false;
    controls.enabled = true;
    document.getElementById('walk-hint').style.display = 'none';
});

document.addEventListener('keydown', e => {
    if (e.code === 'KeyW') move.w = true;
    if (e.code === 'KeyS') move.s = true;
    if (e.code === 'KeyA') move.a = true;
    if (e.code === 'KeyD') move.d = true;
});
document.addEventListener('keyup', e => {
    if (e.code === 'KeyW') move.w = false;
    if (e.code === 'KeyS') move.s = false;
    if (e.code === 'KeyA') move.a = false;
    if (e.code === 'KeyD') move.d = false;
});

renderer.setAnimationLoop((timestamp) => {
    const now   = timestamp ?? performance.now();
    const delta = Math.min((now - _prevTime) / 1000, 0.1);
    _prevTime   = now;
    ger.update(delta);
    _tickAnims(delta);
    _tickWalkers(delta);
    _tickInhabitants(delta);
    _tickWeather(delta);
    _tickDayNight(delta);
    _tickNaadam(delta);
    _tickSound(delta, camera.position);
    if (window._tickStreamMist) window._tickStreamMist(delta);
    if (window._tickLake) window._tickLake(delta);
    _tickSmoke(delta);
    if (isRotating) ger.getObject3D().rotation.y += delta * 0.3;
    _pollVRMenuToggle();
    _tickVRMenuHeadLock();
    _tickVRControllers();
    if (window._tickRiding) window._tickRiding(delta);
    if (window._tickFlags)  window._tickFlags(delta);

    if (isWalking && walkControls.isLocked && !_ridingHorse) {
        const speed = 4;
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
        const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).normalize();
        if (move.w) camera.position.addScaledVector(dir,   speed * delta);
        if (move.s) camera.position.addScaledVector(dir,  -speed * delta);
        if (move.a) camera.position.addScaledVector(right, -speed * delta);
        if (move.d) camera.position.addScaledVector(right,  speed * delta);
        camera.position.y = 1.6;
    }

    // Нарны цагариг камер руу харна
    if (_sunHalo.visible)  _sunHalo.lookAt(camera.position);
    if (_moonHalo.visible) _moonHalo.lookAt(camera.position);

    controls.update();
    // VR горимд post-processing ажиллахгүй (stereo render-тэй зөрчилдөнө)
    if (renderer.xr.isPresenting) {
        renderer.render(scene, camera);
    } else {
        _composer.render();
    }
});

// ══════════════════════════════════════════════════════════════════
// UI ФУНКЦҮҮД
// ══════════════════════════════════════════════════════════════════

window.toggleKhana = function(i) {
    const k = ger._khanas[i];
    if (!k) return;
    const nowVisible = k.getVisible();
    k.setVisible(!nowVisible);
    const cb = document.getElementById('check-khana-' + i);
    if (cb) cb.checked = !nowVisible;
};

let _allKhanaVisible = true;
window.toggleAllKhana = function() {
    _allKhanaVisible = !_allKhanaVisible;
    ger.setKhanaVisible(-1, _allKhanaVisible);
};

window.setAllFold    = function(r) { ger.setKhanaFold(-1, r); };
window.foldKhana   = function(i) { ger.setKhanaFold(i, 0.12); };
window.unfoldKhana = function(i) { ger.setKhanaFold(i, 1.0); };

window.openDoor  = function() { ger.openDoor(); };
window.closeDoor = function() { ger.closeDoor(); };

window.setFurnitureVis = function(name, v) { ger.setFurnitureVis(name, v); };

window.toggleRotation = function() {
    isRotating = !isRotating;
    const btn = document.getElementById('btn-rot');
    if (btn) btn.textContent = isRotating ? '⏸ Зогсоох' : '▶ Эргүүлэх';
};

window.resetView = function() {
    camera.position.set(14, 10, 20);
    controls.target.set(0, 2.5, 0);
    controls.update();
    isRotating = false;
};

// Гадаа явах (PointerLock, гэрийн урдаас эхэлнэ)
window.walkOutside = function() {
    isRotating = false;
    camera.position.set(8, 1.7, 12);
    controls.enabled = false;
    isWalking = true;
    walkControls.lock();
    document.getElementById('walk-hint').style.display = 'block';
};

// Гэрийн дотор орж явах
window.enterGer = function() {
    isRotating = false;
    camera.position.set(0, 1.6, 3.5);
    controls.enabled = false;
    isWalking = true;
    walkControls.lock();
    document.getElementById('walk-hint').style.display = 'block';
};

window.exitGer = function() {
    if (walkControls.isLocked) walkControls.unlock();
    isWalking = false;
    controls.enabled = true;
    camera.position.set(14, 10, 20);
    controls.target.set(0, 2.5, 0);
    controls.update();
    document.getElementById('walk-hint').style.display = 'none';
};

window.handlePartVisibility = function(name, checked) {
    if (name === 'all') {
        ['door', 'bagana', 'toono', 'un', 'tuurga', 'roof', 'bvsluur'].forEach(id => {
            ger.setPartVisibility(id, checked);
            const el = document.getElementById('check-' + id);
            if (el) el.checked = checked;
        });
        // Туурга хэсгүүд
        ger.getTuurga().setVisible(-1, checked);
        ['tuurga-1','tuurga-2'].forEach(id => {
            const cb = document.getElementById('check-' + id);
            if (cb) cb.checked = checked;
        });
        // Бүслүүр хэсгүүд
        ger.getBvsluur().setVisible(-1, checked);
        ['bvsluur-1','bvsluur-2','bvsluur-3'].forEach(id => {
            const cb = document.getElementById('check-' + id);
            if (cb) cb.checked = checked;
        });
        ger.setKhanaVisible(-1, checked);
        for (let i = 0; i < 5; i++) {
            const cb = document.getElementById('check-khana-' + i);
            if (cb) cb.checked = checked;
        }
        return;
    }
    // Туурга хэсэг тус бүр
    if (name === 'tuurga-1') { ger.getTuurga().setVisible(0, checked); return; }
    if (name === 'tuurga-2') { ger.getTuurga().setVisible(1, checked); return; }
    // Бүслүүр тус бүр
    if (name === 'bvsluur-1') { ger.getBvsluur().setVisible(0, checked); return; }
    if (name === 'bvsluur-2') { ger.getBvsluur().setVisible(1, checked); return; }
    if (name === 'bvsluur-3') { ger.getBvsluur().setVisible(2, checked); return; }
    ger.setPartVisibility(name, checked);
};

// ══════════════════════════════════════════════════════════════════
// CLICK — гэрийн хэсгийг дарж нуух / харуулах (Raycaster)
// ══════════════════════════════════════════════════════════════════
const _ray   = new THREE.Raycaster();
const _mouse = new THREE.Vector2();
let   _hovered = null;
const _emissiveCache = new Map();

function _getToggleAncestor(obj) {
    let o = obj;
    while (o) {
        if (o.userData && o.userData.toggleable) return o;
        o = o.parent;
    }
    return null;
}

renderer.domElement.addEventListener('mousemove', e => {
    if (isWalking) return;
    _mouse.x =  (e.clientX / innerWidth)  * 2 - 1;
    _mouse.y = -(e.clientY / innerHeight) * 2 + 1;
    _ray.setFromCamera(_mouse, camera);
    const hits   = _ray.intersectObjects(scene.children, true)
        .filter(h => h.object.userData.isClickMesh);
    const target = hits.length ? _getToggleAncestor(hits[0].object) : null;

    if (target !== _hovered) {
        // Өмнөхийг сэргээх
        if (_hovered) {
            _hovered.traverse(m => {
                if (m.isMesh && _emissiveCache.has(m.uuid)) {
                    m.material.emissive.setHex(_emissiveCache.get(m.uuid));
                    _emissiveCache.delete(m.uuid);
                }
            });
        }
        // Шинийг тодруулах
        if (target) {
            target.traverse(m => {
                if (m.isMesh && m.material.emissive !== undefined) {
                    _emissiveCache.set(m.uuid, m.material.emissive.getHex());
                    m.material.emissive.setHex(0x332200);
                }
            });
        }
        _hovered = target;
        renderer.domElement.style.cursor = target ? 'pointer' : '';
    }
});

renderer.domElement.addEventListener('click', e => {
    if (isWalking) return;
    _mouse.x =  (e.clientX / innerWidth)  * 2 - 1;
    _mouse.y = -(e.clientY / innerHeight) * 2 + 1;
    _ray.setFromCamera(_mouse, camera);
    const hits = _ray.intersectObjects(scene.children, true)
        .filter(h => h.object.userData.isClickMesh);
    if (!hits.length) return;
    const target = _getToggleAncestor(hits[0].object);
    if (!target) return;

    const home   = _getHome(target);
    const offset = ENTRY_OFFSETS[target.name] ?? new THREE.Vector3(0, 8, 0);

    if (target.visible && !_anims.has(target.uuid)) {
        // Нисэж гарна → дараа нуугдана
        animTo(target, home.clone().add(offset), 0.45, null, () => {
            target.visible = false;
            target.position.copy(home);
            const cb = document.getElementById('check-' + target.name);
            if (cb) cb.checked = false;
        });
    } else if (!target.visible) {
        // Нисэж орно
        animTo(target, home, 0.7, home.clone().add(offset));
        const cb = document.getElementById('check-' + target.name);
        if (cb) cb.checked = true;
    }

    _hovered = null;
    renderer.domElement.style.cursor = '';
});

// ── ГЭР БАРИХ — нэг нэгээр анимацтайгаар ────────────────────────
window.buildGer = function () {
    // Бүгдийг нуух
    ger.setKhanaVisible(-1, false);
    ['door', 'bagana', 'toono', 'un'].forEach(id => ger.setPartVisibility(id, false));
    ger.getTuurga().setVisible(-1, false);
    ger.getBvsluur().setVisible(-1, false);
    ger.setPartVisibility('roof', false);
    // Анимацийн байрлалыг reset
    [...ger.getTuurga().getPanels(),
     ...ger.getBvsluur().getBands(),
     ger.parts['bagana'], ger.parts['toono'], ger.parts['roof']
    ].forEach(o => { _anims.delete(o.uuid); o.position.copy(_getHome(o)); });

    let d = 200; // ms

    // 1. Хана 1-5 — нэг нэгээр эвдэрнэ
    for (let i = 0; i < 5; i++) {
        const idx = i;
        setTimeout(() => {
            ger.setKhanaVisible(idx, true);
            ger.setKhanaFold(idx, 0.12);
            let r = 0.12;
            const tid = setInterval(() => {
                r = Math.min(1.0, r + 0.03);
                ger.setKhanaFold(idx, r);
                if (r >= 1.0) clearInterval(tid);
            }, 28);
        }, d + idx * 420);
    }
    d += 5 * 420 + 350;

    // 2. Хаалга
    setTimeout(() => ger.setPartVisibility('door', true), d);
    d += 300;

    // 3. Багана — доороос дээш
    setTimeout(() => {
        const o = ger.parts['bagana'], h = _getHome(o);
        animTo(o, h, 0.75, h.clone().add(ENTRY_OFFSETS['bagana']));
    }, d);
    d += 600;

    // 4. Тооно — дээрээс доош
    setTimeout(() => {
        const o = ger.parts['toono'], h = _getHome(o);
        animTo(o, h, 0.75, h.clone().add(ENTRY_OFFSETS['toono']));
    }, d);
    d += 650;

    // 5. Унь
    setTimeout(() => ger.setPartVisibility('un', true), d);
    d += 400;

    // 6. Туурга 1 & 2
    setTimeout(() => { const p = ger.getTuurga().getPanels()[0]; animTo(p, _getHome(p), 0.7, _getHome(p).clone().add(ENTRY_OFFSETS['tuurga-1'])); }, d);
    d += 280;
    setTimeout(() => { const p = ger.getTuurga().getPanels()[1]; animTo(p, _getHome(p), 0.7, _getHome(p).clone().add(ENTRY_OFFSETS['tuurga-2'])); }, d);
    d += 600;

    // 7. Бүслүүр 1-3
    for (let i = 0; i < 3; i++) {
        const idx = i;
        setTimeout(() => { const b = ger.getBvsluur().getBands()[idx]; animTo(b, _getHome(b), 0.5, _getHome(b).clone().add(ENTRY_OFFSETS['bvsluur-1'])); }, d + idx * 200);
    }
    d += 3 * 200 + 400;

    // 8. Дээвэр — дээрээс доош
    setTimeout(() => {
        const o = ger.parts['roof']; ger.setPartVisibility('roof', true);
        animTo(o, _getHome(o), 0.9, _getHome(o).clone().add(new THREE.Vector3(0, 9, 0)));
    }, d);
    d += 750;

    // 9. Баталгаажуулалт — анимац дуусмагц БҮХ хэсгийг харуулна, checkbox-уудыг зөв болгоно
    setTimeout(() => {
        ger.setKhanaVisible(-1, true);
        ger.getTuurga().setVisible(-1, true);
        ger.getBvsluur().setVisible(-1, true);
        ['door', 'bagana', 'toono', 'un', 'roof'].forEach(id => ger.setPartVisibility(id, true));
        // Web UI checkbox sync
        ['all', 'door', 'bagana', 'toono', 'un', 'roof',
         'tuurga-1', 'tuurga-2', 'bvsluur-1', 'bvsluur-2', 'bvsluur-3',
         'khana-0', 'khana-1', 'khana-2', 'khana-3', 'khana-4'
        ].forEach(id => {
            const cb = document.getElementById('check-' + id);
            if (cb) cb.checked = true;
        });
    }, d + 200);

};

function buildStepByStep() {
    const order = ['khana', 'door', 'bagana', 'toono', 'un', 'tuurga', 'roof'];
    if (buildStep >= order.length) return;
    const part = order[buildStep];
    if (part === 'khana') ger.setKhanaVisible(-1, true);
    else ger.setPartVisibility(part, true);
    buildStep++;
}

window.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
        case 'f': focusOnGer(); break;
        case 'e': ger.explodeParts(4); break;
        case 'r': ger.assembleParts(); buildStep = 0; break;
        case 'n': buildStepByStep(); break;
    }
});

// ══════════════════════════════════════════════════════════════════
// ГАЛ ГОЛОМТ — чулуун тойрог + улаан дөл + анимац
// ══════════════════════════════════════════════════════════════════
function createCampfire(x, z) {
    const g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0x6A6A66, roughness: 0.95, flatShading: true });
    const stoneD= new THREE.MeshStandardMaterial({ color: 0x4A4844, roughness: 0.96, flatShading: true });
    const wood  = new THREE.MeshStandardMaterial({ color: 0x4A2814, roughness: 0.9 });
    const ember = new THREE.MeshStandardMaterial({ color: 0xF06020, emissive: 0xC03010,
                                                    emissiveIntensity: 0.8, roughness: 0.85 });
    const flame1= new THREE.MeshStandardMaterial({ color: 0xFFB020, emissive: 0xFF7010,
                                                    emissiveIntensity: 1.4, roughness: 0.8,
                                                    transparent: true, opacity: 0.9 });
    const flame2= new THREE.MeshStandardMaterial({ color: 0xFFEE60, emissive: 0xFFC820,
                                                    emissiveIntensity: 1.8, roughness: 0.6,
                                                    transparent: true, opacity: 0.95 });

    // Чулуун тойрог — 8 ширхэг
    for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const r = 0.5;
        const s = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.16 + Math.random() * 0.06, 0),
            Math.random() > 0.5 ? stone : stoneD
        );
        s.position.set(Math.cos(ang) * r, 0.09, Math.sin(ang) * r);
        s.rotation.set(Math.random(), Math.random(), Math.random());
        g.add(s);
    }
    // Модон хайлаас дотор
    [[-0.15, 0.08, 0.3], [0.18, 0.08, -0.3], [0, 0.08, 0]].forEach(([wx, wy, wrot]) => {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.65, 6), wood);
        log.position.set(wx, wy, 0);
        log.rotation.set(0, wrot, Math.PI / 2);
        g.add(log);
    });
    // Нүүрс
    for (let i = 0; i < 6; i++) {
        const e = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06, 0), ember);
        e.position.set((Math.random() - 0.5) * 0.4, 0.1, (Math.random() - 0.5) * 0.4);
        g.add(e);
    }
    // Дөл — 2 тетраэдрон давхарласан
    const flame = new THREE.Group();
    const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 6), flame1);
    f1.position.y = 0.35; flame.add(f1);
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 6), flame2);
    f2.position.y = 0.46; flame.add(f2);
    const f3 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 5), flame2);
    f3.position.y = 0.58; flame.add(f3);
    flame.userData.isFlame = true;
    g.add(flame);

    // Галын хойд гэрэл
    const pl = new THREE.PointLight(0xFF8030, 1.2, 6, 1.6);
    pl.position.set(0, 0.4, 0);
    g.add(pl);
    g.userData.pointLight = pl;
    g.userData.flame = flame;

    g.position.set(x, 0, z);
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return g;
}

const _campfire = createCampfire(-4, 4);
scene.add(_campfire);

// Галын мерцэх анимаци
const _campfireTicker = { t: 0 };
(function hookCampfire() {
    const orig = _campfire.userData.flame;
    const pl   = _campfire.userData.pointLight;
    // animation loop дотор tick
    const id = setInterval(() => {
        _campfireTicker.t += 0.08;
        const t = _campfireTicker.t;
        orig.scale.y = 1.0 + Math.sin(t * 2.3) * 0.18 + Math.sin(t * 5.1) * 0.06;
        orig.scale.x = 1.0 + Math.cos(t * 3.1) * 0.08;
        orig.rotation.y = Math.sin(t * 1.5) * 0.1;
        if (pl) pl.intensity = 1.0 + Math.sin(t * 4.3) * 0.3 + Math.sin(t * 7.1) * 0.15;
    }, 60);
    window.addEventListener('beforeunload', () => clearInterval(id));
})();

// ══════════════════════════════════════════════════════════════════
// МОДОН БОЧКА + ХУВИН
// ══════════════════════════════════════════════════════════════════
function createBarrel(x, z, big = true) {
    const g = new THREE.Group();
    const wood  = new THREE.MeshStandardMaterial({ color: 0xA0682A, roughness: 0.85 });
    const dark  = new THREE.MeshStandardMaterial({ color: 0x5A3A1A, roughness: 0.88 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x3A2A1A, roughness: 0.6, metalness: 0.5 });

    const h = big ? 0.7 : 0.4;
    const r = big ? 0.3 : 0.18;
    // Гэр барьц (барил) — CylinderGeometry хэлбэрээр
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, h, 12), wood);
    body.position.y = h / 2; g.add(body);
    // Босоо зураасаар модны шугам (3 ширхэг)
    for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, h - 0.04, 0.005), dark);
        stripe.position.set(Math.cos(ang) * r * 1.01, h / 2, Math.sin(ang) * r * 1.01);
        stripe.rotation.y = -ang;
        g.add(stripe);
    }
    // Төмөр бүс (3 ширхэг)
    [0.12, 0.5, 0.88].forEach(t => {
        const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.015, 0.02, 6, 18), metal);
        band.position.y = h * t;
        band.rotation.x = Math.PI / 2;
        g.add(band);
    });
    // Дээд, доод хавтан
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, 0.02, 12), wood);
    top.position.y = h + 0.01; g.add(top);

    if (!big) {
        // Хувин бариул
        const handle = new THREE.Mesh(new THREE.TorusGeometry(r * 0.85, 0.01, 5, 10, Math.PI), metal);
        handle.position.y = h + 0.04;
        g.add(handle);
    }

    g.position.set(x, 0, z);
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return g;
}

scene.add(createBarrel(-3.2, 4.6, true));
scene.add(createBarrel(-3.6, 5.1, false));

// ══════════════════════════════════════════════════════════════════
// НААДАМ — Эрийн гурван наадам (бөх, морин уралдаан, сур харвах)
// ══════════════════════════════════════════════════════════════════
const _naadamGroup = new THREE.Group();
_naadamGroup.visible = false;
scene.add(_naadamGroup);

let _naadamOn = false;
let _naadamT = 0;

// ── 1) БӨХ — 2 бөхчүүд тойрог дээр ─────────────────────────────
const _ringMt = new THREE.MeshStandardMaterial({ color: 0xD9B050, roughness: 0.85 });
const _ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.6, 28), _ringMt);
_ring.rotation.x = -Math.PI / 2;
_ring.position.set(14, 0.02, 14);
_ring.receiveShadow = true;
_naadamGroup.add(_ring);

const _wrestler1 = createMongolInhabitant(0xC02828, 0xE8C030, 0xC88060, { hasHat: false, hairColor: 0x0A0402 });
const _wrestler2 = createMongolInhabitant(0x1A4078, 0xE8C030, 0xBA8050, { hasHat: false, hairColor: 0x0A0402 });
_naadamGroup.add(_wrestler1, _wrestler2);

function _poseWrestler(ud, t, sign) {
    _resetPose(ud);
    ud.body.position.y = ud.standY - 0.12;
    ud.torsoPivot.rotation.x = 0.60;
    // Хоёр гараа эсрэгийн мөрөнд нь тогтоон
    ud.arms.leftSh.rotation.x = -1.35;
    ud.arms.rightSh.rotation.x = -1.35;
    ud.arms.leftSh.rotation.z =  0.55;
    ud.arms.rightSh.rotation.z = -0.55;
    ud.arms.leftEl.rotation.x = 1.15;
    ud.arms.rightEl.rotation.x = 1.15;
    // Өргөн зогсолт
    ud.legs.leftHip.rotation.z  =  0.30;
    ud.legs.rightHip.rotation.z = -0.30;
    ud.legs.leftHip.rotation.x  = -0.25;
    ud.legs.rightHip.rotation.x = -0.25;
    ud.legs.leftKnee.rotation.x  = 0.45;
    ud.legs.rightKnee.rotation.x = 0.45;
    // Хүч тавих үйлдэл — бие бага зэрэг эргэлдэнэ
    const w = Math.sin(t * 2.3);
    ud.torsoPivot.rotation.z = sign * w * 0.10;
    ud.head.rotation.x = 0.20;
}

// ── 2) МОРИН УРАЛДААН — 4 хурдан морь + хүүхэд уяач ────────────
const _raceHorses = [];
for (let i = 0; i < 4; i++) {
    const colors = [0x5A3820, 0x8B5A30, 0xC08040, 0x2A1608];
    const h = createHorse(-24, 28 - i * 1.2, 0, colors[i], true);
    _naadamGroup.add(h);
    _raceHorses.push(h);
    // Хүүхэд уяач (жижиг)
    const jockey = createMongolInhabitant(
        [0xD03030, 0x3060D0, 0x30C060, 0xD0D030][i],
        0xE8C030, 0xD89870,
        { scale: 0.6, hasHat: false, hairColor: 0x0A0402 }
    );
    jockey.position.set(0, 0.8, 0);
    jockey.rotation.y = Math.PI / 2;  // морины чигт харна (+X = morины урд)
    h.add(jockey);
}
const _racePath = [
    { x: -24, z: 28 - 0 * 1.2 },  // placeholder; addWalker-аар дүүргэнэ
];
[
    [{x:-24,z:28},{x: 24,z:28},{x: 26,z:25.5},{x:-26,z:25.5}],
    [{x:-24,z:26.8},{x: 24,z:26.8},{x: 26,z:24.3},{x:-26,z:24.3}],
    [{x:-24,z:25.6},{x: 24,z:25.6},{x: 26,z:23.1},{x:-26,z:23.1}],
    [{x:-24,z:24.4},{x: 24,z:24.4},{x: 26,z:21.9},{x:-26,z:21.9}],
].forEach((wps, i) => addWalker(_raceHorses[i], wps, 6.0 + Math.random() * 0.8));

// Уралдааны мөр (хар судалтай тэмдэг)
const _finishMt = new THREE.MeshStandardMaterial({ color: 0xE0E0E0 });
for (let i = 0; i < 6; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.6), _finishMt);
    line.position.set(25, 0.02, 21.5 + i * 1.4);
    _naadamGroup.add(line);
}

// ── 3) СУР ХАРВАХ — 2 харваач + бай + нисдэг сум ──────────────
const _archer1 = createMongolInhabitant(0x4A6030, 0xE8C030, 0xC88060, { hasHat: false });
const _archer2 = createMongolInhabitant(0x6040A0, 0xE8C030, 0xBA8050, { hasHat: false });
_archer1.position.set(-20, 0, 14);
_archer2.position.set(-20, 0, 16);
_archer1.rotation.y = Math.PI / 2;  // зүүн зүг харна (+x)
_archer2.rotation.y = Math.PI / 2;
_naadamGroup.add(_archer1, _archer2);

// Нум (бөхгөр мод)
function createBow() {
    const g = new THREE.Group();
    const mt = new THREE.MeshStandardMaterial({ color: 0x3A1E08, roughness: 0.82 });
    for (let i = 0; i < 9; i++) {
        const a = (-Math.PI / 3) + (i / 8) * (Math.PI * 2 / 3);
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.04), mt);
        seg.position.set(Math.cos(a) * 0.35, Math.sin(a) * 0.35, 0);
        seg.rotation.z = a - Math.PI / 2;
        g.add(seg);
    }
    // Хөвч (шулуун)
    const string = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.68, 0.006),
        new THREE.MeshStandardMaterial({ color: 0xDDDDD0 }));
    string.position.set(0, 0, 0);
    g.add(string);
    return g;
}
const _bow1 = createBow();
const _bow2 = createBow();
_bow1.position.set(-20 + 0.45, 1.4, 14);
_bow2.position.set(-20 + 0.45, 1.4, 16);
_bow1.rotation.z = -Math.PI / 2;  // хэвтээ байрлал
_bow2.rotation.z = -Math.PI / 2;
_naadamGroup.add(_bow1, _bow2);

// Бай (3 давхар тойрог)
function createTarget(x, z) {
    const g = new THREE.Group();
    const ringColors = [0xE02020, 0xF0F0F0, 0x3060D0];
    const radii = [0.5, 0.32, 0.16];
    ringColors.forEach((c, i) => {
        const m = new THREE.Mesh(
            new THREE.CircleGeometry(radii[i], 20),
            new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide })
        );
        m.position.z = i * 0.01;
        g.add(m);
    });
    // Мод налгаа (дэмжлэг)
    const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 1.5, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x3E2010 })
    );
    base.position.y = -0.75; g.add(base);
    g.position.set(x, 1.5, z);
    g.rotation.y = -Math.PI / 2;  // харваачийн зүг харна
    return g;
}
const _target1 = createTarget(-8, 14);
const _target2 = createTarget(-8, 16);
_naadamGroup.add(_target1, _target2);

// Нисдэг сум
function createArrow() {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.75, 6),
        new THREE.MeshStandardMaterial({ color: 0x8A6030 }));
    shaft.rotation.z = Math.PI / 2; g.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 6),
        new THREE.MeshStandardMaterial({ color: 0x3A3A3A }));
    tip.position.x = 0.40; tip.rotation.z = -Math.PI / 2; g.add(tip);
    const feather = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.01),
        new THREE.MeshStandardMaterial({ color: 0xE8E0D0 }));
    feather.position.x = -0.36; g.add(feather);
    g.visible = false;
    return g;
}
const _arrow1 = createArrow();
const _arrow2 = createArrow();
_naadamGroup.add(_arrow1, _arrow2);

// Харвах поз
function _poseArcher(ud, t, draw) {
    _resetPose(ud);
    ud.body.position.y = ud.standY;
    ud.torsoPivot.rotation.x = 0.04;
    // Зүүн гар: нум барина, урагш цэх сунгасан
    ud.arms.leftSh.rotation.x = -1.55;
    ud.arms.leftSh.rotation.z =  0.35;
    ud.arms.leftEl.rotation.x =  0.05;
    // Баруун гар: хөвчийг таталтай байрлал
    ud.arms.rightSh.rotation.x = -0.85;
    ud.arms.rightSh.rotation.z = -0.35;
    ud.arms.rightEl.rotation.x =  1.40 + draw * 0.25;
    // Хөлийн зогсолт
    ud.legs.leftHip.rotation.z  =  0.10;
    ud.legs.rightHip.rotation.z = -0.10;
    ud.head.rotation.x = -0.08;
    ud.head.rotation.y =  0.20;
}

// Сумны хөдөлгөөн
function _tickArrow(arrow, archer, target, t) {
    const CYCLE = 3.6;  // секунд
    const phase = t % CYCLE;
    if (phase < 2.6) {
        // Харваач татаж байна — сум нуугдсан
        arrow.visible = false;
    } else {
        // Харвалт: 2.6 → 3.6с (1с) шугаман хөдөлгөөн
        const f = (phase - 2.6) / 1.0;
        const sx = archer.position.x + 0.55, sy = 1.42, sz = archer.position.z;
        const tx = target.position.x, ty = target.position.y, tz = target.position.z;
        arrow.visible = true;
        arrow.position.set(sx + (tx - sx) * f, sy + (ty - sy) * f, sz + (tz - sz) * f);
    }
}

// Наадамын хөдөлгөөний цикл
function _tickNaadam(dt) {
    if (!_naadamOn) return;
    _naadamT += dt;
    // Бөх — тойргийн эргэн тойронд эргэлдэнэ
    _poseWrestler(_wrestler1.userData, _naadamT,  1);
    _poseWrestler(_wrestler2.userData, _naadamT, -1);
    const orbit = _naadamT * 0.35;
    _wrestler1.position.set(14 + Math.cos(orbit) * 0.55, 0, 14 + Math.sin(orbit) * 0.55);
    _wrestler2.position.set(14 - Math.cos(orbit) * 0.55, 0, 14 - Math.sin(orbit) * 0.55);
    _wrestler1.rotation.y = orbit + Math.PI / 2;
    _wrestler2.rotation.y = orbit - Math.PI / 2;

    // Харваачид — таталт давтана
    const drawCycle = (_naadamT % 3.6) / 3.6;
    const draw = drawCycle < 0.72 ? drawCycle / 0.72 : 0.0;
    _poseArcher(_archer1.userData, _naadamT,       draw);
    _poseArcher(_archer2.userData, _naadamT + 1.8, draw);
    _tickArrow(_arrow1, _archer1, _target1, _naadamT);
    _tickArrow(_arrow2, _archer2, _target2, _naadamT + 1.8);
}

window.toggleNaadam = function () {
    _naadamOn = !_naadamOn;
    _naadamGroup.visible = _naadamOn;
    // Уралдааны мориод — walker систем аль эрт патрольдож байгаа, харин үл харагдах үед ач холбогдолгүй
    _naadamT = 0;
    const btn = document.getElementById('btn-naadam');
    if (btn) btn.textContent = _naadamOn ? '🏇 Наадам OFF' : '🏇 Наадам';
};

window.ger = ger;

// ══════════════════════════════════════════════════════════════════
// СУРАЛЦАХ ГОРИМ — mesh дээр дарж соёлын мэдээллийг үзэх
// ══════════════════════════════════════════════════════════════════
let _learnMode = false;
const _rc = new THREE.Raycaster();
const _ndc = new THREE.Vector2();

function _tagInfo(obj3D, key) {
    if (obj3D) obj3D.userData.infoKey = key;
}

// Гэрийн бүтцүүд
_tagInfo(ger.parts['toono'],     'toono');
_tagInfo(ger.parts['un'],        'un');
_tagInfo(ger.parts['bagana'],    'bagana');
_tagInfo(ger.parts['door'],      'door');
_tagInfo(ger.parts['tuurga'],    'tuurga');
_tagInfo(ger.parts['bvsluur'],   'bvsluur');
_tagInfo(ger.parts['roof'],      'roof');
_tagInfo(ger.parts['furniture'], 'furniture');

// Гэрийн доторх хүн
_tagInfo(_gerMan, 'person');

// Гадна талын 5 үйл
_tagInfo(_churnWoman,   'churn');
_tagInfo(_oldMan,       'tieHorse');
_tagInfo(_child,        'child');
_tagInfo(_sawMan,       'saw');
_tagInfo(_milkWoman,    'milk');
_tagInfo(_lamb,         'child');

// Амьтад
_grazeHorses.forEach(h => _tagInfo(h, 'horse'));
_tagInfo(_tetherHorse, 'horse');
if (typeof _grazeCows !== 'undefined') _grazeCows.forEach(c => _tagInfo(c, 'cow'));
_tagInfo(_stationaryCow, 'cow');
_camels.forEach(c => _tagInfo(c, 'camel'));

// Өвлийн горимын дүрс
_tagInfo(_snowRoof, 'winter');
_tagInfo(_smoke,    'winter');

function _pickInfoTarget(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    _ndc.x = ((ev.clientX - rect.left) / rect.width)  * 2 - 1;
    _ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    _rc.setFromCamera(_ndc, camera);
    const hits = _rc.intersectObjects(scene.children, true);
    for (const h of hits) {
        let o = h.object;
        while (o) {
            if (o.userData && o.userData.infoKey) return o.userData.infoKey;
            o = o.parent;
        }
    }
    return null;
}

renderer.domElement.addEventListener('click', (ev) => {
    if (!_learnMode) return;
    const key = _pickInfoTarget(ev);
    if (key && window.openInfo) window.openInfo(key);
});

renderer.domElement.addEventListener('mousemove', (ev) => {
    if (!_learnMode) { renderer.domElement.style.cursor = ''; return; }
    const key = _pickInfoTarget(ev);
    renderer.domElement.style.cursor = key ? 'pointer' : 'crosshair';
});

window.toggleLearnMode = function () {
    _learnMode = !_learnMode;
    const btn = document.getElementById('btn-learn');
    if (btn) btn.textContent = _learnMode ? '🎓 Суралцах OFF' : '🎓 Суралцах';
    renderer.domElement.style.cursor = _learnMode ? 'crosshair' : '';
};

window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    _composer.setSize(innerWidth, innerHeight);
});

// ══════════════════════════════════════════════════════════════════
// HVN DEERE DARH — first-person possess + морь дээр унаж явах
//   • Хүн дээр дарахад түүний дотор орж first-person руу шилжинэ
//   • Гар нь camera-д наалдаж урдаас харагдана
//   • Морь дээр дарахад морин дээр сууна, WASD = хатируулах
//   • ESC-ээр гарна
// ══════════════════════════════════════════════════════════════════
let _possessedPerson = null;
let _ridingHorse     = null;
const _possessRC  = new THREE.Raycaster();
const _possessNDC = new THREE.Vector2();

function _findAncestorWithFlag(obj, flag) {
    let n = obj;
    while (n) {
        if (n.userData && n.userData[flag]) return n;
        n = n.parent;
    }
    return null;
}
const _findPersonAncestor = (o) => _findAncestorWithFlag(o, 'isPerson');
const _findHorseAncestor  = (o) => _findAncestorWithFlag(o, 'isHorse');

// First-person camera rig — гарууд camera-тай хамт хөдөлнө
const _fpRig = new THREE.Group();
function _buildFpHands(coatColor) {
    while (_fpRig.children.length) _fpRig.remove(_fpRig.children[0]);
    const skin = new THREE.MeshStandardMaterial({ color: 0xE2B382, roughness: 0.85 });
    const coat = new THREE.MeshStandardMaterial({ color: coatColor, roughness: 0.78 });
    const cuff = new THREE.MeshStandardMaterial({
        color: new THREE.Color(coatColor).multiplyScalar(0.65), roughness: 0.8
    });
    // Хоёр гарын ханцуй — урагшаа уртассан
    [-1, 1].forEach(side => {
        const arm = new THREE.Group();
        arm.position.set(side * 0.18, -0.22, -0.45);
        arm.rotation.x = -0.55;
        const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.32), coat);
        sleeve.position.z = 0.05; arm.add(sleeve);
        const cuffM = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.05), cuff);
        cuffM.position.z = 0.22; arm.add(cuffM);
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), skin);
        hand.position.z = 0.26; arm.add(hand);
        arm.userData.side = side;
        _fpRig.add(arm);
    });
}
camera.add(_fpRig);
scene.add(camera);
_fpRig.visible = false;

function _possessPerson(person) {
    if (!person) return;
    _possessedPerson = person;
    person.visible = false;

    // Гар-ийн өнгө — тухайн хүний deel-тэй тааруулна (skirt-ийн мат-аас)
    const skirtMesh = person.children.find(c => c.geometry && c.geometry.type === 'CylinderGeometry');
    const coatColor = skirtMesh ? skirtMesh.material.color.getHex() : 0x6A4A28;
    _buildFpHands(coatColor);
    _fpRig.visible = true;

    const wp = new THREE.Vector3();
    person.getWorldPosition(wp);
    camera.position.set(wp.x, wp.y + 1.55, wp.z);

    const fwd = new THREE.Vector3(Math.cos(person.rotation.y - Math.PI / 2), 0,
                                  Math.sin(person.rotation.y - Math.PI / 2));
    camera.lookAt(wp.x + fwd.x, wp.y + 1.55, wp.z + fwd.z);

    controls.enabled = false;
    isWalking = true;
    walkControls.lock();

    const hint = document.getElementById('walk-hint');
    if (hint) {
        hint.innerHTML = `<b style="color:#FFE9B0">${person.userData.personLabel}</b> — ` +
            `<span class="kbd">WASD</span> явах · ` +
            `<span class="kbd">Хулгана</span> харах · ` +
            `<span class="kbd">Морь дээр дар</span> унах · ` +
            `<span class="kbd">ESC</span> гарах`;
        hint.style.display = 'block';
    }
}

function _unpossessPerson() {
    if (_ridingHorse) _dismountHorse();
    if (!_possessedPerson) return;
    _possessedPerson.visible = true;
    _possessedPerson = null;
    _fpRig.visible = false;
}

function _mountHorse(horse) {
    _ridingHorse = horse;
    // Камерыг тухайн морины одоогийн чигт тааруулж урагш харна
    // Морины local +X = толгой → world forward = (cos(rotY), -sin(rotY))
    const a = horse.rotation.y;
    const fwdX =  Math.cos(a);
    const fwdZ = -Math.sin(a);
    // Эмээлийн world байрлал
    const sx = horse.position.x + fwdX * -0.1;
    const sz = horse.position.z + fwdZ * -0.1;
    camera.position.set(sx, horse.position.y + 2.45, sz);
    // Толгойг урагш харуулах — морины толгой руу
    camera.lookAt(sx + fwdX * 4, horse.position.y + 2.0, sz + fwdZ * 4);
    const hint = document.getElementById('walk-hint');
    if (hint) {
        hint.innerHTML = `<b style="color:#FFE9B0">Морь унаж байна</b> — ` +
            `<span class="kbd">W</span> урагш · ` +
            `<span class="kbd">A/D</span> эргэх · ` +
            `<span class="kbd">S</span> зогсох · ` +
            `<span class="kbd">ESC</span> буух`;
    }
}

function _dismountHorse() {
    if (!_ridingHorse) return;
    const hp = new THREE.Vector3();
    _ridingHorse.getWorldPosition(hp);
    // Морины хажууд буух
    camera.position.set(hp.x + 1.5, 1.6, hp.z);
    _ridingHorse = null;
}

walkControls.addEventListener('unlock', () => {
    if (_possessedPerson) _unpossessPerson();
});

// Морь анимаци + хяналт — animation loop-д дуудна
window._tickRiding = function (delta) {
    if (!_ridingHorse) return;
    const horse = _ridingHorse;
    // Камерын урагшаа чигийг авах (Y=0)
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0; dir.normalize();

    // Морины модель: толгой нь local +X тэнхлэгт.
    // Local +X-ийг dir рүү харуулах rotation: a = atan2(-dir.z, dir.x)
    const targetRotY = Math.atan2(-dir.z, dir.x);
    horse.rotation.y = targetRotY;

    // W урагш, S удаан хойш
    let speed = 0;
    if (move.w) speed = 7;
    else if (move.s) speed = -3;

    if (speed !== 0) {
        horse.position.x += dir.x * speed * delta;
        horse.position.z += dir.z * speed * delta;
        // Гэлдрэх: биеийг дээш доош намсуулах + урагшаа бага зэрэг лугших
        const t = performance.now() * 0.012;
        horse.position.y = Math.abs(Math.sin(t)) * 0.08;
    } else {
        horse.position.y *= 0.9;
    }

    // Камерыг эмээлийн (saddle) дээр унаачийн нүдний түвшинд байрлуулна
    // Saddle local ≈ (-0.05, 1.4, 0). Хүний толгой нэмэгдээд эх y ≈ 2.4
    // Морины эргэлтэд тааруулсан seat-ийн world байрлал:
    const seatLocalX = -0.1;       // эмээл бага зэрэг хойшоо
    const cosA = Math.cos(targetRotY);
    const sinA = Math.sin(targetRotY);
    const sx = horse.position.x + cosA * seatLocalX;
    const sz = horse.position.z - sinA * seatLocalX;
    // Гэлдрэлийн bob дотор y-д нэмнэ
    const bob = (speed !== 0) ? Math.sin(performance.now() * 0.024) * 0.04 : 0;
    camera.position.set(sx, horse.position.y + 2.45 + bob, sz);
};

renderer.domElement.addEventListener('click', (ev) => {
    if (_learnMode) return;
    if (renderer.xr.isPresenting) return;

    const rect = renderer.domElement.getBoundingClientRect();
    _possessNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    _possessNDC.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    _possessRC.setFromCamera(_possessNDC, camera);
    const hits = _possessRC.intersectObjects(scene.children, true);

    for (const h of hits) {
        // Хүн дарвал → possess
        if (!_possessedPerson) {
            const person = _findPersonAncestor(h.object);
            if (person) { _possessPerson(person); return; }
        }
        // Хэрэв possessed бол морь дарвал → mount
        if (_possessedPerson && !_ridingHorse) {
            const horse = _findHorseAncestor(h.object);
            if (horse) { _mountHorse(horse); return; }
        }
    }
});

renderer.domElement.addEventListener('mousemove', (ev) => {
    if (_learnMode || renderer.xr.isPresenting) return;
    if (isWalking) return;
    const rect = renderer.domElement.getBoundingClientRect();
    _possessNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    _possessNDC.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    _possessRC.setFromCamera(_possessNDC, camera);
    const hits = _possessRC.intersectObjects(scene.children, true);
    let kind = '';
    for (const h of hits) {
        if (_findPersonAncestor(h.object)) { kind = 'person'; break; }
    }
    renderer.domElement.style.cursor = kind ? 'pointer' : '';
});

// ══════════════════════════════════════════════════════════════════
// ДАЛБАА СҮЛЖИХ — гол гэрийг тойрсон тулгуур + олон өнгийн далбаа
// ══════════════════════════════════════════════════════════════════
(function addPrayerFlags() {
    const grp = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4A2A14, roughness: 0.88 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x9A8A6A, roughness: 0.85 });
    const colors = [0xE83828, 0xE89028, 0xF0D028, 0x40A0E8, 0x40C870];
    // 4 тулгуур
    const poles = [[-9, -8], [-7, 4], [9, -8], [7, 4]];
    const poleY = 5;
    poles.forEach(([x, z]) => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, poleY, 7), woodMat);
        pole.position.set(x, poleY / 2, z); grp.add(pole);
    });
    // Хоёр тулгуурын хооронд олс татаж далбаа өлгөх
    function strung(p1, p2) {
        const [x1, z1] = p1, [x2, z2] = p2;
        const len = Math.hypot(x2 - x1, z2 - z1);
        const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
        const ang = Math.atan2(z2 - z1, x2 - x1);
        // Олс
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 6), ropeMat);
        rope.position.set(cx, poleY - 0.15, cz);
        rope.rotation.y = -ang; rope.rotation.z = Math.PI / 2; grp.add(rope);
        // Далбаа (15 ширхэг олс дагуу)
        const flagN = Math.max(8, Math.floor(len * 1.3));
        for (let i = 0; i < flagN; i++) {
            const tt = (i + 0.5) / flagN;
            const px = x1 + (x2 - x1) * tt;
            const pz = z1 + (z2 - z1) * tt;
            // Олс бага зэрэг намсна — sag
            const sag = Math.sin(tt * Math.PI) * 0.25;
            const py = poleY - 0.15 - sag;
            const flagMat = new THREE.MeshStandardMaterial({
                color: colors[i % colors.length], roughness: 0.85, side: THREE.DoubleSide
            });
            const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.45), flagMat);
            flag.position.set(px, py - 0.22, pz);
            flag.rotation.y = -ang + Math.PI / 2;
            flag.rotation.z = (Math.random() - 0.5) * 0.2;
            grp.add(flag);
        }
    }
    strung(poles[0], poles[2]); // зүүн → баруун
    strung(poles[1], poles[3]); // нөгөө шугам
    scene.add(grp);
})();

// ══════════════════════════════════════════════════════════════════
// ШОРОО ЗАМ — гэрүүд хооронд тойрсон цайвар тойрог зам
// ══════════════════════════════════════════════════════════════════
(function addPaths() {
    const pathMat = new THREE.MeshStandardMaterial({
        color: 0xB89860, roughness: 0.95, transparent: true, opacity: 0.85
    });
    // Гол гэрийг тойрсон жижиг тойрог
    const ring = new THREE.Mesh(new THREE.RingGeometry(5.4, 6.2, 32), pathMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);
    // Гэр хоорондын зам
    [
        [-5, -2, -7, -2],
        [5, -2, 7, -3],
    ].forEach(([x1, z1, x2, z2]) => {
        const len = Math.hypot(x2 - x1, z2 - z1);
        const seg = new THREE.Mesh(new THREE.PlaneGeometry(len + 1, 0.8), pathMat);
        seg.rotation.x = -Math.PI / 2;
        seg.position.set((x1 + x2) / 2, 0.01, (z1 + z2) / 2);
        seg.rotation.z = -Math.atan2(z2 - z1, x2 - x1);
        scene.add(seg);
    });
})();

// ══════════════════════════════════════════════════════════════════
// ЗЭРЭГЛЭЭ — зэрлэг цэцэг, үүл, бүргэд (зургийн хэв маяг)
// ══════════════════════════════════════════════════════════════════

// Шар + цэнхэр зэрлэг цэцэг — instanced for performance
(function addWildflowers() {
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xF4C820, roughness: 0.85, emissive: 0x553A00, emissiveIntensity: 0.15 });
    const blueMat   = new THREE.MeshStandardMaterial({ color: 0x4060D0, roughness: 0.85, emissive: 0x102A55, emissiveIntensity: 0.15 });
    const stemMat   = new THREE.MeshStandardMaterial({ color: 0x2A5A24, roughness: 0.9 });

    const flowerGeo = new THREE.SphereGeometry(0.12, 6, 5);
    const stemGeo   = new THREE.CylinderGeometry(0.012, 0.012, 0.2, 4);

    const COUNT = 240;
    const yellow = new THREE.InstancedMesh(flowerGeo, yellowMat, COUNT);
    const blue   = new THREE.InstancedMesh(flowerGeo, blueMat,   COUNT);
    const stems  = new THREE.InstancedMesh(stemGeo,   stemMat,   COUNT * 2);

    const dummy = new THREE.Object3D();
    let yi = 0, bi = 0, si = 0;
    for (let i = 0; i < COUNT * 2; i++) {
        // Гэрийн ойролцоо радиусаар тарж бай
        const ang = Math.random() * Math.PI * 2;
        const r   = 6 + Math.random() * 30;
        const x = Math.cos(ang) * r;
        const z = Math.sin(ang) * r;
        // Уулны зам/гол дээр гарахаас зайлсхий — ойролцоо сорогноор bypass хий
        if (Math.abs(z) < 1.5 && Math.abs(x) < 5) continue;

        // Stem
        dummy.position.set(x, 0.1, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        stems.setMatrixAt(si++, dummy.matrix);
        if (si >= stems.count) break;

        // Flower head
        dummy.position.set(x, 0.22, z);
        dummy.scale.set(0.6 + Math.random() * 0.4, 0.4, 0.6 + Math.random() * 0.4);
        dummy.updateMatrix();
        if (Math.random() < 0.6) {
            if (yi < yellow.count) { yellow.setMatrixAt(yi++, dummy.matrix); }
        } else {
            if (bi < blue.count) { blue.setMatrixAt(bi++, dummy.matrix); }
        }
    }
    yellow.count = yi; blue.count = bi; stems.count = si;
    yellow.instanceMatrix.needsUpdate = true;
    blue.instanceMatrix.needsUpdate = true;
    stems.instanceMatrix.needsUpdate = true;
    scene.add(yellow, blue, stems);
})();

// Цагаан үүлс — горизонт дээр billboards
(function addClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF, roughness: 1.0, metalness: 0,
        transparent: true, opacity: 0.94, flatShading: true
    });
    const cloudGeo = new THREE.SphereGeometry(1, 8, 6);
    const cloudGroup = new THREE.Group();
    for (let i = 0; i < 20; i++) {
        const cluster = new THREE.Group();
        const ang = Math.random() * Math.PI * 2;
        const r = 60 + Math.random() * 40;
        const y = 28 + Math.random() * 12;
        cluster.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
        // 3-5 бөмбөлгөөр нэг үүл хийнэ
        const puffN = 4 + Math.floor(Math.random() * 3);
        for (let p = 0; p < puffN; p++) {
            const puff = new THREE.Mesh(cloudGeo, cloudMat);
            puff.position.set(
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 1.5,
                (Math.random() - 0.5) * 4
            );
            puff.scale.set(2 + Math.random() * 2, 1.2 + Math.random() * 0.6, 2 + Math.random() * 1.5);
            cluster.add(puff);
        }
        cloudGroup.add(cluster);
    }
    scene.add(cloudGroup);
    // Аажим хөдөлж бай
    let _cloudT = 0;
    setInterval(() => {
        _cloudT += 0.008;
        cloudGroup.children.forEach((c, i) => {
            c.position.x += Math.sin(_cloudT + i) * 0.02;
        });
    }, 100);
})();

// Газрын шороотой/халцарсан толбо — Ground painting (гэр, хашаа орчмын элэгдэл)
(function addGroundPatches() {
    const dirtMat = new THREE.MeshStandardMaterial({
        color: 0xA0805A, roughness: 0.97, transparent: true, opacity: 0.78
    });
    const dirtMatD = new THREE.MeshStandardMaterial({
        color: 0x7A5A38, roughness: 0.96, transparent: true, opacity: 0.7
    });
    // Гэрийн орчмын халцарсан газрууд
    const patches = [
        // Гэрийн хаалганы өмнөх элэгдэл
        { x: 6, z: 0, r: 1.6, mat: dirtMat },
        { x: 8, z: 0, r: 1.2, mat: dirtMatD },
        // Голомтын тойрог (галын дэргэд)
        { x: -4, z: 4, r: 1.3, mat: dirtMat },
        // Морины уяан доор
        { x: 9.5, z: 22, r: 0.9, mat: dirtMatD },
        { x: 12.5, z: 22, r: 0.9, mat: dirtMatD },
        { x: 15.5, z: 22, r: 0.9, mat: dirtMatD },
        // Малын хашаан дотор халцарсан газар
        { x: -21, z: 3, r: 3.2, mat: dirtMat },
        { x: -19, z: -2, r: 2.5, mat: dirtMatD },
        { x: -23, z: 6, r: 2.0, mat: dirtMat },
    ];
    patches.forEach(({ x, z, r, mat }) => {
        const patch = new THREE.Mesh(
            new THREE.CircleGeometry(r, 14),
            mat
        );
        patch.rotation.x = -Math.PI / 2;
        patch.position.set(x, 0.005, z);
        scene.add(patch);
    });
})();

// Далбаа сүлжих — салхинд намсах анимаци
let _flagSwayT = 0;
const _flagsToSway = [];
scene.traverse(o => {
    if (o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry'
        && o.material && o.material.color
        && [0xE83828, 0xE89028, 0xF0D028, 0x40A0E8, 0x40C870].some(c => o.material.color.getHex() === c)
        && Math.abs(o.geometry.parameters.width - 0.32) < 0.01) {
        _flagsToSway.push({
            mesh: o,
            base: o.rotation.z,
            phase: Math.random() * Math.PI * 2
        });
    }
});
window._tickFlags = function (dt) {
    _flagSwayT += dt;
    _flagsToSway.forEach(({ mesh, base, phase }) => {
        mesh.rotation.z = base + Math.sin(_flagSwayT * 2.4 + phase) * 0.18;
    });
};

// Бүргэд — тэнгэрт нисэж тойрно
function _createEagleSimple() {
    const g = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: 0x3A2410, roughness: 0.85 });
    const head = new THREE.MeshStandardMaterial({ color: 0xE8D8A0, roughness: 0.8 });
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), body);
    torso.scale.set(1.4, 0.65, 0.85); g.add(torso);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), head);
    hd.position.set(0.78, 0.12, 0); g.add(hd);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.42), body);
    tail.position.set(-0.78, 0, 0); g.add(tail);
    const wmat = new THREE.MeshStandardMaterial({ color: 0x2A1808, roughness: 0.88, side: THREE.DoubleSide });
    const wingL = new THREE.Group(); wingL.position.set(0, 0.05, 0.4);
    const wingR = new THREE.Group(); wingR.position.set(0, 0.05, -0.4);
    [wingL, wingR].forEach(w => {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 1.5), wmat);
        wing.position.set(-0.1, 0, w === wingL ? 0.75 : -0.75);
        w.add(wing); g.add(w);
    });
    g.userData.wingL = wingL; g.userData.wingR = wingR;
    g.traverse(m => { if (m.isMesh) m.castShadow = true; });
    return g;
}
const _eagleVisual = _createEagleSimple();
scene.add(_eagleVisual);
window._tickEagleVisual = function (t) {
    const r = 35, yBase = 16;
    const a = t * 0.2;
    _eagleVisual.position.set(Math.cos(a) * r, yBase + Math.sin(t * 0.5) * 1.5, Math.sin(a) * r);
    _eagleVisual.rotation.y = -a + Math.PI / 2;
    _eagleVisual.rotation.z = -0.18;
    const flap = Math.sin(t * 5) * 0.55;
    _eagleVisual.userData.wingL.rotation.x = flap;
    _eagleVisual.userData.wingR.rotation.x = -flap;
};
let _eagleT = 0;
setInterval(() => {
    _eagleT += 0.05;
    if (window._tickEagleVisual) window._tickEagleVisual(_eagleT);
}, 50);

