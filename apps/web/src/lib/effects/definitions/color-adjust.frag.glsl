precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_temperature;
uniform float u_vignette;

void main() {
    vec4 color = texture2D(u_texture, v_texCoord);
    vec3 rgb = color.rgb;

    // Brightness (-1 to 1)
    rgb += u_brightness;

    // Contrast (0 to 2, 1 = no change)
    rgb = (rgb - 0.5) * u_contrast + 0.5;

    // Saturation (0 = grayscale, 1 = normal, 2 = vivid)
    float gray = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
    rgb = mix(vec3(gray), rgb, u_saturation);

    // Temperature (-1 = cool/blue, 0 = neutral, 1 = warm/orange)
    rgb.r += u_temperature * 0.1;
    rgb.b -= u_temperature * 0.1;

    // Vignette (0 = none, 1 = strong)
    if (u_vignette > 0.0) {
        vec2 uv = v_texCoord * 2.0 - 1.0;
        float dist = length(uv) * 0.707;
        float vig = 1.0 - smoothstep(1.0 - u_vignette * 0.8, 1.0, dist);
        rgb *= vig;
    }

    rgb = clamp(rgb, 0.0, 1.0);
    gl_FragColor = vec4(rgb, color.a);
}
