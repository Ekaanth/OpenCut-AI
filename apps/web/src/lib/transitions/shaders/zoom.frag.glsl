precision mediump float;

uniform sampler2D u_textureA;
uniform sampler2D u_textureB;
uniform float u_progress;

varying vec2 v_texCoord;

void main() {
  if (u_progress < 0.5) {
    float scale = 1.0 + u_progress * 2.0;
    vec2 zoomedCoord = (v_texCoord - 0.5) / scale + 0.5;
    vec4 color = texture2D(u_textureA, zoomedCoord);
    gl_FragColor = vec4(color.rgb, color.a * (1.0 - u_progress * 2.0));
  } else {
    float scale = 2.0 - u_progress * 2.0;
    vec2 zoomedCoord = (v_texCoord - 0.5) / scale + 0.5;
    vec4 color = texture2D(u_textureB, zoomedCoord);
    gl_FragColor = vec4(color.rgb, color.a * ((u_progress - 0.5) * 2.0));
  }
}
