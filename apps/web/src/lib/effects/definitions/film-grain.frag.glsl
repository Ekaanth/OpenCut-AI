precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_intensity;
uniform float u_time;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec4 color = texture2D(u_texture, v_texCoord);
  float grain = (rand(v_texCoord + u_time) - 0.5) * u_intensity;
  gl_FragColor = vec4(clamp(color.rgb + grain, 0.0, 1.0), color.a);
}
