precision mediump float;

uniform sampler2D u_textureA;
uniform sampler2D u_textureB;
uniform float u_progress;

varying vec2 v_texCoord;

void main() {
  vec2 coordA = v_texCoord - vec2(u_progress, 0.0);
  vec2 coordB = v_texCoord - vec2(u_progress - 1.0, 0.0);

  if (coordA.x < 0.0 || coordA.x > 1.0) {
    gl_FragColor = texture2D(u_textureB, coordB);
  } else if (coordB.x < 0.0 || coordB.x > 1.0) {
    gl_FragColor = texture2D(u_textureA, coordA);
  } else {
    gl_FragColor = texture2D(u_textureA, coordA);
  }
}
