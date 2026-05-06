precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_texture;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform float u_amount;

void main() {
  vec4 color = texture2D(u_texture, v_texCoord);
  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  vec3 duotone = mix(u_color1, u_color2, gray);
  vec3 result = mix(color.rgb, duotone, u_amount);
  gl_FragColor = vec4(clamp(result, 0.0, 1.0), color.a);
}
