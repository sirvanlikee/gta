// City data — Los Santos grid, shared by game and renderer.
export const WORLD_W = 360, WORLD_H = 260;
export const vRoads = [50, 130, 210, 290], hRoads = [45, 120, 195], RW = 17;
export function onRoad(x, z) { for (const rx of vRoads) if (Math.abs(x - rx) < RW/2) return true; for (const rz of hRoads) if (Math.abs(z - rz) < RW/2) return true; return false; }
const bColors = [[0.82,0.55,0.35],[0.92,0.80,0.60],[0.72,0.42,0.28],[0.55,0.60,0.65],[0.85,0.70,0.45],[0.60,0.45,0.35],[0.95,0.85,0.65],[0.48,0.55,0.48]];
export const buildings = [];
let bi = 0;
for (let xi = 0; xi < vRoads.length - 1; xi++) for (let yi = 0; yi < hRoads.length - 1; yi++) {
  if ((xi + yi) % 3 === 2) continue;
  const x0 = vRoads[xi] + RW/2 + 2, x1 = vRoads[xi+1] - RW/2 - 2, z0 = hRoads[yi] + RW/2 + 2, z1 = hRoads[yi+1] - RW/2 - 2;
  const bw = (x1 - x0)/2 - 4, bd = (z1 - z0)/2 - 4;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
    buildings.push({ x: x0 + (a+0.5)*(x1-x0)/2, z: z0 + (b+0.5)*(z1-z0)/2, w: bw, d: bd, h: 20 + ((bi*11) % 24), c: bColors[(bi++) % bColors.length] });
  }
}
export const parks = [];
for (let xi = 0; xi < vRoads.length - 1; xi++) for (let yi = 0; yi < hRoads.length - 1; yi++) if ((xi + yi) % 3 === 2) parks.push({ x: (vRoads[xi]+vRoads[xi+1])/2, z: (hRoads[yi]+hRoads[yi+1])/2, w: vRoads[xi+1]-vRoads[xi]-RW-4, d: hRoads[yi+1]-hRoads[yi]-RW-4 });
export const trees = [];
for (const p of parks) for (let i = 0; i < 8; i++) trees.push({ x: p.x - p.w/2 + 5 + Math.random()*(p.w-10), z: p.z - p.d/2 + 5 + Math.random()*(p.d-10) });
export const palms = [];
for (const rx of vRoads) for (let z = 20; z < WORLD_H; z += 42) palms.push({ x: rx+11, z });
for (const rz of hRoads) for (let x = 20; x < WORLD_W; x += 52) palms.push({ x, z: rz+11 });
