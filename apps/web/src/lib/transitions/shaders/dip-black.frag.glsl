precision mediump float;

uniform sampler2D u_textureA;
uniform sampler2D u_textureB;
uniform float u_progress;

varying vec2 v_texCoord;

void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);
  vec4 black = vec4(0.0, 0.0, 0.0, 1.0);

  vec4 result;
  if (u_progress < 0.5) {
    result = mix(colorA, black, u_progress * 2.0);
  } else {
    result = mix(black, colorB, (u_progress - 0.5) * 2.0);
  }
  gl_FragColor = result;
}
