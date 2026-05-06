precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_amount;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float lineNoise = step(0.98, rand(vec2(floor(v_texCoord.y * 80.0), floor(u_amount * 50.0))));
  float blockNoise = step(0.995, rand(vec2(floor(v_texCoord.x * 20.0), floor(v_texCoord.y * 20.0))));
  vec2 offset = vec2(
    (rand(vec2(floor(v_texCoord.y * 40.0), u_amount)) - 0.5) * 0.03 * lineNoise,
    (rand(vec2(floor(v_texCoord.x * 40.0), u_amount)) - 0.5) * 0.02 * lineNoise
  );
  vec2 uv = v_texCoord + offset;
  uv = clamp(uv, 0.0, 1.0);
  vec4 color = texture2D(u_texture, uv);
  color.rgb += (rand(v_texCoord * u_amount) - 0.5) * u_amount * 0.3;
  color.rgb = mix(color.rgb, vec3(0.0), blockNoise * u_amount);
  gl_FragColor = vec4(clamp(color.rgb, 0.0, 1.0), color.a);
}
