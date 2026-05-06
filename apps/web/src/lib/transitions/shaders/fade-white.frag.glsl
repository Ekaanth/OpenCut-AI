precision mediump float;

uniform sampler2D u_textureA;
uniform sampler2D u_textureB;
uniform float u_progress;

varying vec2 v_texCoord;

void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);
  gl_FragColor = mix(colorA, colorB, smoothstep(0.0, 1.0, u_progress));
  float fadeWhite = sin(u_progress * 3.14159);
  gl_FragColor = mix(gl_FragColor, vec4(1.0), fadeWhite * 0.8);
}
