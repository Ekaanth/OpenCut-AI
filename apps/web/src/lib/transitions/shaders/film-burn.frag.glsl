precision mediump float;

uniform sampler2D u_textureA;
uniform sampler2D u_textureB;
uniform float u_progress;

varying vec2 v_texCoord;

void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);
  float burn = u_progress;
  float burnEdge = 0.08;
  float brightness = dot(colorA.rgb, vec3(0.299, 0.587, 0.114));
  float burnThreshold = burn * (1.0 + burnEdge * 2.0) - burnEdge;
  float mask = smoothstep(burnThreshold - burnEdge, burnThreshold + burnEdge, brightness);
  vec3 burnColor = mix(vec3(1.0, 0.6, 0.1), vec3(1.0, 0.2, 0.0), burn);
  vec4 result = mix(colorA, vec4(burnColor, 1.0), (1.0 - mask) * step(0.01, burn) * step(burn, 0.99));
  result = mix(result, colorB, smoothstep(burnThreshold + burnEdge, burnThreshold + burnEdge * 3.0, brightness) * burn);
  gl_FragColor = result;
}
