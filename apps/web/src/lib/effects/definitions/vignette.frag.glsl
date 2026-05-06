precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_intensity;

void main() {
  vec4 color = texture2D(u_texture, v_texCoord);
  vec2 uv = v_texCoord * 2.0 - 1.0;
  float dist = length(uv);
  float vignette = 1.0 - smoothstep(0.5, 1.5, dist * (1.0 + u_intensity));
  gl_FragColor = vec4(color.rgb * vignette, color.a);
}
