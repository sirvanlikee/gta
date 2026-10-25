attribute vec3 aPos;
attribute vec3 aNorm;
uniform mat4 uMVP;
uniform mat4 uModel;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(uModel) * aNorm);
  gl_Position = uMVP * w;
}
