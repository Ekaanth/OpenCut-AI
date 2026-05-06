precision mediump float;

uniform sampler2D u_textureA;
uniform sampler2D u_textureB;
uniform float u_progress;

varying vec2 v_texCoord;

void main() {
  vec2 center = vec2(0.5);
  vec2 dir = v_texCoord - center;
  float dist = length(dir);
  float morphAmt = u_progress * 1.5;
  float morphed = smoothstep(0.0, 0.5, morphAmt - dist);
  vec2 uvA = center + dir * (1.0 + morphAmt * 0.5);
  vec2 uvB = center + dir * (1.0 - (1.0 - u_progress) * 0.5);
  uvA = clamp(uvA, 0.0, 1.0);
  uvB = clamp(uvB, 0.0, 1.0);
  vec4 colorA = texture2D(u_textureA, uvA);
  vec4 colorB = texture2D(u_textureB, uvB);
  gl_FragColor = mix(colorA, colorB, morphed);
}
