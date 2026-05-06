precision mediump float;

uniform sampler2D u_textureA;
uniform sampler2D u_textureB;
uniform float u_progress;

varying vec2 v_texCoord;

void main() {
  float bandWidth = 0.15;
  float numBands = 6.0;
  vec2 centered = v_texCoord - 0.5;
  float angle = u_progress * 0.3;
  float rotatedX = centered.x * cos(angle) - centered.y * sin(angle);
  float bandPos = fract(rotatedX * numBands);
  float slideOffset = u_progress * 1.2;
  float mask = step(bandPos, fract(slideOffset + floor(rotatedX * numBands) * 0.1));
  vec2 uvA = v_texCoord + vec2(mask * 0.1, 0.0);
  vec2 uvB = v_texCoord - vec2((1.0 - mask) * 0.1, 0.0);
  vec4 colorA = texture2D(u_textureA, clamp(uvA, 0.0, 1.0));
  vec4 colorB = texture2D(u_textureB, clamp(uvB, 0.0, 1.0));
  gl_FragColor = mix(colorA, colorB, mask);
}
