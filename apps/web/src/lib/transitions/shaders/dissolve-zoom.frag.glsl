precision mediump float;

uniform sampler2D u_textureA;
uniform sampler2D u_textureB;
uniform float u_progress;

varying vec2 v_texCoord;

void main() {
  vec2 centered = v_texCoord - 0.5;
  if (u_progress < 0.5) {
    float scale = 1.0 + u_progress * 4.0;
    vec2 zoomed = centered / scale + 0.5;
    vec4 color = texture2D(u_textureA, clamp(zoomed, 0.0, 1.0));
    gl_FragColor = vec4(color.rgb, color.a * (1.0 - u_progress * 2.0));
  } else {
    float p = (u_progress - 0.5) * 2.0;
    float scale = 3.0 - p * 2.0;
    vec2 zoomed = centered / scale + 0.5;
    vec4 colorA = texture2D(u_textureA, clamp(zoomed, 0.0, 1.0));
    vec4 colorB = texture2D(u_textureB, v_texCoord);
    gl_FragColor = mix(colorA, colorB, p);
  }
}
