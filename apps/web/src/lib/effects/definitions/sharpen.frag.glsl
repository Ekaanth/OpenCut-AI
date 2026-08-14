precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_amount;

void main() {
  vec2 texel = 1.0 / u_resolution;
  vec4 color = texture2D(u_texture, v_texCoord);

  // classic unsharp mask: boost the center pixel by its difference from
  // the average of its 4-neighborhood, scaled by amount
  vec4 neighborSum =
      texture2D(u_texture, v_texCoord + vec2(-texel.x, 0.0)) +
      texture2D(u_texture, v_texCoord + vec2(texel.x, 0.0)) +
      texture2D(u_texture, v_texCoord + vec2(0.0, -texel.y)) +
      texture2D(u_texture, v_texCoord + vec2(0.0, texel.y));

  vec3 sharpened = color.rgb * (1.0 + 4.0 * u_amount) - neighborSum.rgb * u_amount;
  gl_FragColor = vec4(clamp(sharpened, 0.0, 1.0), color.a);
}
