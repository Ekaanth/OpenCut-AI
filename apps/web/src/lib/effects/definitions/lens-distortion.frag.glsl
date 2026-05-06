precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_amount;

void main() {
  vec2 centered = v_texCoord - 0.5;
  float dist = length(centered);
  float distortion = 1.0 + dist * dist * u_amount * 2.0;
  vec2 distorted = centered * distortion + 0.5;
  distorted = clamp(distorted, 0.0, 1.0);
  vec4 color = texture2D(u_texture, distorted);
  gl_FragColor = color;
}
