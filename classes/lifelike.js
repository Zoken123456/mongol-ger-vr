// ══════════════════════════════════════════════════════════════════
// lifelike.js — морь / хүний дүрсийг АМЬД болгох давхарга
//
// Энэ модуль шинэ geometry ҮҮСГЭХГҮЙ. Одоо байгаа createHorse() /
// createPerson()-оор үүссэн бүлгүүдийг олж, толгой/хүзүү/сүүл/чих/
// гар зэргийг pivot Group-т багцалж (reparent), frame бүрт нарийн
// idle + walk + VR look-at хөдөлгөөн нэмнэ. Quest browser дээр
// гүйцэтгэлд ээлтэй (distance-based LOD, squared-distance шалгалт).
// ══════════════════════════════════════════════════════════════════
import * as THREE from 'three';

const _v   = new THREE.Vector3();
const _cam = new THREE.Vector3();

// Зайны босго (квадратаар — sqrt хэрэггүй, хурдан)
const NEAR2 = 9 * 9;     // VR look-at идэвхжих зай
const MID2  = 34 * 34;   // бүрэн анимэйшн хийх зай
const FAR2  = 70 * 70;   // үүнээс хол бол анимэйшныг царцаана

const _horses  = [];
const _persons = [];

// ── reparent: group доторх mesh-үүдийг pivot Group-т зөөнө ──────────
// group ба pivot ижил чиглэл/масштабтай тул local pos-оос pivotPos
// хасахад visual байрлал ХЭВЭЭР хадгалагдана.
function _reparent(group, meshes, pivotPos) {
    const pivot = new THREE.Group();
    pivot.position.copy(pivotPos);
    group.add(pivot);
    for (const m of meshes) {
        if (!m || m.parent === pivot) continue;
        m.position.sub(pivotPos);
        group.remove(m);
        pivot.add(m);
    }
    return pivot;
}

function _isBox(m, minW, maxW) {
    if (!m.isMesh || !m.geometry || m.geometry.type !== 'BoxGeometry') return false;
    if (minW === undefined) return true;
    const w = m.geometry.parameters.width;
    return w >= minW && w <= maxW;
}

// ══════════════════════════════════════════════════════════════════
//  МОРЬ
// ══════════════════════════════════════════════════════════════════
function rigHorse(g) {
    if (g.userData.__rig) return g.userData.__rig;

    const kids = g.children.slice();   // мутацид орохоос өмнө хувилна
    const headMeshes = [];
    const tailMeshes = [];
    const earMeshes  = [];
    const eyeMeshes  = [];
    const bodyMeshes = [];
    const legMeshes  = [];

    for (const c of kids) {
        if (!c.isMesh) continue;
        const p = c.position;
        if (p.x < -0.6 && p.y > 0.5) {                 // сүүл
            tailMeshes.push(c);
        } else if (p.x > 0.45 && p.y > 1.0) {          // толгой/хүзүү бүлэг
            headMeshes.push(c);
            if (p.y > 1.62 && Math.abs(p.x - 0.88) < 0.15) earMeshes.push(c);
            if (c.geometry.type === 'SphereGeometry' &&
                c.geometry.parameters.radius < 0.05)      eyeMeshes.push(c);
        } else if (p.y < 0.7 && Math.abs(p.x) > 0.1) {  // хөл
            legMeshes.push(c);
        } else {                                        // их бие
            bodyMeshes.push(c);
        }
    }

    const neckPivot = _reparent(g, headMeshes, new THREE.Vector3(0.5, 1.05, 0));
    const tailPivot = _reparent(g, tailMeshes, new THREE.Vector3(-0.66, 1.05, 0));

    // Чих/нүд reparent-ийн дараа neckPivot дотор шинэ parent-тэй боллоо
    const rig = {
        neckPivot, tailPivot,
        ears: earMeshes,
        eyes: eyeMeshes,
        body: bodyMeshes,
        bodyBaseY: bodyMeshes.map(m => m.scale.y),
        t: Math.random() * 10,
        grazeT: 2 + Math.random() * 6,    // дараагийн бэлчих хүртэлх хугацаа
        grazing: false,
        grazePhase: 0,
        earKick: 0,
        tailSwat: 0,
        lookYaw: 0,        // одоогийн зөөлрүүлсэн хүзүүний эргэлт
        prevX: g.position.x,
        prevZ: g.position.z,
        moving: false,
        lod: 0,
        _frame: 0,
    };
    g.userData.__rig = rig;
    return rig;
}

function animateHorseIdle(g, dt, camDist2) {
    const r = g.userData.__rig || rigHorse(g);
    r.t += dt;

    // Хөдөлгөөн илрүүлэх (walker-аар явж байвал бэлчихгүй, толгой өргөнө)
    const moved = Math.abs(g.position.x - r.prevX) + Math.abs(g.position.z - r.prevZ);
    r.moving = moved > 0.002;
    r.prevX = g.position.x;
    r.prevZ = g.position.z;

    // Амьсгал — их биеийг Y-ээр маш бага томсгоно
    const breathe = 1 + Math.sin(r.t * 1.7) * 0.018;
    for (let i = 0; i < r.body.length; i++) {
        r.body[i].scale.y = r.bodyBaseY[i] * breathe;
    }

    // ── Бэлчих (grazing) төлвийн машин ──
    let neckPitch = Math.sin(r.t * 1.1) * 0.05;   // суурь — толгой нам бага найгана
    if (!r.moving) {
        r.grazeT -= dt;
        if (!r.grazing && r.grazeT <= 0) { r.grazing = true;  r.grazePhase = 0; }
        if (r.grazing) {
            r.grazePhase += dt;
            // 0→down, тогтоно (өвс үнэрлэх/зулгаах), →up
            const gp = r.grazePhase;
            let down;
            if (gp < 1.0)      down = gp / 1.0;                    // доошлох
            else if (gp < 4.5) down = 1 + Math.sin(gp * 6) * 0.06; // зулгаах чичиргээ
            else if (gp < 5.5) down = Math.max(0, 1 - (gp - 4.5)); // өндийх
            else { r.grazing = false; r.grazeT = 5 + Math.random() * 8; down = 0; }
            neckPitch += down * 0.95;
        }
    } else {
        r.grazing = false;                       // явж байвал толгой өндөр
        neckPitch += Math.sin(r.t * 6) * 0.04;   // алхааны хэмнэлд бөхийх
    }
    // Z-ээр сөргөөр эргүүлбэл хамар доошилно
    r.neckPivot.rotation.z = -neckPitch;

    // ── VR look-at: ойртвол толгой хэрэглэгч рүү эргэнэ ──
    let targetYaw = Math.sin(r.t * 0.45) * 0.18;     // суурь — энд тэнд харна
    if (camDist2 < NEAR2) {
        g.getWorldPosition(_v);
        const toCamX = _cam.x - _v.x;
        const toCamZ = _cam.z - _v.z;
        // морь +X урагшаа барьж бүтээгдсэн → world yaw-аас group yaw хасна
        const worldAng = Math.atan2(toCamZ, toCamX);
        let local = -worldAng - g.rotation.y;
        while (local >  Math.PI) local -= Math.PI * 2;
        while (local < -Math.PI) local += Math.PI * 2;
        targetYaw = THREE.MathUtils.clamp(local, -0.75, 0.75);
    }
    r.lookYaw += (targetYaw - r.lookYaw) * Math.min(1, dt * 3.5);
    r.neckPivot.rotation.y = r.lookYaw;

    // ── Чих — хааяа сэрвэгнэнэ ──
    r.earKick -= dt;
    if (r.earKick <= 0) r.earKick = 1.5 + Math.random() * 4;
    const earTw = r.earKick < 0.35 ? Math.sin(r.earKick * 40) * 0.35 : 0;
    for (let i = 0; i < r.ears.length; i++) {
        r.ears[i].rotation.z = (i % 2 ? -earTw : earTw) + Math.sin(r.t * 2 + i) * 0.04;
    }

    // ── Сүүл — намуун найгалт + хааяа шавдах ──
    r.tailSwat -= dt;
    if (r.tailSwat <= 0) r.tailSwat = 2 + Math.random() * 5;
    const swat = r.tailSwat < 0.5 ? Math.sin(r.tailSwat * 26) * 0.5 : 0;
    r.tailPivot.rotation.x = Math.sin(r.t * 1.6) * 0.12;
    r.tailPivot.rotation.z = Math.sin(r.t * 1.1) * 0.14 + swat;
}

// Алхах/гүйх хөдөлгөөнийг зөөлрүүлэх (хөл нь walker-аар хөдөлдөг тул
// энд их биеийн дээш-доош намуун бөмбөлзөлт нэмж байгалийн болгоно).
function animateHorseWalk(g, dt) {
    const r = g.userData.__rig;
    if (!r || !r.moving) return;
    const bob = Math.abs(Math.sin(r.t * 7)) * 0.03;
    g.position.y = bob;        // тэгшхэн алхааны bounce (туурай ≈ y=0 хэвээр)
}

// ══════════════════════════════════════════════════════════════════
//  ХҮН (createPerson — rig-гүй статик хүн)
// ══════════════════════════════════════════════════════════════════
function rigPerson(g) {
    if (g.userData.__rig) return g.userData.__rig;

    const kids = g.children.slice();

    // Толгойн box-оор scale тооцоолно (createPerson: head = 0.24*s өргөн)
    let head = null, headW = 0;
    for (const c of kids) {
        if (_isBox(c, 0.12, 0.32) && c.position.y > 1.0) {
            if (c.position.y > (head ? head.position.y : 0) - 0.05 &&
                c.geometry.parameters.height > 0.15) { head = c; headW = c.geometry.parameters.width; }
        }
    }
    const s = head ? headW / 0.24 : 1.0;

    const headMeshes = [];
    const eyeMeshes  = [];
    const leftArm    = [];
    const rightArm   = [];
    const torsoMeshes = [];

    for (const c of kids) {
        if (!c.isMesh) continue;
        const p = c.position;
        if (p.y > 1.30 * s) {                                  // толгой бүлэг
            headMeshes.push(c);
            if (c.geometry.type === 'SphereGeometry' &&
                c.geometry.parameters.radius < 0.03 * s + 0.005 &&
                p.y < 1.6 * s) eyeMeshes.push(c);
        } else if (Math.abs(p.x) > 0.2 * s && p.y > 0.7 * s && p.y < 1.2 * s) {
            (p.x < 0 ? leftArm : rightArm).push(c);            // гар
        } else if (Math.abs(p.x) < 0.22 * s && p.y > 0.9 * s && p.y < 1.3 * s) {
            torsoMeshes.push(c);                               // бие (амьсгал)
        }
    }

    const headPivot  = _reparent(g, headMeshes, new THREE.Vector3(0, 1.40 * s, 0));
    const leftPivot  = _reparent(g, leftArm,  new THREE.Vector3(-0.28 * s, 1.20 * s, 0));
    const rightPivot = _reparent(g, rightArm, new THREE.Vector3( 0.28 * s, 1.20 * s, 0));

    const rig = {
        headPivot, leftPivot, rightPivot,
        eyes: eyeMeshes,
        torso: torsoMeshes,
        torsoBaseY: torsoMeshes.map(m => m.scale.y),
        s,
        t: Math.random() * 10,
        blinkT: 1 + Math.random() * 3,
        blinking: 0,
        lookYaw: 0,
        lookTarget: 0,
        behaviorT: 1 + Math.random() * 3,
        behavior: 'idle',
        prevX: g.position.x, prevZ: g.position.z,
        lod: 0, _frame: 0,
    };
    g.userData.__rig = rig;
    return rig;
}

function animateNPCIdle(g, dt, camDist2) {
    const r = g.userData.__rig || rigPerson(g);
    r.t += dt;

    // Хэрэв waypoint-аар алхаж байгаа бол (_tickWalkers/inhabitant биш,
    // статик хүн) — байрлал өөрчлөгдвөл idle-ийг бууруулна.
    const moved = Math.abs(g.position.x - r.prevX) + Math.abs(g.position.z - r.prevZ);
    r.prevX = g.position.x; r.prevZ = g.position.z;
    const moving = moved > 0.002;

    // Амьсгал
    const breathe = 1 + Math.sin(r.t * 1.6) * 0.022;
    for (let i = 0; i < r.torso.length; i++) {
        r.torso[i].scale.y = r.torsoBaseY[i] * breathe;
    }

    // ── Санамсаргүй зан үйл — толгойн чиглэл сонгоно ──
    r.behaviorT -= dt;
    if (r.behaviorT <= 0) {
        r.behaviorT = 2.5 + Math.random() * 4;
        const roll = Math.random();
        if      (roll < 0.30) r.lookTarget =  0.0;                 // урагш
        else if (roll < 0.52) r.lookTarget =  0.5 + Math.random() * 0.3;  // зүүн
        else if (roll < 0.74) r.lookTarget = -0.5 - Math.random() * 0.3;  // баруун
        else if (roll < 0.88) r.lookTarget =  Math.sin(r.t) * 0.2; // гэр рүү (ойролцоо)
        else                  r.lookTarget = (Math.random() - 0.5) * 1.0;
    }

    // VR look-at: ойртвол хэрэглэгч рүү эргэж харна
    let targetYaw = r.lookTarget;
    if (camDist2 < NEAR2) {
        g.getWorldPosition(_v);
        const worldAng = Math.atan2(_cam.x - _v.x, _cam.z - _v.z);
        let local = worldAng - g.rotation.y;
        while (local >  Math.PI) local -= Math.PI * 2;
        while (local < -Math.PI) local += Math.PI * 2;
        targetYaw = THREE.MathUtils.clamp(local, -1.0, 1.0);
    }
    r.lookYaw += (targetYaw - r.lookYaw) * Math.min(1, dt * 2.6);
    r.headPivot.rotation.y = r.lookYaw;
    r.headPivot.rotation.x = Math.sin(r.t * 0.9) * 0.05;   // намуун толгой дохилт

    // ── Анивчих ──
    r.blinkT -= dt;
    if (r.blinking > 0) {
        r.blinking -= dt;
        const k = r.blinking > 0 ? 0.12 : 1;
        for (const e of r.eyes) e.scale.y = k;
        if (r.blinking <= 0) for (const e of r.eyes) e.scale.y = 1;
    } else if (r.blinkT <= 0) {
        r.blinking = 0.12;
        r.blinkT = 2 + Math.random() * 4;
    }

    // ── Гарын намуун савлалт ──
    const sway = moving ? 0.0 : Math.sin(r.t * 1.3) * 0.07;
    r.leftPivot.rotation.x  =  sway;
    r.rightPivot.rotation.x = -sway;
    r.leftPivot.rotation.z  =  Math.sin(r.t * 0.8) * 0.025;
    r.rightPivot.rotation.z = -Math.sin(r.t * 0.8) * 0.025;
}

// ══════════════════════════════════════════════════════════════════
//  МАТЕРИАЛ — geometry хэвээр, зөвхөн roughness/metalness/өнгө нарийвчилна
// ══════════════════════════════════════════════════════════════════
function applyHorseMaterials(g) {
    if (g.userData.__matDone) return;
    const tint = 0.92 + Math.random() * 0.16;     // дүр болгонд бага зэрэг өөр өнгө
    g.traverse(m => {
        if (!m.isMesh || !m.material || m.material.__lf) return;
        const mat = m.material.clone();
        mat.__lf = true;
        if (mat.metalness === undefined || mat.metalness < 0.3) {
            mat.roughness = Math.min(1, (mat.roughness ?? 0.8) * 0.95 + 0.05);
            mat.metalness = 0.0;
            mat.color.multiplyScalar(tint);        // булчин шиг өнгөний хэлбэлзэл
        }
        mat.envMapIntensity = 0.5;
        m.material = mat;
    });
    g.userData.__matDone = true;
}

function applyCharacterMaterials(g) {
    if (g.userData.__matDone) return;
    g.traverse(m => {
        if (!m.isMesh || !m.material || m.material.__lf) return;
        const mat = m.material.clone();
        mat.__lf = true;
        if (mat.metalness === undefined || mat.metalness < 0.3) {
            mat.roughness = THREE.MathUtils.clamp((mat.roughness ?? 0.8), 0.55, 0.95);
            mat.metalness = 0.0;
        }
        mat.envMapIntensity = 0.6;
        m.material = mat;
    });
    g.userData.__matDone = true;
}

// ── Сүүдэр баталгаажуулах + газартай зууралт (floating fix) ─────────
function setupCharacterShadows(g) {
    g.traverse(m => {
        if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
    });
    if (g.position.y > 0.001 || g.position.y < -0.001) {
        // алхааны bob-оос бусад тохиолдолд газартай нийлүүлнэ
        if (!g.userData.__rig) g.position.y = 0;
    }
}

// ── Distance-based LOD ─────────────────────────────────────────────
// 0 = ойр (бүрэн), 1 = дунд (хагас давтамж), 2 = хол (царцсан)
function updateCharacterLOD(g, camDist2) {
    if (camDist2 > FAR2) return 2;
    if (camDist2 > MID2) return 1;
    return 0;
}

// ══════════════════════════════════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════════════════════════════════
export function setupLifelike(scene) {
    scene.traverse(o => {
        if (!o.userData) return;
        // Rigged inhabitant (createMongolInhabitant)-ийг алгасна —
        // тэр өөрийн _applyHumanPose-той.
        if (o.userData.torsoPivot || o.userData.body) return;

        if (o.userData.isHorse && !o.userData.__rig) {
            rigHorse(o);
            applyHorseMaterials(o);
            setupCharacterShadows(o);
            _horses.push(o);
        } else if (o.userData.isPerson && !o.userData.__rig) {
            rigPerson(o);
            applyCharacterMaterials(o);
            setupCharacterShadows(o);
            _persons.push(o);
        }
    });
    return { horses: _horses.length, persons: _persons.length };
}

export function tickLifelike(dt, camera, ridingHorse) {
    if (!camera) return;
    camera.getWorldPosition(_cam);

    for (const h of _horses) {
        if (h === ridingHorse || !h.visible || !h.parent) continue;
        h.getWorldPosition(_v);
        const d2 = _v.distanceToSquared(_cam);
        const lod = updateCharacterLOD(h, d2);
        if (lod === 2) continue;                       // хол — царцаана
        h._lf = (h._lf || 0) + 1;
        if (lod === 1 && (h._lf & 1)) continue;        // дунд — frame алгасна
        const step = lod === 1 ? dt * 2 : dt;
        animateHorseIdle(h, step, d2);
        animateHorseWalk(h, step);
    }

    for (const p of _persons) {
        if (!p.visible || !p.parent) continue;
        p.getWorldPosition(_v);
        const d2 = _v.distanceToSquared(_cam);
        const lod = updateCharacterLOD(p, d2);
        if (lod === 2) continue;
        p._lf = (p._lf || 0) + 1;
        if (lod === 1 && (p._lf & 1)) continue;
        animateNPCIdle(p, lod === 1 ? dt * 2 : dt, d2);
    }
}

export {
    rigHorse, animateHorseIdle, animateHorseWalk,
    rigPerson as createNPC, animateNPCIdle,
    updateCharacterLOD, applyCharacterMaterials,
    applyHorseMaterials, setupCharacterShadows,
};
