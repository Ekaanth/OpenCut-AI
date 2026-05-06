precision mediump float;

uniform sampler2D u_textureA;
uniform sampler2D u_textureB;
uniform float u_progress;

varying vec2 v_texCoord;

void main() {
  float angle = atan(v_texCoord.y - 0.5, v_texCoord.x - 0.5);
  float normalizedAngle = (angle + 3.14159265) / 6.28318530;
  float edge = u_progress;
  if (normalizedAngle < edge) {
    gl_FragColor = texture2D(u_textureB, v_texCoord);
  } else {
    gl_FragColor = texture2D(u_textureA, v_texCoord);
  }
}
