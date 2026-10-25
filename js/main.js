// Shahr Azad: Los Santos v5 — real Three.js 3D, clean HUD, isometric 2D fallback if WebGL fails.
import * as THREE from './three.module.js';
import { WORLD_W, WORLD_H, vRoads, hRoads, buildings, parks, trees, palms, onRoad } from './world.js';
import { t, setLang } from './i18n.js';
import { drawIso } from './iso.js';
const $ = id => document.getElementById(id);
const cv = $('gl');
let saved = {}; try { saved = JSON.parse(localStorage.getItem('shahrAzad3d') || '{}'); } catch (e) {}
const player = { x: 50, z: 90, angle: 0, speed: 0, hp: 100, money: saved.money || 0, car: null, wanted: 0, dead: false };
let settings = { quality: 'high', sound: true, lang: 'fa', minimap: true, camera: 'normal' };
try { const s = JSON.parse(localStorage.getItem('shahrAzadSettings') || '{}'); settings = Object.assign(settings, s); } catch (e) {}
function camScale() { return settings.camera === 'far' ? 1.25 : settings.camera === 'near' ? 0.8 : 1.0; }
function applySettings() {
  try { localStorage.setItem('shahrAzadSettings', JSON.stringify(settings)); } catch (e) {}
  if (typeof soundOn !== 'undefined') soundOn = !!settings.sound;
  const mini = $('mini'); if (mini) mini.style.display = settings.minimap ? 'block' : 'none';
  if (typeof renderer !== 'undefined' && renderer) { renderer.setPixelRatio(settings.quality === 'low' ? 1 : Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = settings.quality !== 'low'; if (sun) sun.castShadow = settings.quality !== 'low'; }
  const q = $('qualitySelect'); if (q) q.value = settings.quality;
  const so = $('soundSelect'); if (so) so.value = settings.sound ? 'on' : 'off';
  const la = $('langSelect'); if (la) la.value = settings.lang;
  const ca = $('cameraSelect'); if (ca) ca.value = settings.camera;
  const mc = $('minimapCheck'); if (mc) mc.checked = !!settings.minimap;
  if (settings.lang) setLang(settings.lang);
}
let cars = [], peds = [], cash = [], police = [], frame = 0, running = false, paused = false, soundOn = true, crimeTimer = 0, hideTimer = 0, missionIdx = saved.missionIdx || 0, missionCash = 0, missionState = 'go', msgTimer = 0;
let useIso = false, isoCtx = null, threeMode = false, renderer = null, scene = null, camera = null, sun = null, playerMesh = null, beaconMesh = null, clouds = [];
let msgTimer2 = 0;
function showMsg(txt, ms) { const m = $('msg'); m.textContent = txt; m.style.display = 'block'; clearTimeout(msgTimer); msgTimer = setTimeout(() => m.style.display = 'none', ms || 2600); }
function save() { try { localStorage.setItem('shahrAzad3d', JSON.stringify({ money: player.money, missionIdx })); } catch (e) {} }
function col(c) { return new THREE.Color(c[0], c[1], c[2]); }
function std(c, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: col(c), roughness: 0.85, metalness: 0.05 }, o || {})); }
// procedural window texture for buildings
const texCache = {};
function winTex(c) {
  const key = c.join(',');
  if (texCache[key]) return texCache[key];
  const cnv = document.createElement('canvas'); cnv.width = 256; cnv.height = 512; const g = cnv.getContext('2d');
  const base = 'rgb(' + Math.round(c[0]*255) + ',' + Math.round(c[1]*255) + ',' + Math.round(c[2]*255) + ')';
  g.fillStyle = base; g.fillRect(0, 0, 256, 512);
  g.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < 512; y += 16) g.fillRect(0, y, 256, 1); for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 1, 512);
  for (let row = 0; row < 10; row++) for (let col = 0; col < 4; col++) {
    const x = 14 + col * 60, y = 18 + row * 46, lit = ((col * 7 + row * 13 + Math.round(c[0]*10)) % 10) < 3;
    g.fillStyle = '#e8e0cc'; g.fillRect(x - 3, y - 3, 44, 36);
    g.fillStyle = lit ? '#ffe9a8' : (row % 2 ? '#2a3f52' : '#1c2b38'); g.fillRect(x, y, 38, 30);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x, y, 38, 6); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 17, y, 2, 30);
    if (row % 3 === 2) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - 3, y + 33, 44, 4); }
  }
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 470, 256, 42); g.fillStyle = '#d8c9a0'; g.fillRect(10, 478, 100, 26); g.fillRect(146, 478, 100, 26); g.fillStyle = '#3a2f22'; g.fillRect(112, 470, 32, 42);
  const tx = new THREE.CanvasTexture(cnv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; texCache[key] = tx; return tx;
}
function noiseTex(base, fleck, size) {
  const cnv = document.createElement('canvas'); cnv.width = 256; cnv.height = 256; const g = cnv.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { g.fillStyle = fleck[Math.floor(Math.random() * fleck.length)]; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  const tx = new THREE.CanvasTexture(cnv); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = THREE.RepeatWrapping; tx.wrapT = THREE.RepeatWrapping; return tx;
}
let _asphalt = null, _ground = null;
function asphaltTex() { if (!_asphalt) _asphalt = noiseTex('#26282c', ['#3a3d42', '#1a1c1f', '#4a4d52', '#222']); return _asphalt; }
function groundTex() { if (!_ground) { _ground = noiseTex('#8a7f6a', ['#7a6f5c', '#9a8f7a', '#6f6450', '#a89a82']); _ground.repeat.set(14, 10); } return _ground; }
function skyTex() {
  const cnv = document.createElement('canvas'); cnv.width = 512; cnv.height = 256; const g = cnv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#1e3a6e'); gr.addColorStop(0.45, '#7a6a9a'); gr.addColorStop(0.72, '#f2a65a'); gr.addColorStop(1, '#f7c873'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  g.fillStyle = 'rgba(255,220,140,0.9)'; g.beginPath(); g.arc(256, 185, 22, 0, 7); g.fill();
  const tx = new THREE.CanvasTexture(cnv); tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
function box(w, h, d, mat, x, y, z, ry) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; }
function buildCity() {
  scene.fog = new THREE.Fog(0xf2a65a, 90, 340);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false })); sky.position.set(WORLD_W/2, 0, WORLD_H/2); scene.add(sky);
  scene.add(new THREE.HemisphereLight(0xffe0b3, 0x5a4a3a, 0.9));
  sun = new THREE.DirectionalLight(0xffd9a0, 2.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90; sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90; sun.shadow.camera.near = 10; sun.shadow.camera.far = 400; sun.shadow.bias = -0.0004; scene.add(sun); scene.add(sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W + 60, WORLD_H + 60), new THREE.MeshStandardMaterial({ map: groundTex(), roughness: 1 })); ground.rotation.x = -Math.PI/2; ground.position.set(WORLD_W/2, 0, WORLD_H/2); ground.receiveShadow = true; scene.add(ground);
  const roadMat = new THREE.MeshStandardMaterial({ map: asphaltTex(), roughness: 0.95 });
  for (const rx of vRoads) box(17, 0.12, WORLD_H, roadMat, rx, 0.06, WORLD_H/2);
  for (const rz of hRoads) box(WORLD_W, 0.12, 17, roadMat, WORLD_W/2, 0.06, rz);
  for (const rx of vRoads) for (let z = 8; z < WORLD_H; z += 14) box(0.6, 0.05, 6, std([0.96, 0.84, 0.25]), rx, 0.14, z);
  for (const rz of hRoads) for (let x = 8; x < WORLD_W; x += 14) box(6, 0.05, 0.6, std([0.96, 0.84, 0.25]), x, 0.14, rz);
  for (const p of parks) box(p.w, 0.2, p.d, std([0.18, 0.50, 0.22]), p.x, 0.1, p.z);
  for (let xi = 0; xi < vRoads.length - 1; xi++) for (let yi = 0; yi < hRoads.length - 1; yi++) { const x0 = vRoads[xi] + 8.5, x1 = vRoads[xi+1] - 8.5, z0 = hRoads[yi] + 8.5, z1 = hRoads[yi+1] - 8.5; box(x1-x0, 0.2, z1-z0, std([0.72, 0.70, 0.64]), (x0+x1)/2, 0.1, (z0+z1)/2); }
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(16, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd23f })); sunDisc.position.set(330, 75, 170); scene.add(sunDisc);
  for (const b of buildings) {
    const side = new THREE.MeshStandardMaterial({ map: winTex(b.c), roughness: 0.9 });
    const roof = std([Math.max(0, b.c[0]-0.15), Math.max(0, b.c[1]-0.15), Math.max(0, b.c[2]-0.15)]);
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), [side, side, roof, roof, side, side]); m.position.set(b.x, b.h/2, b.z); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    box(b.w + 0.6, 0.5, b.d + 0.6, roof, b.x, b.h + 0.25, b.z);
    box(1.6, 1.0, 1.6, std([0.55, 0.55, 0.58]), b.x - b.w/4, b.h + 1.0, b.z);
    box(1.0, 0.8, 1.0, std([0.45, 0.45, 0.48]), b.x + b.w/4, b.h + 0.9, b.z + b.d/4);
  }
  for (const rx of vRoads) for (const rz of hRoads) {
    for (let i = -3; i <= 3; i++) { box(0.7, 0.05, 3.5, std([0.9, 0.9, 0.88]), rx - 6 + i * 2, 0.16, rz + 12); box(3.5, 0.05, 0.7, std([0.9, 0.9, 0.88]), rx + 12, 0.16, rz - 6 + i * 2); }
    box(0.3, 4, 0.3, std([0.2, 0.2, 0.2]), rx + 10, 2, rz + 10);
    box(0.7, 1.6, 0.5, std([0.15, 0.15, 0.15]), rx + 10, 4.8, rz + 10);
    box(0.5, 0.35, 0.1, new THREE.MeshStandardMaterial({ color: 0xff1744, emissive: 0xff1744, emissiveIntensity: 1 }), rx + 10, 5.2, rz + 10.3);
    box(0.5, 0.35, 0.1, new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffd23f, emissiveIntensity: 0.6 }), rx + 10, 4.8, rz + 10.3);
    box(0.5, 0.35, 0.1, new THREE.MeshStandardMaterial({ color: 0x2ecc71, emissive: 0x2ecc71, emissiveIntensity: 1 }), rx + 10, 4.4, rz + 10.3);
  }
  for (const bb of [{ x: 180, z: 18, txt: 'LOS SANTOS' }, { x: 90, z: 208, txt: 'SHAHR AZAD' }]) {
    const cnv = document.createElement('canvas'); cnv.width = 512; cnv.height = 256; const g = cnv.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#1a2f4a'); gr.addColorStop(1, '#f2a65a'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256); g.fillStyle = '#ffd23f'; g.font = 'bold 64px Tahoma'; g.textAlign = 'center'; g.fillText(bb.txt, 256, 140); g.fillStyle = '#fff'; g.font = 'bold 32px Tahoma'; g.fillText('★ ★ ★', 256, 190);
    const tex = new THREE.CanvasTexture(cnv); tex.colorSpace = THREE.SRGBColorSpace;
    box(0.5, 7, 0.5, std([0.2, 0.2, 0.2]), bb.x - 5, 3.5, bb.z); box(0.5, 7, 0.5, std([0.2, 0.2, 0.2]), bb.x + 5, 3.5, bb.z);
    const board = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 0.5), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })); board.position.set(bb.x, 10.5, bb.z); board.castShadow = true; scene.add(board);
  }
  for (const tt of trees) {
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 2, 8), std([0.36, 0.25, 0.15])); tr.position.set(tt.x, 1, tt.z); tr.castShadow = true; scene.add(tr);
    for (const off of [[0, 3.4, 0, 1.9, 0.12], [0.9, 2.8, 0.5, 1.3, 0.20], [-0.8, 2.9, -0.4, 1.2, 0.28]]) { const fo = new THREE.Mesh(new THREE.SphereGeometry(off[3], 10, 8), std([off[4], 0.45 + off[4] * 0.2, 0.18])); fo.position.set(tt.x + off[0], off[1], tt.z + off[2]); fo.castShadow = true; scene.add(fo); }
  }
  for (const p of palms) {
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 6, 8), std([0.45, 0.32, 0.20])); tr.position.set(p.x, 3, p.z); tr.castShadow = true; scene.add(tr);
    for (let i = 0; i < 5; i++) { const lf = box(3.4, 0.18, 0.7, std([0.15, 0.55, 0.25]), p.x, 6.2, p.z, i * 1.26); lf.position.x = p.x + Math.cos(i * 1.26) * 1.4; lf.position.z = p.z + Math.sin(i * 1.26) * 1.4; lf.rotation.z = 0.25; }
  }
  for (const rx of vRoads) for (const rz of hRoads) { box(0.3, 5, 0.3, std([0.2, 0.2, 0.2]), rx + 9, 2.5, rz + 9); box(1.2, 0.3, 0.7, new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffb300, emissiveIntensity: 0.8 }), rx + 9, 5.1, rz + 9); }
  box(WORLD_W, 0.15, 14, std([0.90, 0.80, 0.60]), WORLD_W/2, 0.07, 248);
  box(WORLD_W, 0.15, 8, std([0.15, 0.45, 0.75]), WORLD_W/2, 0.07, 259);
  for (let i = 0; i < 5; i++) { const grp = new THREE.Group(); for (let j = 0; j < 3; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(6 + j * 2, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, roughness: 1 })); s.position.set(j * 8 - 8, j, 0); grp.add(s); } grp.position.set(40 + i * 70, 46 + i * 3, 40 + i * 40); scene.add(grp); clouds.push(grp); }
  beaconMesh = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 14, 12), new THREE.MeshStandardMaterial({ color: 0xffd23f, transparent: true, opacity: 0.35, emissive: 0xffd23f, emissiveIntensity: 0.6 })); beam.position.y = 7; beaconMesh.add(beam);
  const dia = new THREE.Mesh(new THREE.OctahedronGeometry(1.6), new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffb300, emissiveIntensity: 1 })); dia.position.y = 15; beaconMesh.add(dia); beaconMesh.userData.dia = dia; scene.add(beaconMesh);
}
function makeCarMesh(c) {
  const g = new THREE.Group(); const len = c.type === 'sport' ? 5.4 : 4.6, wid = 2.0;
  const paint = c.police ? [0.95, 0.95, 0.95] : c.color;
  const shape = new THREE.Shape();
  shape.moveTo(-len/2, 0.32); shape.lineTo(-len/2, 0.78); shape.quadraticCurveTo(-len/2 + 0.3, 0.95, -1.35, 1.0); shape.quadraticCurveTo(-0.9, 1.48, -0.1, 1.5); shape.quadraticCurveTo(0.9, 1.48, 1.35, 1.0); shape.quadraticCurveTo(len/2 - 0.2, 0.92, len/2, 0.68); shape.lineTo(len/2, 0.32); shape.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: wid - 0.3, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 3, steps: 1 }); bodyGeo.translate(0, 0, -(wid - 0.3)/2);
  const body = new THREE.Mesh(bodyGeo, std(paint, { metalness: 0.55, roughness: 0.28 })); body.castShadow = true; g.add(body);
  const glass = new THREE.MeshStandardMaterial({ color: 0x16222e, metalness: 0.9, roughness: 0.08 });
  for (const sz of [wid/2 + 0.02, -wid/2 - 0.02]) { const win = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.06), glass); win.position.set(-0.1, 1.22, sz); g.add(win); const winF = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.5), glass); winF.position.set(1.05, 1.22, 0); winF.rotation.y = 0.35; g.add(winF); }
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 1.3), std([0.1, 0.1, 0.12], { metalness: 0.6, roughness: 0.4 })); grille.position.set(len/2 + 0.06, 0.58, 0); g.add(grille);
  if (c.police) { for (const sz of [wid/2 - 0.05, -wid/2 + 0.05]) { const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.06), std([0.08, 0.08, 0.10])); door.position.set(-0.3, 0.58, sz); g.add(door); } }
  const wg = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 18); const wm = std([0.08, 0.08, 0.08]);
  const hub = new THREE.CylinderGeometry(0.2, 0.2, 0.34, 14); const hm = std([0.75, 0.75, 0.78], { metalness: 0.8, roughness: 0.25 });
  for (const sx of [1.6, -1.6]) for (const sz of [wid/2, -wid/2]) { const w = new THREE.Mesh(wg, wm); w.rotation.x = Math.PI/2; w.position.set(sx, 0.42, sz); w.castShadow = true; g.add(w); const h = new THREE.Mesh(hub, hm); h.rotation.x = Math.PI/2; h.position.set(sx, 0.42, sz); g.add(h); }
  for (const sz of [0.62, -0.62]) { const hl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xfff2a0, emissiveIntensity: 1.2 })); hl.position.set(len/2, 0.65, sz); g.add(hl); const tl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.45), new THREE.MeshStandardMaterial({ color: 0xff1744, emissive: 0xff1744, emissiveIntensity: 0.9 })); tl.position.set(-len/2, 0.65, sz); g.add(tl); const mir = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.14), std(paint, { metalness: 0.5, roughness: 0.3 })); mir.position.set(0.8, 1.15, sz > 0 ? wid/2 + 0.08 : -wid/2 - 0.08); g.add(mir); }
  if (c.type === 'sport') { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 1.9), std([0.1, 0.1, 0.1])); sp.position.set(-len/2 + 0.1, 1.0, 0); g.add(sp); }
  if (c.type === 'taxi') { const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.9), std([1, 0.85, 0])); sign.position.set(-0.3, 1.65, 0); g.add(sign); }
  if (c.police) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.9), new THREE.MeshStandardMaterial({ color: 0xff1744, emissive: 0xff1744, emissiveIntensity: 1 })); bar.position.set(-0.3, 1.65, 0); g.add(bar); g.userData.bar = bar; }
  c.mesh = g; scene.add(g); return g;
}
function makePersonMesh(x, z, c, isPlayer) {
  const g = new THREE.Group(); const skin = std([1, 0.8, 0.62], { roughness: 0.7 }); const jeans = std(isPlayer ? [0.15, 0.25, 0.55] : [0.13, 0.13, 0.15]);
  const legs = [];
  // Forward is local +X, so side-by-side means offset in Z, not X. The old X offsets put legs front-and-back, which made walking look sideways.
  for (const sz of [0.22, -0.22]) { const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.55, 4, 10), jeans); leg.position.set(0, 0.48, sz); leg.castShadow = true; g.add(leg); legs.push(leg); }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 4, 12), std(c, { roughness: 0.8 })); torso.position.y = 1.18; torso.castShadow = true; g.add(torso);
  const arms = [];
  for (const sz of [0.55, -0.55]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.5, 4, 10), std(c, { roughness: 0.8 })); arm.position.set(0, 1.18, sz); g.add(arm); arms.push(arm); const hand = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), skin); hand.position.set(0, 0.82, sz); g.add(hand); }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 18, 14), skin); head.position.y = 1.98; head.castShadow = true; g.add(head);
  for (const sz of [0.13, -0.13]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), std([0.05, 0.05, 0.05])); eye.position.set(0.31, 2.02, sz); g.add(eye); const ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), skin); ear.position.set(0, 1.98, sz > 0 ? 0.33 : -0.33); g.add(ear); }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), skin); nose.position.set(0.34, 1.92, 0); g.add(nose);
  for (const sz of [0.22, -0.22]) { const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.24), std([0.08, 0.08, 0.10])); shoe.position.set(0.05, 0.07, sz); g.add(shoe); }
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 12), std([0.12, 0.10, 0.08])); hair.scale.set(1, 0.65, 1); hair.position.set(0, 2.12, -0.04); g.add(hair);
  if (isPlayer) { const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 16), std([0.12, 0.12, 0.14])); capTop.position.y = 2.28; g.add(capTop); const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.35), std([0.12, 0.12, 0.14])); brim.position.set(0, 2.24, 0.35); g.add(brim); }
  g.userData.legs = legs; g.userData.arms = arms;
  g.position.set(x, 0, z); scene.add(g); return g;
}
function makeCashMesh(ca) {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), new THREE.MeshStandardMaterial({ color: 0xffc400, emissive: 0xffb300, emissiveIntensity: 0.9, metalness: 0.7, roughness: 0.2 })); m.position.set(ca.x, 1.0, ca.z); ca.mesh = m; scene.add(m); return m;
}
function makeCar(x, z, angle, color, type, traffic, policeCar) { const max = { sedan: 26, taxi: 26, sport: 36, police: 30 }[type] || 26; return { x, z, angle, speed: 0, color, type, traffic: !!traffic, police: !!policeCar, max }; }
function clearMeshes(arr) { for (const o of arr) if (o.mesh) { scene.remove(o.mesh); o.mesh = null; } }
function spawnCars() {
  if (scene) clearMeshes(cars); if (scene) clearMeshes(police); police = [];
  cars = []; const cols = [[0.85,0.20,0.20],[0.95,0.85,0.15],[0.95,0.95,0.95],[0.25,0.28,0.32],[1,0.44,0.26],[0.15,0.65,0.60],[0.67,0.28,0.74]];
  for (let i = 0; i < 12; i++) { const rx = vRoads[i % vRoads.length]; cars.push(makeCar(rx+5, 30+(i*19)%200, Math.PI/2, cols[i%cols.length], i===3 ? 'sport' : 'sedan', false, false)); }
  cars.push(makeCar(125, 90, 0, [0.85,0.20,0.20], 'sport', false, false));
  cars.push(makeCar(47, 70, Math.PI/2, [0.95,0.95,0.95], 'sedan', false, false));
  cars.push(makeCar(53, 110, -Math.PI/2, [1,0.44,0.26], 'sedan', false, false));
  cars.push(makeCar(47, 135, Math.PI/2, [0.15,0.65,0.60], 'taxi', false, false));
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) { const rx = vRoads[i % vRoads.length]; cars.push(makeCar(rx+(i%4<2?-3:3), 20+Math.random()*220, i%4<2 ? Math.PI/2 : -Math.PI/2, cols[(i+2)%cols.length], 'sedan', true, false)); }
    else { const rz = hRoads[i % hRoads.length]; cars.push(makeCar(20+Math.random()*320, rz+(i%4<2?-3:3), i%4<2 ? 0 : Math.PI, cols[(i+3)%cols.length], 'taxi', true, false)); }
  }
  if (scene) for (const c of cars) makeCarMesh(c);
}
function spawnPeds() {
  if (scene) clearMeshes(peds);
  const pc = [[0.85,0.2,0.2],[0.08,0.4,0.75],[0.48,0.12,0.65],[0,0.54,0.48],[0.96,0.49,0],[0.22,0.28,0.31]]; peds = [];
  for (let i = 0; i < 22; i++) { const rx = vRoads[i % vRoads.length]; peds.push({ x: rx+(Math.random()<.5?-11:11), z: 20+Math.random()*220, tx: rx, tz: 20+Math.random()*220, speed: 1.6, down: 0, c: pc[i%pc.length], angle: 0 }); }
  peds.push({ x: 55, z: 85, tx: 55, tz: 110, speed: 1.6, down: 0, c: pc[0], angle: 0 });
  peds.push({ x: 45, z: 95, tx: 45, tz: 70, speed: 1.6, down: 0, c: pc[1], angle: 0 });
  peds.push({ x: 58, z: 100, tx: 58, tz: 120, speed: 1.6, down: 0, c: pc[2], angle: 0 });
  if (scene) for (const p of peds) p.mesh = makePersonMesh(p.x, p.z, p.c, false);
}
function spawnCash() {
  if (scene) clearMeshes(cash);
  cash = []; for (let i = 0; i < 10; i++) { const rx = vRoads[i % vRoads.length]; cash.push({ x: rx+(Math.random()<.5?-11:11), z: 20+Math.random()*220, v: 50+Math.floor(Math.random()*4)*50, taken: false }); }
  if (scene) for (const ca of cash) makeCashMesh(ca);
}
function missions() { return [
  { title: t('m1'), point: { x: 130, z: 120 }, reward: 500 },
  { title: t('m2'), point: { x: 290, z: 195 }, reward: 1200, needSport: true },
  { title: t('m3'), point: null, reward: 1000, needCash: 5 },
]; }
function missionText() { const m = missions()[missionIdx]; if (!m) return t('done'); return m.title + ' — ' + t('reward') + ': ' + m.reward; }
function completeMission() { const m = missions()[missionIdx]; player.money += m.reward; missionIdx++; missionCash = 0; missionState = 'go'; showMsg('✅ ' + m.reward, 3000); beep(660, 120); setTimeout(() => beep(880, 180), 140); save(); }
function setWanted(n) { player.wanted = Math.max(0, Math.min(5, n)); syncPolice(); }
function syncPolice() {
  const need = Math.min(player.wanted, 4);
  while (police.length < need) { const pc = makeCar(player.x+(Math.random()<.5?-35:35), player.z+(Math.random()<.5?-25:25), 0, [0.08,0.35,0.75], 'police', false, true); police.push(pc); if (scene) makeCarMesh(pc); }
  while (police.length > need) { const pc = police.pop(); if (pc.mesh && scene) scene.remove(pc.mesh); }
}
let AC = null; function beep(f, d) { if (!soundOn) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = f; o.connect(g); g.connect(AC.destination); g.gain.setValueAtTime(.1, AC.currentTime); g.gain.exponentialRampToValueAtTime(.001, AC.currentTime + d/1000); o.start(); o.stop(AC.currentTime + d/1000); } catch (e) {} }
const keys = {}; addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (e.key.toLowerCase() === 'e') toggleCar(); if (e.key === ' ') e.preventDefault(); });
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('keydown', e => { if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault(); });
let joy = { active: false, id: null, dx: 0, dy: 0 }; const jb = $('joyBase'), jk = $('joyKnob');
function joyPos(tt) { const r = jb.getBoundingClientRect(); return { x: tt.clientX-(r.left+64), y: tt.clientY-(r.top+64) }; }
jb.addEventListener('touchstart', e => { e.preventDefault(); const tt = e.changedTouches[0]; joy.active = true; joy.id = tt.identifier; const p = joyPos(tt); joy.dx = p.x/55; joy.dy = p.y/55; }, { passive: false });
jb.addEventListener('touchmove', e => { e.preventDefault(); for (const tt of e.changedTouches) if (tt.identifier === joy.id) { const p = joyPos(tt); let dx = p.x/55, dy = p.y/55; const l = Math.hypot(dx, dy); if (l > 1) { dx/=l; dy/=l; } joy.dx = dx; joy.dy = dy; jk.style.left = (39+dx*30)+'px'; jk.style.top = (39+dy*30)+'px'; } }, { passive: false });
function joyEnd(e) { for (const tt of e.changedTouches) if (tt.identifier === joy.id) { joy.active = false; joy.dx = 0; joy.dy = 0; jk.style.left = '39px'; jk.style.top = '39px'; } } jb.addEventListener('touchend', joyEnd); jb.addEventListener('touchcancel', joyEnd);
let touchGas = false, touchBrake = false;
function bindHold(id, fn) { const el = $(id); el.addEventListener('touchstart', e => { e.preventDefault(); fn(true); }, { passive: false }); el.addEventListener('touchend', e => { e.preventDefault(); fn(false); }); el.addEventListener('touchcancel', () => fn(false)); el.addEventListener('mousedown', () => fn(true)); el.addEventListener('mouseup', () => fn(false)); el.addEventListener('mouseleave', () => fn(false)); }
bindHold('gasBtn', v => touchGas = v); bindHold('brakeBtn', v => touchBrake = v);
$('actBtn').addEventListener('click', toggleCar);
document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => { setLang(b.getAttribute('data-lang')); updateHUD(); }));
$('startBtn').addEventListener('click', () => {
  $('menu').style.display = 'none'; if (innerWidth < 800) { jb.style.display = 'block'; $('actions').style.display = 'flex'; }
  try {
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
      scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.5, 600); buildCity(); playerMesh = makePersonMesh(player.x, player.z, [0.95, 0.95, 0.95], true);
    }
    threeMode = true;
  } catch (e) { threeMode = false; useIso = true; cv.style.display = 'none'; const ic = $('iso'); ic.style.display = 'block'; ic.width = innerWidth; ic.height = innerHeight; isoCtx = ic.getContext('2d'); }
  spawnCars(); spawnPeds(); spawnCash(); syncPolice();
  running = true; requestAnimationFrame(loop);
});
function openPause() { if (!running) return; paused = true; $('pauseMenu').style.display = 'flex'; }
function closePause() { paused = false; $('pauseMenu').style.display = 'none'; }
$('pauseBtn').addEventListener('click', openPause);
$('resumeBtn').addEventListener('click', closePause);
$('restartBtn').addEventListener('click', () => { closePause(); respawn(); player.money = 0; missionIdx = 0; updateHUD(); });
$('menuBtn').addEventListener('click', () => { location.reload(); });
$('soundBtn').addEventListener('click', () => { soundOn = !soundOn; settings.sound = soundOn; applySettings(); $('soundBtn').textContent = soundOn ? '🔊' : '🔇'; });
addEventListener('keydown', e => { if ((e.key === 'p' || e.key === 'Escape') && running && $('menu').style.display === 'none') { if ($('pauseMenu').style.display === 'flex') closePause(); else openPause(); } });
function openSettings() { applySettings(); $('settingsOverlay').style.display = 'flex'; }
$('menuSettingsBtn').addEventListener('click', openSettings);
$('pauseSettingsBtn').addEventListener('click', openSettings);
$('closeSettingsBtn').addEventListener('click', () => { $('settingsOverlay').style.display = 'none'; });
$('helpBtn').addEventListener('click', () => { const h = $('helpSection'); h.style.display = h.style.display === 'none' ? 'block' : 'none'; });
$('qualitySelect').addEventListener('change', e => { settings.quality = e.target.value; applySettings(); });
$('soundSelect').addEventListener('change', e => { settings.sound = e.target.value === 'on'; applySettings(); });
$('langSelect').addEventListener('change', e => { settings.lang = e.target.value; setLang(settings.lang); applySettings(); updateHUD(); });
$('cameraSelect').addEventListener('change', e => { settings.camera = e.target.value; applySettings(); });
$('minimapCheck').addEventListener('change', e => { settings.minimap = e.target.checked; applySettings(); });
addEventListener('resize', () => { if (useIso && isoCtx) { isoCtx.canvas.width = innerWidth; isoCtx.canvas.height = innerHeight; } else if (renderer) { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); } });
function nearestCar(x, z) { let best = null, bd = 1e9; for (const c of cars) { const d = Math.hypot(c.x-x, c.z-z); if (d < bd) { bd = d; best = c; } } return { car: best, d: bd }; }
function toggleCar() {
  if (!running || paused) return;
  if (player.car) { const c = player.car; player.car = null; c.speed = 0; player.x = c.x+4; player.z = c.z; player.angle = c.angle; $('actBtn').textContent = t('enter'); beep(300, 80); return; }
  const { car, d } = nearestCar(player.x, player.z);
  if (car && d < 6) {
    if (car.police) setWanted(player.wanted+2);
    else if (car.traffic) setWanted(player.wanted+1);
    else if (police.some(pc => Math.hypot(pc.x-player.x, pc.z-player.z) < 40)) setWanted(player.wanted+1);
    // parked car in an empty street: no wanted — only stealing in front of police, hijacking a moving car, or hitting a pedestrian brings police
    player.car = car; car.traffic = false; $('actBtn').textContent = t('exit'); beep(440, 100);
    if (missions()[missionIdx] && missions()[missionIdx].needSport && car.type === 'sport' && car.color[0] > 0.8) missionState = 'deliver';
  } else showMsg('—', 1200);
}
function collide(e, nx, nz, r) {
  for (const b of buildings) {
    const bx0 = b.x-b.w/2, bx1 = b.x+b.w/2, bz0 = b.z-b.d/2, bz1 = b.z+b.d/2;
    const cx = Math.max(bx0, Math.min(nx, bx1)), cz = Math.max(bz0, Math.min(nz, bz1));
    if (Math.hypot(nx-cx, nz-cz) < r) { const left = (nx+r)-bx0, right = bx1-(nx-r), top = (nz+r)-bz0, bottom = bz1-(nz-r); const m = Math.min(left, right, top, bottom); if (m === left) nx = bx0-r-0.1; else if (m === right) nx = bx1+r+0.1; else if (m === top) nz = bz0-r-0.1; else nz = bz1+r+0.1; }
  }
  e.x = Math.max(1, Math.min(WORLD_W-1, nx)); e.z = Math.max(1, Math.min(WORLD_H-1, nz));
}
function update() {
  frame++;
  if (player.hp <= 0 && !player.dead) { player.dead = true; showMsg('💀', 3000); setTimeout(respawn, 2000); return; }
  let gas = 0, steer = 0;
  if (keys['w'] || keys['arrowup'] || touchGas) gas = 1; if (keys['s'] || keys['arrowdown'] || touchBrake) gas = -1;
  if (keys['a'] || keys['arrowleft']) steer = -1; if (keys['d'] || keys['arrowright']) steer = 1;
  if (joy.active) { if (joy.dy < -0.3) gas = 1; if (joy.dy > 0.3) gas = -1; if (joy.dx < -0.3) steer = -1; if (joy.dx > 0.3) steer = 1; }
  if (keys[' ']) gas = gas > 0 ? 0.2 : -0.8;
  if (player.car) {
    const c = player.car; c.speed += gas*1.7; if (gas === 0) c.speed *= 0.985; else c.speed *= 0.995; if (c.speed > c.max) c.speed = c.max; if (c.speed < -9) c.speed = -9;
    if (Math.abs(c.speed) > 0.5) c.angle += steer*0.045*(c.speed > 0 ? 1 : -1)*Math.min(1, Math.abs(c.speed)/8);
    const nx = c.x + Math.cos(c.angle)*c.speed*0.016, nz = c.z + Math.sin(c.angle)*c.speed*0.016; const bx = c.x, bz = c.z; collide(c, nx, nz, 1.9);
    // Crash check: expected movement per frame is speed*0.016, so only bounce back if movement is less than half of that (i.e. really blocked). The old 0.08 threshold was 5x the expected movement, so it reversed the car every frame above speed 6 — that was why gas barely moved the car.
    if (Math.hypot(c.x-bx, c.z-bz) < Math.abs(c.speed)*0.008 && Math.abs(c.speed) > 6) { c.speed *= -0.3; player.hp -= 2; beep(120, 120); }
    player.x = c.x; player.z = c.z; player.angle = c.angle; player.speed = Math.abs(c.speed);
    for (const p of peds) if (p.down <= 0 && Math.hypot(p.x-c.x, p.z-c.z) < 2.6 && Math.abs(c.speed) > 3) { p.down = 300; setWanted(player.wanted+1); beep(180, 150); }
    for (const pc of police) if (Math.hypot(pc.x-c.x, pc.z-c.z) < 4 && Math.abs(c.speed) > 4) { setWanted(player.wanted+1); c.speed *= 0.4; player.hp -= 5; beep(100, 200); }
  } else {
    const sp = 6.0;
    if (gas !== 0) { player.angle += steer*0.05; const nx = player.x + Math.cos(player.angle)*sp*0.016*gas, nz = player.z + Math.sin(player.angle)*sp*0.016*gas; collide(player, nx, nz, 0.9); player.speed = sp*Math.abs(gas); } else player.speed = 0;
    for (const ca of cash) if (!ca.taken && Math.hypot(ca.x-player.x, ca.z-player.z) < 2.2) { ca.taken = true; if (ca.mesh) ca.mesh.visible = false; player.money += ca.v; missionCash++; beep(880, 100); save(); if (cash.filter(c => !c.taken).length < 5) { const nc = { x: vRoads[Math.floor(Math.random()*vRoads.length)]+11, z: 20+Math.random()*220, v: 100, taken: false }; cash.push(nc); if (scene) makeCashMesh(nc); } }
  }
  for (const c of cars) { if (c === player.car || !c.traffic) continue; c.speed = 7; const nx = c.x + Math.cos(c.angle)*c.speed*0.016, nz = c.z + Math.sin(c.angle)*c.speed*0.016; if (nx < 5 || nx > WORLD_W-5 || nz < 5 || nz > WORLD_H-5) c.angle += Math.PI; else if (!onRoad(nx, nz) && onRoad(c.x, c.z)) c.angle += Math.PI/2; else { c.x = nx; c.z = nz; } }
  for (const p of peds) { if (p.down > 0) { p.down--; if (p.down === 0) { p.x = vRoads[Math.floor(Math.random()*vRoads.length)]; p.z = 20+Math.random()*220; } continue; } const dx = p.tx-p.x, dz = p.tz-p.z, d = Math.hypot(dx, dz) || 1; if (d < 3) { p.tx = p.x+(Math.random()-.5)*60; p.tz = p.z+(Math.random()-.5)*60; } else { let s = p.speed; const pd = player.car ? player.car : player; if (Math.hypot(p.x-pd.x, p.z-pd.z) < 12 && player.car && Math.abs(player.car.speed) > 4) { s = 6; p.tx = p.x+(p.x-pd.x)*2; p.tz = p.z+(p.z-pd.z)*2; } p.angle = Math.atan2(dz, dx); p.x += dx/d*s*0.016; p.z += dz/d*s*0.016; } }
  for (const pc of police) { const dx = player.x-pc.x, dz = player.z-pc.z, d = Math.hypot(dx, dz) || 1; const want = Math.atan2(dz, dx); let diff = want-pc.angle; while (diff > Math.PI) diff -= 2*Math.PI; while (diff < -Math.PI) diff += 2*Math.PI; pc.angle += Math.max(-0.05, Math.min(0.05, diff)); pc.speed = 20; if (d > 4) { pc.x += Math.cos(pc.angle)*pc.speed*0.016; pc.z += Math.sin(pc.angle)*pc.speed*0.016; } else if (!player.car) { hideTimer++; if (hideTimer > 180) { player.money = Math.max(0, player.money-300); setWanted(0); hideTimer = 0; setTimeout(respawn, 1500); } } else player.hp -= 0.05; }
  if (player.wanted > 0) { crimeTimer++; if (crimeTimer > 1500) { setWanted(player.wanted-1); crimeTimer = 0; } }
  const m = missions()[missionIdx];
  if (m) { if (m.needCash) { if (missionCash >= m.needCash) completeMission(); } else if (m.needSport) { if (missionState === 'deliver' && player.car && player.car.type === 'sport' && Math.hypot(player.x-m.point.x, player.z-m.point.z) < 12) completeMission(); } else if (m.point && Math.hypot(player.x-m.point.x, player.z-m.point.z) < 9) completeMission(); }
  if (frame % 30 === 0) updateHUD();
}
function respawn() { player.hp = 100; player.dead = false; player.car = null; player.x = 50; player.z = 90; player.angle = 0; setWanted(0); spawnCars(); updateHUD(); }
function updateHUD() { $('hp').textContent = Math.max(0, Math.round(player.hp)); $('money').textContent = player.money; $('stars').textContent = '★'.repeat(player.wanted) + '☆'.repeat(5-player.wanted); $('speed').textContent = Math.round(player.speed*6); $('missionText').textContent = missionText(); $('actBtn').textContent = player.car ? t('exit') : t('enter'); }
function drawMini() {
  const mc = $('mini').getContext('2d'); mc.clearRect(0, 0, 130, 96); mc.fillStyle = '#3d7a3f'; mc.fillRect(0, 0, 130, 96);
  const sx = 130/WORLD_W, sy = 96/WORLD_H; mc.fillStyle = '#222'; for (const rx of vRoads) mc.fillRect(rx*sx-2, 0, 4, 96); for (const rz of hRoads) mc.fillRect(0, rz*sy, 130, 4);
  mc.fillStyle = '#666'; for (const b of buildings) mc.fillRect((b.x-b.w/2)*sx, (b.z-b.d/2)*sy, b.w*sx, b.d*sy);
  const m = missions()[missionIdx]; if (m && m.point) { mc.fillStyle = '#ffd23f'; mc.beginPath(); mc.arc(m.point.x*sx, m.point.z*sy, 4, 0, 7); mc.fill(); }
  for (const pc of police) { mc.fillStyle = '#448aff'; mc.beginPath(); mc.arc(pc.x*sx, pc.z*sy, 3, 0, 7); mc.fill(); }
  mc.fillStyle = '#fff'; mc.beginPath(); mc.arc(player.x*sx, player.z*sy, 4, 0, 7); mc.fill();
}
let camPos = new THREE.Vector3(28, 12, 90);
function syncThree() {
  const fx = Math.cos(player.angle), fz = Math.sin(player.angle);
  const dist = (player.car ? 26 : 22) * camScale(), height = (player.car ? 14 : 12) * camScale();
  const tx = player.x - fx*dist, tz = player.z - fz*dist;
  const want = new THREE.Vector3(tx, height, tz); camPos.lerp(want, 0.08);
  camera.position.copy(camPos); camera.lookAt(player.x + fx*6, 2.5, player.z + fz*6);
  sun.position.set(player.x + 60, 90, player.z + 40); sun.target.position.set(player.x, 0, player.z); sun.target.updateMatrixWorld();
  if (playerMesh) { playerMesh.position.set(player.x, 0, player.z); playerMesh.rotation.y = -player.angle; playerMesh.visible = !player.car && !player.dead; if (playerMesh.userData.legs && player.speed > 0.5) { const s = Math.sin(frame*0.35); playerMesh.userData.legs[0].rotation.z = s*0.7; playerMesh.userData.legs[1].rotation.z = -s*0.7; playerMesh.userData.arms[0].rotation.z = -s*0.5; playerMesh.userData.arms[1].rotation.z = s*0.5; } else if (playerMesh.userData.legs) { for (const l of playerMesh.userData.legs) l.rotation.z = 0; for (const a of playerMesh.userData.arms) a.rotation.z = 0; } }
  for (const c of [...cars, ...police]) if (c.mesh) { c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = -c.angle; if (c.mesh.userData.bar) { const fl = Math.floor(frame/8) % 2 === 0; c.mesh.userData.bar.material.color.set(fl ? 0xff1744 : 0x2979ff); c.mesh.userData.bar.material.emissive.set(fl ? 0xff1744 : 0x2979ff); } }
  for (const p of peds) if (p.mesh) { p.mesh.position.set(p.x, 0, p.z); p.mesh.rotation.y = -p.angle; p.mesh.rotation.z = p.down > 0 ? Math.PI/2 : 0; p.mesh.position.y = p.down > 0 ? 0.4 : 0; if (p.mesh.userData.legs && p.down <= 0) { const s = Math.sin(frame*0.3 + p.x); p.mesh.userData.legs[0].rotation.z = s*0.6; p.mesh.userData.legs[1].rotation.z = -s*0.6; } }
  for (const ca of cash) if (ca.mesh && !ca.taken) { ca.mesh.rotation.y += 0.05; ca.mesh.position.y = 1.0 + Math.sin(frame*0.08)*0.15; }
  const m = missions()[missionIdx];
  if (beaconMesh) { if (m && m.point) { beaconMesh.visible = true; beaconMesh.position.set(m.point.x, 0, m.point.z); beaconMesh.userData.dia.rotation.y += 0.04; } else beaconMesh.visible = false; }
  for (const cl of clouds) { cl.position.x += 0.03; if (cl.position.x > WORLD_W + 40) cl.position.x = -40; }
  drawMini();
}
applySettings();
function loop() {
  if (!running) return; if (!paused && !player.dead) update();
  if (threeMode && renderer) { syncThree(); renderer.render(scene, camera); }
  else if (useIso) { if (isoCtx) drawIso(isoCtx, { player, cars, police, peds, cash, missions: missions(), missionIdx, frame }); drawMini(); }
  updateHUD(); requestAnimationFrame(loop);
}
updateHUD();
