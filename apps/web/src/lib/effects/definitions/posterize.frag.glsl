precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_levels;

void main() {
  vec4 color = texture2D(u_texture, v_texCoord);
  vec3 rgb = color.rgb;
  float steps = max(u_levels, 2.0);
  rgb = floor(rgb * steps) / (steps - 1.0);
  gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
}
