precision mediump float;

uniform sampler2D u_textureA;
uniform sampler2D u_textureB;
uniform float u_progress;

varying vec2 v_texCoord;

void main() {
  float checkerSize = 8.0;
  vec2 checker = floor(v_texCoord * checkerSize);
  float isEven = mod(checker.x + checker.y, 2.0);
  float threshold = u_progress;
  float alpha = step(isEven, threshold);
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);
  gl_FragColor = mix(colorA, colorB, alpha);
}
