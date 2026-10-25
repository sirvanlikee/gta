precision mediump float;
uniform vec3 uColor;
uniform vec3 uCam;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 n = normalize(vN);
  vec3 l = normalize(vec3(0.5, 1.0, 0.35));
  float d = max(dot(n, l), 0.0);
  vec3 col = uColor * (0.48 + 0.68 * d);
  col += vec3(0.04, 0.02, 0.0);
  float dist = distance(vW, uCam);
  float fog = clamp((dist - 80.0) / 100.0, 0.0, 0.80);
  col = mix(col, vec3(0.96, 0.62, 0.38), fog);
  gl_FragColor = vec4(col, 1.0);
}
