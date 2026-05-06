precision mediump float;

uniform sampler2D u_textureA;
uniform sampler2D u_textureB;
uniform float u_progress;

varying vec2 v_texCoord;

void main() {
  float dist = distance(v_texCoord, vec2(0.5));
  float radius = u_progress * 0.72;
  float edge = 0.02;
  float alpha = smoothstep(radius, radius - edge, dist);
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);
  gl_FragColor = mix(colorB, colorA, alpha);
}
