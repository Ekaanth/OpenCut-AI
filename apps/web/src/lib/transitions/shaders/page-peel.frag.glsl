precision mediump float;

uniform sampler2D u_textureA;
uniform sampler2D u_textureB;
uniform float u_progress;

varying vec2 v_texCoord;

void main() {
  vec2 uv = v_texCoord;
  float curl = u_progress * 3.14159 * 0.5;
  float pageX = uv.x;
  float isPeeling = step(u_progress * 1.2, pageX) * step(pageX, u_progress * 1.2 + 0.3);
  float curlRadius = 0.15;
  float curlCenter = u_progress * 1.2 + curlRadius;
  if (pageX > curlCenter) {
    gl_FragColor = texture2D(u_textureB, uv);
  } else if (pageX > curlCenter - curlRadius * 2.0) {
    float dist = (curlCenter - pageX) / curlRadius;
    float distorted = sin(dist * 1.5708) * 0.3;
    vec2 peelUv = vec2(1.0 - (pageX - (u_progress * 1.2 - curlRadius)) / (curlRadius * 2.0), uv.y);
    peelUv = clamp(peelUv, 0.0, 1.0);
    vec4 peeledColor = texture2D(u_textureA, peelUv);
    float shade = 0.7 + 0.3 * cos(dist * 1.5708);
    gl_FragColor = vec4(peeledColor.rgb * shade, 1.0);
  } else {
    gl_FragColor = texture2D(u_textureA, uv);
  }
}
