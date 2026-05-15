precision mediump float;

varying vec2 v_texCoord;

uniform sampler2D u_texture;
uniform vec2 u_resolution;

uniform vec3 u_keyColor;
uniform float u_tolerance;
uniform float u_softness;
uniform float u_spillSuppress;
uniform float u_edgeShrink;

void main() {
    vec4 color = texture2D(u_texture, v_texCoord);
    vec3 rgb = color.rgb;

    float dist = distance(rgb, u_keyColor);

    float mask = smoothstep(u_tolerance - u_softness, u_tolerance + u_softness, dist);

    vec3 spillDiff = rgb - u_keyColor;
    float spillAmount = max(0.0, 1.0 - dist / max(u_tolerance, 0.01));
    float spillFactor = spillAmount * u_spillSuppress;

    vec3 corrected = rgb;
    corrected.r = mix(corrected.r, corrected.r * (1.0 - spillFactor), step(0.0, u_keyColor.r - 0.1));
    corrected.g = mix(corrected.g, corrected.g * (1.0 - spillFactor), step(0.0, u_keyColor.g - 0.1));
    corrected.b = mix(corrected.b, corrected.b * (1.0 - spillFactor), step(0.0, u_keyColor.b - 0.1));

    gl_FragColor = vec4(corrected, color.a * mask);
}
