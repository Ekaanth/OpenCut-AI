precision mediump float;

uniform sampler2D u_textureA;
uniform sampler2D u_textureB;
uniform float u_progress;

varying vec2 v_texCoord;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float glitchStrength = sin(u_progress * 3.14159) * 0.15;
  float lineNoise = step(0.95, rand(vec2(floor(v_texCoord.y * 40.0), floor(u_progress * 10.0))));
  float offset = (rand(vec2(floor(v_texCoord.y * 20.0), u_progress)) - 0.5) * glitchStrength * lineNoise;
  vec2 uvA = v_texCoord + vec2(offset, 0.0);
  vec2 uvB = v_texCoord + vec2(-offset, 0.0);
  uvA = clamp(uvA, 0.0, 1.0);
  uvB = clamp(uvB, 0.0, 1.0);
  vec4 colorA = texture2D(u_textureA, uvA);
  vec4 colorB = texture2D(u_textureB, uvB);
  float scanline = 0.95 + 0.05 * sin(v_texCoord.y * 800.0);
  gl_FragColor = mix(colorA, colorB, u_progress) * scanline;
}
