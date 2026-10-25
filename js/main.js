import { initGL, resizeGL, matPersp, matLook, drawBox, setCam, shadeCol, hashRand, gl } from './engine.js';
import { WORLD_W, WORLD_H, vRoads, hRoads, buildings, parks, trees, palms, onRoad } from './world.js';
import { t, setLang } from './i18n.js';
import { drawIso } from './iso.js';
let useIso = false, isoCtx = null;

const cv = document.getElementById('gl');
const $ = id => document.getElementById(id);
let saved = {}; try { saved = JSON.parse(localStorage.getItem('shahrAzad3d') || '{}'); } catch (e) {}
const player = { x: 50, z: 90, angle: 0, speed: 0, hp: 100, money: saved.money || 0, car: null, wanted: 0, dead: false };
let cars = [], peds = [], cash = [], police = [], frame = 0, running = false, paused = false, soundOn = true, crimeTimer = 0, hideTimer = 0, missionIdx = saved.missionIdx || 0, missionCash = 0, missionState = 'go', msgTimer = 0;
let camX = 50, camY = 10, camZ = 75;
function showMsg(txt, ms) { const m = $('msg'); m.textContent = txt; m.style.display = 'block'; clearTimeout(msgTimer); msgTimer = setTimeout(() => m.style.display = 'none', ms || 2600); }
function save() { try { localStorage.setItem('shahrAzad3d', JSON.stringify({ money: player.money, missionIdx })); } catch (e) {} }
function makeCar(x, z, angle, color, type, traffic, policeCar) { const max = { sedan: 16, taxi: 16, sport: 21, police: 19 }[type] || 16; return { x, z, angle, speed: 0, color, type, traffic: !!traffic, police: !!policeCar, max }; }
function spawnCars() {
  cars = []; const cols = [[0.85,0.20,0.20],[0.95,0.85,0.15],[0.95,0.95,0.95],[0.25,0.28,0.32],[1,0.44,0.26],[0.15,0.65,0.60],[0.67,0.28,0.74]];
  for (let i = 0; i < 12; i++) { const rx = vRoads[i % vRoads.length]; cars.push(makeCar(rx+5, 30+(i*19)%200, Math.PI/2, cols[i%cols.length], i===3 ? 'sport' : 'sedan', false, false)); }
  cars.push(makeCar(125, 90, 0, [0.85,0.20,0.20], 'sport', false, false));
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) { const rx = vRoads[i % vRoads.length]; cars.push(makeCar(rx+(i%4<2?-3:3), 20+Math.random()*220, i%4<2 ? Math.PI/2 : -Math.PI/2, cols[(i+2)%cols.length], 'sedan', true, false)); }
    else { const rz = hRoads[i % hRoads.length]; cars.push(makeCar(20+Math.random()*320, rz+(i%4<2?-3:3), i%4<2 ? 0 : Math.PI, cols[(i+3)%cols.length], 'taxi', true, false)); }
  }
}
function spawnPeds() { const pc = [[0.85,0.2,0.2],[0.08,0.4,0.75],[0.48,0.12,0.65],[0,0.54,0.48],[0.96,0.49,0],[0.22,0.28,0.31]]; peds = []; for (let i = 0; i < 22; i++) { const rx = vRoads[i % vRoads.length]; peds.push({ x: rx+(Math.random()<.5?-11:11), z: 20+Math.random()*220, tx: rx, tz: 20+Math.random()*220, speed: 1.6, down: 0, c: pc[i%pc.length], angle: 0 }); } }
function spawnCash() { cash = []; for (let i = 0; i < 10; i++) { const rx = vRoads[i % vRoads.length]; cash.push({ x: rx+(Math.random()<.5?-11:11), z: 20+Math.random()*220, v: 50+Math.floor(Math.random()*4)*50, taken: false }); } }
function missions() { return [
  { title: t('m1'), point: { x: 130, z: 120 }, reward: 500 },
  { title: t('m2'), point: { x: 290, z: 195 }, reward: 1200, needSport: true },
  { title: t('m3'), point: null, reward: 1000, needCash: 5 },
]; }
function missionText() { const m = missions()[missionIdx]; if (!m) return t('done'); return m.title + ' — ' + t('reward') + ': ' + m.reward; }
function completeMission() { const m = missions()[missionIdx]; player.money += m.reward; missionIdx++; missionCash = 0; missionState = 'go'; showMsg('✅ ' + m.reward, 3000); beep(660, 120); setTimeout(() => beep(880, 180), 140); save(); }
function setWanted(n) { player.wanted = Math.max(0, Math.min(5, n)); syncPolice(); }
function syncPolice() { const need = Math.min(player.wanted, 4); while (police.length < need) police.push(makeCar(player.x+(Math.random()<.5?-35:35), player.z+(Math.random()<.5?-25:25), 0, [0.08,0.35,0.75], 'police', false, true)); while (police.length > need) police.pop(); }
let AC = null; function beep(f, d) { if (!soundOn) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = f; o.connect(g); g.connect(AC.destination); g.gain.setValueAtTime(.1, AC.currentTime); g.gain.exponentialRampToValueAtTime(.001, AC.currentTime + d/1000); o.start(); o.stop(AC.currentTime + d/1000); } catch (e) {} }
// input
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
$('startBtn').addEventListener('click', async () => {
  let ok = false; try { ok = await initGL(cv); } catch (e) { ok = false; }
  if (ok) resizeGL(cv);
  $('menu').style.display = 'none'; if (innerWidth < 800) { jb.style.display = 'block'; $('actions').style.display = 'flex'; }
  spawnCars(); spawnPeds(); spawnCash(); syncPolice();
  // WebGL test: on some phones WebGL creates a context but draws nothing (blank sky/ground colour).
  // Draw one frame and read the centre pixel: if it is still the clear colour or empty, switch to the isometric 2D renderer, which works everywhere.
  if (ok) {
    try {
      draw();
      const pix = new Uint8Array(4);
      gl.readPixels(Math.floor(cv.width/2), Math.floor(cv.height/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pix);
      const isClear = pix[0] > 230 && pix[1] > 140 && pix[1] < 180 && pix[2] > 80 && pix[2] < 120;
      const isZero = pix[0] === 0 && pix[1] === 0 && pix[2] === 0 && pix[3] === 0;
      if (isClear || isZero) useIso = true;
    } catch (e) { useIso = true; }
  } else useIso = true;
  if (useIso) {
    cv.style.display = 'none';
    const ic = $('iso'); ic.style.display = 'block'; ic.width = innerWidth; ic.height = innerHeight; isoCtx = ic.getContext('2d');
  }
  running = true; requestAnimationFrame(loop);
});
$('pauseBtn').addEventListener('click', () => { if (!running) return; paused = !paused; $('pauseBtn').textContent = paused ? '▶' : t('pause'); });
$('soundBtn').addEventListener('click', () => { soundOn = !soundOn; $('soundBtn').textContent = soundOn ? t('sound') : '🔇'; });
addEventListener('resize', () => { if (useIso && isoCtx) { isoCtx.canvas.width = innerWidth; isoCtx.canvas.height = innerHeight; } else resizeGL(cv); });
function nearestCar(x, z) { let best = null, bd = 1e9; for (const c of cars) { const d = Math.hypot(c.x-x, c.z-z); if (d < bd) { bd = d; best = c; } } return { car: best, d: bd }; }
function toggleCar() {
  if (!running || paused) return;
  if (player.car) { const c = player.car; player.car = null; c.speed = 0; player.x = c.x+4; player.z = c.z; player.angle = c.angle; $('actBtn').textContent = t('enter'); beep(300, 80); return; }
  const { car, d } = nearestCar(player.x, player.z);
  if (car && d < 6) {
    if (car.traffic) { setWanted(player.wanted+1); } else if (car.police) setWanted(player.wanted+2); else setWanted(Math.max(player.wanted, 1));
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
    const c = player.car; c.speed += gas*0.9; if (gas === 0) c.speed *= 0.985; else c.speed *= 0.995; if (c.speed > c.max) c.speed = c.max; if (c.speed < -7) c.speed = -7;
    if (Math.abs(c.speed) > 0.5) c.angle += steer*0.045*(c.speed > 0 ? 1 : -1)*Math.min(1, Math.abs(c.speed)/8);
    const nx = c.x + Math.cos(c.angle)*c.speed*0.016, nz = c.z + Math.sin(c.angle)*c.speed*0.016; const bx = c.x, bz = c.z; collide(c, nx, nz, 1.9);
    if (Math.hypot(c.x-bx, c.z-bz) < Math.abs(c.speed)*0.08 && Math.abs(c.speed) > 6) { c.speed *= -0.3; player.hp -= 2; beep(120, 120); }
    player.x = c.x; player.z = c.z; player.angle = c.angle; player.speed = Math.abs(c.speed);
    for (const p of peds) if (p.down <= 0 && Math.hypot(p.x-c.x, p.z-c.z) < 2.6 && Math.abs(c.speed) > 3) { p.down = 300; setWanted(player.wanted+1); beep(180, 150); }
    for (const pc of police) if (Math.hypot(pc.x-c.x, pc.z-c.z) < 4 && Math.abs(c.speed) > 4) { setWanted(player.wanted+1); c.speed *= 0.4; player.hp -= 5; beep(100, 200); }
  } else {
    const sp = 3.2;
    if (gas !== 0) { player.angle += steer*0.05; const nx = player.x + Math.cos(player.angle)*sp*0.016*gas, nz = player.z + Math.sin(player.angle)*sp*0.016*gas; collide(player, nx, nz, 0.9); player.speed = sp*Math.abs(gas); } else player.speed = 0;
    for (const ca of cash) if (!ca.taken && Math.hypot(ca.x-player.x, ca.z-player.z) < 2.2) { ca.taken = true; player.money += ca.v; missionCash++; beep(880, 100); save(); if (cash.filter(c => !c.taken).length < 5) cash.push({ x: vRoads[Math.floor(Math.random()*vRoads.length)]+11, z: 20+Math.random()*220, v: 100, taken: false }); }
  }
  for (const c of cars) { if (c === player.car || !c.traffic) continue; c.speed = 7; const nx = c.x + Math.cos(c.angle)*c.speed*0.016, nz = c.z + Math.sin(c.angle)*c.speed*0.016; if (nx < 5 || nx > WORLD_W-5 || nz < 5 || nz > WORLD_H-5) c.angle += Math.PI; else if (!onRoad(nx, nz) && onRoad(c.x, c.z)) c.angle += Math.PI/2; else { c.x = nx; c.z = nz; } }
  for (const p of peds) { if (p.down > 0) { p.down--; if (p.down === 0) { p.x = vRoads[Math.floor(Math.random()*vRoads.length)]; p.z = 20+Math.random()*220; } continue; } const dx = p.tx-p.x, dz = p.tz-p.z, d = Math.hypot(dx, dz) || 1; if (d < 3) { p.tx = p.x+(Math.random()-.5)*60; p.tz = p.z+(Math.random()-.5)*60; } else { let s = p.speed; const pd = player.car ? player.car : player; if (Math.hypot(p.x-pd.x, p.z-pd.z) < 12 && player.car && Math.abs(player.car.speed) > 4) { s = 6; p.tx = p.x+(p.x-pd.x)*2; p.tz = p.z+(p.z-pd.z)*2; } p.angle = Math.atan2(dz, dx); p.x += dx/d*s*0.016; p.z += dz/d*s*0.016; } }
  for (const pc of police) { const dx = player.x-pc.x, dz = player.z-pc.z, d = Math.hypot(dx, dz) || 1; const want = Math.atan2(dz, dx); let diff = want-pc.angle; while (diff > Math.PI) diff -= 2*Math.PI; while (diff < -Math.PI) diff += 2*Math.PI; pc.angle += Math.max(-0.05, Math.min(0.05, diff)); pc.speed = 14; if (d > 4) { pc.x += Math.cos(pc.angle)*pc.speed*0.016; pc.z += Math.sin(pc.angle)*pc.speed*0.016; } else if (!player.car) { hideTimer++; if (hideTimer > 70) { player.money = Math.max(0, player.money-300); setWanted(0); hideTimer = 0; setTimeout(respawn, 1500); } } else player.hp -= 0.12; }
  if (player.wanted > 0) { crimeTimer++; if (crimeTimer > 1500) { setWanted(player.wanted-1); crimeTimer = 0; } }
  const m = missions()[missionIdx];
  if (m) { if (m.needCash) { if (missionCash >= m.needCash) completeMission(); } else if (m.needSport) { if (missionState === 'deliver' && player.car && player.car.type === 'sport' && Math.hypot(player.x-m.point.x, player.z-m.point.z) < 12) completeMission(); } else if (m.point && Math.hypot(player.x-m.point.x, player.z-m.point.z) < 9) completeMission(); }
  if (frame % 30 === 0) updateHUD();
}
function respawn() { player.hp = 100; player.dead = false; player.car = null; player.x = 50; player.z = 90; player.angle = 0; setWanted(0); spawnCars(); updateHUD(); }
function updateHUD() { $('hp').textContent = Math.max(0, Math.round(player.hp)); $('money').textContent = player.money; $('mDone').textContent = Math.min(missionIdx, 3); $('stars').textContent = '★'.repeat(player.wanted) + '☆'.repeat(5-player.wanted); $('speed').textContent = Math.round(player.speed*6); $('missionText').textContent = missionText(); $('actBtn').textContent = player.car ? t('exit') : t('enter'); }
function drawCar3D(c, proj, view) {
  const a = c.angle, fx = Math.cos(a), fz = Math.sin(a), len = c.type === 'sport' ? 5.2 : 4.4, wid = 2.0;
  drawBox(c.x, 0.06, c.z, len, 0.1, wid+0.3, [0,0,0], a, proj, view);
  drawBox(c.x, 0.55, c.z, len, 0.7, wid, c.color, a, proj, view);
  drawBox(c.x-fx*0.3, 1.15, c.z-fz*0.3, 2.2, 0.65, 1.7, shadeCol(c.color, -0.12), a, proj, view);
  drawBox(c.x+fx*1.1, 0.95, c.z+fz*1.1, 0.7, 0.5, 1.6, [0.65,0.85,0.95], a, proj, view);
  drawBox(c.x-fx*1.4, 0.95, c.z-fz*1.4, 0.6, 0.5, 1.6, [0.15,0.25,0.38], a, proj, view);
  drawBox(c.x+fx*1.6, 0.35, c.z+fz*1.6, 0.5, 0.5, wid, [0.08,0.08,0.08], a, proj, view);
  drawBox(c.x-fx*1.6, 0.35, c.z-fz*1.6, 0.5, 0.5, wid, [0.08,0.08,0.08], a, proj, view);
  drawBox(c.x+fx*2.2, 0.6, c.z+fz*2.2, 0.15, 0.3, 1.7, [1,0.95,0.75], a, proj, view);
  drawBox(c.x-fx*2.2, 0.6, c.z-fz*2.2, 0.15, 0.3, 1.7, [1,0.1,0.1], a, proj, view);
  if (c.type === 'sport') drawBox(c.x-fx*2.4, 1.0, c.z-fz*2.4, 0.3, 0.15, 2.1, [0.1,0.1,0.1], a, proj, view);
  if (c.type === 'taxi') drawBox(c.x, 1.6, c.z, 0.9, 0.25, 0.9, [1,0.85,0], a, proj, view);
  if (c.police) { const fl = Math.floor(frame/8) % 2 === 0; drawBox(c.x, 1.55, c.z, 0.9, 0.22, 0.9, fl ? [1,0.1,0.1] : [0.15,0.45,1], a, proj, view); }
}
function drawPerson3D(x, z, a, c, walking, proj, view) {
  const fx = Math.cos(a), fz = Math.sin(a);
  drawBox(x, 0.06, z, 1.1, 0.1, 1.1, [0,0,0], a, proj, view);
  drawBox(x-fx*0.4, 0.35, z-fz*0.4, 0.6, 0.7, 0.35, [0.13,0.13,0.15], a, proj, view);
  drawBox(x, 0.95, z, 0.9, 1.0, 0.55, c, a, proj, view);
  drawBox(x+fx*0.2, 1.65, z+fz*0.2, 0.55, 0.55, 0.55, [1,0.8,0.62], a, proj, view);
  drawBox(x+fx*0.2, 1.95, z+fz*0.2, 0.5, 0.2, 0.5, [0.15,0.18,0.2], a, proj, view);
}
function draw() {
  const dist = player.car ? 16 : 12, height = player.car ? 9 : 7;
  const fx = Math.cos(player.angle), fz = Math.sin(player.angle);
  let tx = player.x-fx*dist, tz = player.z-fz*dist, ty = height;
  for (const b of buildings) if (tx > b.x-b.w/2-1 && tx < b.x+b.w/2+1 && tz > b.z-b.d/2-1 && tz < b.z+b.d/2+1) ty = Math.max(ty, b.h+3);
  camX += (tx-camX)*0.12; camY += (ty-camY)*0.12; camZ += (tz-camZ)*0.12;
  const proj = matPersp(1.05, cv.width/cv.height, 0.5, 400);
  const view = matLook([camX, camY, camZ], [player.x, 1.2, player.z], [0,1,0]);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); setCam(camX, camY, camZ);
  drawBox(WORLD_W/2, -0.5, WORLD_H/2, WORLD_W, 1, WORLD_H, [0.62,0.60,0.52], 0, proj, view);
  for (const p of parks) drawBox(p.x, 0.02, p.z, p.w, 0.15, p.d, [0.20,0.55,0.25], 0, proj, view);
  for (const rx of vRoads) drawBox(rx, 0.08, WORLD_H/2, 17, 0.15, WORLD_H, [0.16,0.17,0.19], 0, proj, view);
  for (const rz of hRoads) drawBox(WORLD_W/2, 0.08, rz, WORLD_W, 0.15, 17, [0.16,0.17,0.19], 0, proj, view);
  for (const rx of vRoads) for (let z = 5; z < WORLD_H; z += 12) drawBox(rx, 0.17, z, 0.5, 0.05, 5, [0.96,0.84,0.25], 0, proj, view);
  for (const rz of hRoads) for (let x = 5; x < WORLD_W; x += 12) drawBox(x, 0.17, rz, 5, 0.05, 0.5, [0.96,0.84,0.25], 0, proj, view);
  for (const b of buildings) {
    drawBox(b.x, b.h/2, b.z, b.w, b.h, b.d, b.c, 0, proj, view);
    drawBox(b.x, b.h+0.2, b.z, b.w+0.4, 0.4, b.d+0.4, shadeCol(b.c, -0.15), 0, proj, view);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const r = hashRand(b.x+i*31, b.z+j*29); drawBox(b.x-b.w/2+(i+0.5)*(b.w/3), 2+j*(b.h/3), b.z+b.d/2+0.1, b.w/5, b.h/5, 0.15, r > .7 ? [1,0.88,0.5] : [0.12,0.20,0.30], 0, proj, view); }
  }
  for (const tt of trees) { drawBox(tt.x, 0.8, tt.z, 0.5, 1.6, 0.5, [0.36,0.25,0.15], 0, proj, view); drawBox(tt.x, 2.2, tt.z, 2.2, 2.0, 2.2, [0.12,0.45,0.18], 0, proj, view); drawBox(tt.x, 3.2, tt.z, 1.4, 1.0, 1.4, [0.25,0.65,0.28], 0, proj, view); }
  for (const p of palms) { drawBox(p.x, 3, p.z, 0.45, 6, 0.45, [0.45,0.32,0.20], 0, proj, view); drawBox(p.x, 6.2, p.z, 3.2, 0.25, 0.7, [0.15,0.55,0.25], 0, proj, view); drawBox(p.x, 6.2, p.z, 0.7, 0.25, 3.2, [0.15,0.55,0.25], 0.7, proj, view); }
  for (const rx of vRoads) for (const rz of hRoads) { drawBox(rx+9, 2.5, rz+9, 0.3, 5, 0.3, [0.2,0.2,0.2], 0, proj, view); drawBox(rx+9, 5.1, rz+9, 1.1, 0.3, 0.6, [1,0.85,0.3], 0, proj, view); }
  for (let i = 0; i < 5; i++) { const cx = ((i*73 + frame*0.12) % WORLD_W); drawBox(cx, 42, 45+i*42, 22, 1.2, 9, [1,1,1], 0, proj, view); }
  drawBox(WORLD_W/2, 0.06, 248, WORLD_W, 0.12, 14, [0.90,0.80,0.60], 0, proj, view);
  drawBox(WORLD_W/2, 0.04, 257, WORLD_W, 0.12, 6, [0.15,0.45,0.75], 0, proj, view);
  for (const ca of cash) if (!ca.taken) { drawBox(ca.x, 0.9, ca.z, 1.2, 1.2, 1.2, [1,0.80,0.1], frame/30, proj, view); }
  const m = missions()[missionIdx];
  if (m && m.point) { drawBox(m.point.x, 6, m.point.z, 1.2, 12, 1.2, [1,0.85,0.15], 0, proj, view); drawBox(m.point.x, 13, m.point.z, 2.2, 2.2, 2.2, [1,0.85,0.15], frame/20, proj, view); }
  for (const p of peds) { if (p.down > 0) drawBox(p.x, 0.3, p.z, 1.4, 0.6, 0.7, [0.35,0.35,0.35], p.angle, proj, view); else drawPerson3D(p.x, p.z, p.angle, p.c, true, proj, view); }
  for (const c of cars) drawCar3D(c, proj, view);
  for (const pc of police) drawCar3D(pc, proj, view);
  if (!player.car && !player.dead) drawPerson3D(player.x, player.z, player.angle, [0.95,0.95,0.95], player.speed > 0.5, proj, view);
  drawMini();
}
function drawMini() {
  const mc = $('mini').getContext('2d'); mc.clearRect(0, 0, 130, 96); mc.fillStyle = '#3d7a3f'; mc.fillRect(0, 0, 130, 96);
  const sx = 130/WORLD_W, sy = 96/WORLD_H; mc.fillStyle = '#333'; for (const rx of vRoads) mc.fillRect(rx*sx-2, 0, 4, 96); for (const rz of hRoads) mc.fillRect(0, rz*sy, 130, 4);
  mc.fillStyle = '#666'; for (const b of buildings) mc.fillRect((b.x-b.w/2)*sx, (b.z-b.d/2)*sy, b.w*sx, b.d*sy);
  const m = missions()[missionIdx]; if (m && m.point) { mc.fillStyle = '#ffd23f'; mc.beginPath(); mc.arc(m.point.x*sx, m.point.z*sy, 4, 0, 7); mc.fill(); }
  for (const pc of police) { mc.fillStyle = '#448aff'; mc.beginPath(); mc.arc(pc.x*sx, pc.z*sy, 3, 0, 7); mc.fill(); }
  mc.fillStyle = '#fff'; mc.beginPath(); mc.arc(player.x*sx, player.z*sy, 4, 0, 7); mc.fill();
}
function loop() { if (!running) return; if (!paused && !player.dead) update(); if (useIso) { if (isoCtx) drawIso(isoCtx, { player, cars, police, peds, cash, missions: missions(), missionIdx, frame }); drawMini(); } else if (gl) draw(); updateHUD(); requestAnimationFrame(loop); }
updateHUD();
