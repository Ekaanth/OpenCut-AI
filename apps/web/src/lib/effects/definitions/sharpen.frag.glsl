precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_amount;

void main() {
  vec4 color = texture2D(u_texture, v_texCoord);
  vec3 rgb = color.rgb;
  rgb = rgb * (2.0 * u_amount + 1.0) / (rgb * 2.0 * u_amount + 2.0 * u_amount - rgb * 2.0 * u_amount + 1.0);
  gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
}
