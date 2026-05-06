precision mediump float;

uniform sampler2D u_textureA;
uniform sampler2D u_textureB;
uniform float u_progress;

varying vec2 v_texCoord;

void main() {
  vec2 centered = v_texCoord - 0.5;
  if (u_progress < 0.5) {
    float p = u_progress * 2.0;
    float scaleX = cos(p * 1.5708);
    vec2 scaled = vec2(centered.x / max(scaleX, 0.001), centered.y) + 0.5;
    scaled = clamp(scaled, 0.0, 1.0);
    vec4 color = texture2D(u_textureA, scaled);
    gl_FragColor = vec4(color.rgb, color.a * (1.0 - p));
  } else {
    float p = (u_progress - 0.5) * 2.0;
    float scaleX = sin(p * 1.5708);
    vec2 scaled = vec2(centered.x / max(scaleX, 0.001), centered.y) + 0.5;
    scaled = clamp(scaled, 0.0, 1.0);
    vec4 color = texture2D(u_textureB, scaled);
    gl_FragColor = vec4(color.rgb, color.a * p);
  }
}
