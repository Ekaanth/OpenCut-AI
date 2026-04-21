precision mediump float;

uniform sampler2D u_textureA;
uniform sampler2D u_textureB;
uniform float u_progress;

varying vec2 v_texCoord;

void main() {
  float edge = u_progress;
  if (v_texCoord.x < edge) {
    gl_FragColor = texture2D(u_textureB, v_texCoord);
  } else {
    gl_FragColor = texture2D(u_textureA, v_texCoord);
  }
}
