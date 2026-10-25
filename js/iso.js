// Isometric 2D renderer — works on any phone, even when WebGL does not render.
// World (x,z) -> screen: sx = (x-z)*0.866*S, sy = (x+z)*0.5*S - height*S
import { WORLD_W, WORLD_H, vRoads, hRoads, buildings, parks, trees, palms } from './world.js';
const S = 2.2;
function iso(x, z, h) { return [(x - z) * 0.866 * S, (x + z) * 0.5 * S - (h || 0) * S]; }
function rgb(c) { return 'rgb(' + Math.round(c[0]*255) + ',' + Math.round(c[1]*255) + ',' + Math.round(c[2]*255) + ')'; }
function dark(c, p) { return [Math.max(0, c[0]-p), Math.max(0, c[1]-p), Math.max(0, c[2]-p)]; }
export function drawIso(ctx, st) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const p = st.player;
  const pc = iso(p.x, p.z, 0);
  const ox = W/2 - pc[0], oy = H/2 - pc[1];
  // sunset sky / ground
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f2a65a'); g.addColorStop(1, '#e8915a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // ground diamond
  ctx.fillStyle = '#9a8f7a'; ctx.beginPath();
  const corners = [iso(0,0,0), iso(WORLD_W,0,0), iso(WORLD_W,WORLD_H,0), iso(0,WORLD_H,0)].map(c => [c[0]+ox, c[1]+oy]);
  ctx.moveTo(corners[0][0], corners[0][1]); for (const c of corners.slice(1)) ctx.lineTo(c[0], c[1]); ctx.closePath(); ctx.fill();
  // parks
  for (const pk of parks) { const c = iso(pk.x, pk.z, 0); ctx.fillStyle = '#2e7d32'; ctx.fillRect(c[0]+ox-pk.w*S*0.6, c[1]+oy-pk.d*S*0.3, pk.w*S*1.2, pk.d*S*0.6); }
  // roads as thick iso lines
  ctx.lineCap = 'round';
  for (const rx of vRoads) { const a = iso(rx, 0, 0), b = iso(rx, WORLD_H, 0); ctx.strokeStyle = '#26292e'; ctx.lineWidth = 17*S*0.9; ctx.beginPath(); ctx.moveTo(a[0]+ox, a[1]+oy); ctx.lineTo(b[0]+ox, b[1]+oy); ctx.stroke(); ctx.strokeStyle = '#f5d76e'; ctx.lineWidth = 2; ctx.setLineDash([12,10]); ctx.beginPath(); ctx.moveTo(a[0]+ox, a[1]+oy); ctx.lineTo(b[0]+ox, b[1]+oy); ctx.stroke(); ctx.setLineDash([]); }
  for (const rz of hRoads) { const a = iso(0, rz, 0), b = iso(WORLD_W, rz, 0); ctx.strokeStyle = '#26292e'; ctx.lineWidth = 17*S*0.9; ctx.beginPath(); ctx.moveTo(a[0]+ox, a[1]+oy); ctx.lineTo(b[0]+ox, b[1]+oy); ctx.stroke(); ctx.strokeStyle = '#f5d76e'; ctx.lineWidth = 2; ctx.setLineDash([12,10]); ctx.beginPath(); ctx.moveTo(a[0]+ox, a[1]+oy); ctx.lineTo(b[0]+ox, b[1]+oy); ctx.stroke(); ctx.setLineDash([]); }
  // sort drawables by depth (x+z) so nearer objects draw last
  const items = [];
  for (const b of buildings) items.push({ d: b.x+b.z, kind: 'b', o: b });
  for (const t of trees) items.push({ d: t.x+t.z, kind: 't', o: t });
  for (const pl of palms) items.push({ d: pl.x+pl.z, kind: 'pl', o: pl });
  for (const ca of st.cash) if (!ca.taken) items.push({ d: ca.x+ca.z, kind: 'cash', o: ca });
  for (const pd of st.peds) items.push({ d: pd.x+pd.z, kind: 'ped', o: pd });
  for (const c of st.cars) items.push({ d: c.x+c.z, kind: 'car', o: c });
  for (const c of st.police) items.push({ d: c.x+c.z, kind: 'car', o: c });
  if (!p.car && !p.dead) items.push({ d: p.x+p.z, kind: 'player', o: p });
  items.sort((a, b) => a.d - b.d);
  for (const it of items) {
    const o = it.o, c = iso(o.x, o.z, 0), sx = c[0]+ox, sy = c[1]+oy;
    if (sx < -120 || sx > W+120 || sy < -200 || sy > H+120) continue;
    if (it.kind === 'b') {
      const h = o.h * S * 0.55, w = o.w * S * 0.7, d = o.d * S * 0.35;
      // top diamond
      ctx.fillStyle = rgb(o.c); ctx.beginPath(); ctx.moveTo(sx, sy-h); ctx.lineTo(sx+w*0.5, sy-h+d*0.5); ctx.lineTo(sx, sy-h+d); ctx.lineTo(sx-w*0.5, sy-h+d*0.5); ctx.closePath(); ctx.fill();
      // left face
      ctx.fillStyle = rgb(dark(o.c, 0.15)); ctx.beginPath(); ctx.moveTo(sx-w*0.5, sy-h+d*0.5); ctx.lineTo(sx, sy-h+d); ctx.lineTo(sx, sy+d); ctx.lineTo(sx-w*0.5, sy+d*0.5); ctx.closePath(); ctx.fill();
      // right face
      ctx.fillStyle = rgb(dark(o.c, 0.28)); ctx.beginPath(); ctx.moveTo(sx, sy-h+d); ctx.lineTo(sx+w*0.5, sy-h+d*0.5); ctx.lineTo(sx+w*0.5, sy+d*0.5); ctx.lineTo(sx, sy+d); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 3; i++) ctx.fillRect(sx-14+i*10, sy-h+8+i*6, 6, 6);
    } else if (it.kind === 't') {
      ctx.fillStyle = '#5d4037'; ctx.fillRect(sx-2, sy-18, 4, 18); ctx.fillStyle = '#2e7d32'; ctx.beginPath(); ctx.arc(sx, sy-24, 14, 0, 7); ctx.fill(); ctx.fillStyle = '#66bb6a'; ctx.beginPath(); ctx.arc(sx-4, sy-28, 7, 0, 7); ctx.fill();
    } else if (it.kind === 'pl') {
      ctx.fillStyle = '#5d4037'; ctx.fillRect(sx-1, sy-28, 3, 28); ctx.fillStyle = '#2e7d32'; ctx.beginPath(); ctx.arc(sx, sy-32, 10, 0, 7); ctx.fill();
    } else if (it.kind === 'cash') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(sx+2, sy+3, 10, 5, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.arc(sx, sy-6, 11, 0, 7); ctx.fill(); ctx.strokeStyle = '#7a4d00'; ctx.stroke(); ctx.fillStyle = '#5d4037'; ctx.font = 'bold 12px Tahoma'; ctx.textAlign = 'center'; ctx.fillText('$', sx, sy-2);
    } else if (it.kind === 'ped') {
      if (o.down > 0) { ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(sx, sy-4, 9, 0, 7); ctx.fill(); continue; }
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(sx+2, sy+2, 10, 5, 0, 0, 7); ctx.fill(); ctx.fillStyle = rgb(o.c); ctx.beginPath(); ctx.arc(sx, sy-10, 11, 0, 7); ctx.fill(); ctx.fillStyle = '#ffcc9e'; ctx.beginPath(); ctx.arc(sx, sy-10, 5, 0, 7); ctx.fill();
    } else if (it.kind === 'car') {
      const sa = Math.atan2((Math.sin(o.angle)+Math.cos(o.angle))*0.5, (Math.cos(o.angle)-Math.sin(o.angle))*0.866);
      ctx.save(); ctx.translate(sx, sy-8); ctx.rotate(sa);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(2, 3, 26, 12, 0, 0, 7); ctx.fill();
      ctx.fillStyle = rgb(o.color); ctx.beginPath(); ctx.roundRect(-26, -11, 52, 22, 6); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke();
      ctx.fillStyle = 'rgba(180,220,255,0.9)'; ctx.fillRect(8, -8, 10, 16); ctx.fillStyle = '#222'; ctx.fillRect(-16, -8, 8, 16);
      ctx.fillStyle = '#fffde7'; ctx.fillRect(25, -8, 3, 5); ctx.fillRect(25, 3, 3, 5); ctx.fillStyle = '#ff1744'; ctx.fillRect(-28, -8, 3, 5); ctx.fillRect(-28, 3, 3, 5);
      if (o.police) { ctx.fillStyle = (Math.floor(st.frame/8)%2===0) ? '#ff1744' : '#2979ff'; ctx.fillRect(-4, -12, 8, 4); }
      ctx.restore();
    } else if (it.kind === 'player') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sx+2, sy+2, 12, 6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#ff5722'; ctx.beginPath(); ctx.arc(sx, sy-10, 13, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#ffcc9e'; ctx.beginPath(); ctx.arc(sx, sy-10, 6, 0, 7); ctx.fill();
    }
  }
  // mission beacon
  const m = st.missions[st.missionIdx];
  if (m && m.point) { const c = iso(m.point.x, m.point.z, 0); const bx = c[0]+ox, by = c[1]+oy; ctx.fillStyle = 'rgba(255,210,63,0.35)'; ctx.beginPath(); ctx.arc(bx, by-10, 22, 0, 7); ctx.fill(); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(bx, by-30, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.font = 'bold 14px Tahoma'; ctx.textAlign = 'center'; ctx.fillText('!', bx, by-26); }
  // beach strip at south
  const bc = iso(WORLD_W/2, 252, 0); ctx.fillStyle = '#0f6fb5'; ctx.fillRect(bc[0]+ox-200, bc[1]+oy-10, 400, 20);
}
