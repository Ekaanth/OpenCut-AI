precision mediump float;

uniform sampler2D u_textureA;
uniform sampler2D u_textureB;
uniform float u_progress;

varying vec2 v_texCoord;

void main() {
  float angle = u_progress * 6.28318530;
  float cosA = cos(angle);
  float sinA = sin(angle);
  vec2 centered = v_texCoord - 0.5;
  if (u_progress < 0.5) {
    float scale = 1.0 + u_progress * 2.0;
    vec2 rotated = vec2(centered.x * cosA - centered.y * sinA, centered.x * sinA + centered.y * cosA);
    vec2 scaled = rotated / scale + 0.5;
    scaled = clamp(scaled, 0.0, 1.0);
    vec4 color = texture2D(u_textureA, scaled);
    gl_FragColor = vec4(color.rgb, color.a * (1.0 - u_progress * 2.0));
  } else {
    float scale = 2.0 - u_progress * 2.0;
    vec2 rotated = vec2(centered.x * cosA - centered.y * sinA, centered.x * sinA + centered.y * cosA);
    vec2 scaled = rotated / scale + 0.5;
    scaled = clamp(scaled, 0.0, 1.0);
    vec4 color = texture2D(u_textureB, scaled);
    gl_FragColor = vec4(color.rgb, color.a * ((u_progress - 0.5) * 2.0));
  }
}
