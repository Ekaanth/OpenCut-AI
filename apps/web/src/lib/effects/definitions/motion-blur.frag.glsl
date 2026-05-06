precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_amount;
uniform vec2 u_resolution;

void main() {
  vec2 dir = v_texCoord - 0.5;
  float dist = length(dir);
  vec2 texelSize = 1.0 / u_resolution;
  vec4 color = vec4(0.0);
  float totalWeight = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float t = fi / 7.0 * u_amount * 0.02;
    float weight = 1.0 - t;
    color += texture2D(u_texture, v_texCoord + dir * t) * weight;
    totalWeight += weight;
  }
  gl_FragColor = color / totalWeight;
}
