// WebGL engine — no libraries, no external files at runtime (shaders are fetched from ./shaders, with inline fallback).
export let gl = null;
let uModel, uColor, uMVP, uCamPos;
const VS_FALLBACK = `attribute vec3 aPos;attribute vec3 aNorm;uniform mat4 uMVP;uniform mat4 uModel;varying vec3 vN;varying vec3 vW;void main(){vec4 w=uModel*vec4(aPos,1.0);vW=w.xyz;vN=normalize(mat3(uModel)*aNorm);gl_Position=uMVP*w;}`;
const FS_FALLBACK = `precision mediump float;uniform vec3 uColor;uniform vec3 uCam;varying vec3 vN;varying vec3 vW;void main(){vec3 n=normalize(vN);vec3 l=normalize(vec3(0.5,1.0,0.35));float d=max(dot(n,l),0.0);vec3 col=uColor*(0.48+0.68*d);col+=vec3(0.04,0.02,0.0);float dist=distance(vW,uCam);float fog=clamp((dist-80.0)/100.0,0.0,0.80);col=mix(col,vec3(0.96,0.62,0.38),fog);gl_FragColor=vec4(col,1.0);}`;
async function loadText(url, fallback) { try { const r = await fetch(url); if (r.ok) return await r.text(); } catch (e) {} return fallback; }
export async function initGL(canvas) {
  gl = canvas.getContext('webgl', { antialias: true }) || canvas.getContext('experimental-webgl');
  if (!gl) return false;
  const vsSrc = await loadText('shaders/vertex.glsl', VS_FALLBACK);
  const fsSrc = await loadText('shaders/fragment.glsl', FS_FALLBACK);
  function shader(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
  gl.useProgram(prog);
  uModel = gl.getUniformLocation(prog, 'uModel'); uColor = gl.getUniformLocation(prog, 'uColor');
  uMVP = gl.getUniformLocation(prog, 'uMVP'); uCamPos = gl.getUniformLocation(prog, 'uCam');
  const faces = [
    { n: [-1,0,0], c: [[-.5,-.5,-.5],[-.5,.5,-.5],[-.5,.5,.5],[-.5,-.5,-.5],[-.5,.5,.5],[-.5,-.5,.5]] },
    { n: [1,0,0], c: [[.5,-.5,.5],[.5,.5,.5],[.5,.5,-.5],[.5,-.5,.5],[.5,.5,-.5],[.5,-.5,-.5]] },
    { n: [0,-1,0], c: [[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]] },
    { n: [0,1,0], c: [[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]] },
    { n: [0,0,-1], c: [[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5],[-.5,-.5,-.5],[.5,.5,-.5],[.5,-.5,-.5]] },
    { n: [0,0,1], c: [[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]] },
  ];
  const data = []; for (const f of faces) for (const v of f.c) data.push(v[0], v[1], v[2], f.n[0], f.n[1], f.n[2]);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos'), aNorm = gl.getAttribLocation(prog, 'aNorm');
  gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(aNorm); gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 24, 12);
  gl.enable(gl.DEPTH_TEST); gl.clearColor(0.96, 0.62, 0.38, 1);
  return true;
}
export function resizeGL(canvas) { const d = Math.min(devicePixelRatio || 1, 1.5); canvas.width = Math.floor(innerWidth * d); canvas.height = Math.floor(innerHeight * d); if (gl) gl.viewport(0, 0, canvas.width, canvas.height); }
export function matMul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k*4+r] * b[c*4+k]; o[c*4+r] = s; } return o; }
export function matPersp(fov, asp, near, far) { const f = 1 / Math.tan(fov / 2), o = new Float32Array(16); o[0] = f / asp; o[5] = f; o[10] = (far + near) / (near - far); o[11] = -1; o[14] = 2 * far * near / (near - far); return o; }
export function matLook(eye, cen, up) {
  let fx = cen[0]-eye[0], fy = cen[1]-eye[1], fz = cen[2]-eye[2]; const fl = Math.hypot(fx, fy, fz) || 1; fx/=fl; fy/=fl; fz/=fl;
  let rx = fy*up[2]-fz*up[1], ry = fz*up[0]-fx*up[2], rz = fx*up[1]-fy*up[0]; const rl = Math.hypot(rx, ry, rz) || 1; rx/=rl; ry/=rl; rz/=rl;
  const ux = ry*fz-rz*fy, uy = rz*fx-rx*fz, uz = rx*fy-ry*fx;
  const o = new Float32Array(16);
  // view matrix rows are right, up, -forward (do NOT transpose this)
  o[0]=rx; o[1]=ux; o[2]=-fx; o[3]=0; o[4]=ry; o[5]=uy; o[6]=-fy; o[7]=0; o[8]=rz; o[9]=uz; o[10]=-fz; o[11]=0;
  o[12]=-(rx*eye[0]+ry*eye[1]+rz*eye[2]); o[13]=-(ux*eye[0]+uy*eye[1]+uz*eye[2]); o[14]=fx*eye[0]+fy*eye[1]+fz*eye[2]; o[15]=1; return o;
}
export function drawBox(x, y, z, sx, sy, sz, col, a, proj, view) {
  const ca = Math.cos(a || 0), sa = Math.sin(a || 0), fx = ca, fz = sa, rx = -sa, rz = ca;
  const m = new Float32Array(16);
  m[0]=fx*sx; m[1]=0; m[2]=fz*sx; m[3]=0; m[4]=0; m[5]=sy; m[6]=0; m[7]=0; m[8]=rx*sz; m[9]=0; m[10]=rz*sz; m[11]=0; m[12]=x; m[13]=y; m[14]=z; m[15]=1;
  const mvp = matMul(proj, matMul(view, m));
  gl.uniformMatrix4fv(uModel, false, m); gl.uniformMatrix4fv(uMVP, false, mvp); gl.uniform3fv(uColor, col);
  gl.drawArrays(gl.TRIANGLES, 0, 36);
}
export function setCam(x, y, z) { gl.uniform3f(uCamPos, x, y, z); }
export function shadeCol(c, p) { return [Math.max(0, Math.min(1, c[0]+p)), Math.max(0, Math.min(1, c[1]+p)), Math.max(0, Math.min(1, c[2]+p))]; }
export function hashRand(x, z) { let h = Math.floor(Math.abs(x)*7 + Math.abs(z)*13) % 1000; h = (h*9301 + 49297) % 233280; return h / 233280; }
