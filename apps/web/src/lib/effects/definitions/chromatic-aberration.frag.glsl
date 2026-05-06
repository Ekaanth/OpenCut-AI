precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_amount;

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec4 center = texture2D(u_texture, v_texCoord);
  vec4 top    = texture2D(u_texture, v_texCoord + vec2(0.0, -texelSize.y));
  vec4 bottom = texture2D(u_texture, v_texCoord + vec2(0.0,  texelSize.y));
  vec4 left   = texture2D(u_texture, v_texCoord + vec2(-texelSize.x, 0.0));
  vec4 right  = texture2D(u_texture, v_texCoord + vec2( texelSize.x, 0.0));

  vec4 sharpened = center + (center * 4.0 - top - bottom - left - right) * u_amount;
  gl_FragColor = vec4(clamp(sharpened.rgb, 0.0, 1.0), center.a);
}
