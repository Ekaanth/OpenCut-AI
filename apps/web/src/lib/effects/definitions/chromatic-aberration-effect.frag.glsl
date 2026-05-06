precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_amount;

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  float offset = u_amount * 5.0 * texelSize.x;
  float r = texture2D(u_texture, v_texCoord + vec2(offset, 0.0)).r;
  float g = texture2D(u_texture, v_texCoord).g;
  float b = texture2D(u_texture, v_texCoord - vec2(offset, 0.0)).b;
  float a = texture2D(u_texture, v_texCoord).a;
  gl_FragColor = vec4(r, g, b, a);
}
