/**
 * UberGlitch — combined digital glitch + RGB channel shift (single full-screen pass).
 */

export const UberGlitchShader = {
    name: 'UberGlitchShader',
    uniforms: {
        tDiffuse: { value: null },
        time: { value: 0.0 },
        intensity: { value: 0.05 },
        rgbAmount: { value: 0.005 },
        seed: { value: 0.5 }
    },

    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float intensity;
        uniform float rgbAmount;
        uniform float seed;

        varying vec2 vUv;

        float random(vec2 co) {
            return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float n = i.x + i.y * 57.0;
            return mix(
                mix(random(vec2(n, n)), random(vec2(n + 1.0, n)), f.x),
                mix(random(vec2(n + 57.0, n + 57.0)), random(vec2(n + 58.0, n + 57.0)), f.x),
                f.y
            );
        }

        void main() {
            vec2 uv = vUv;
            float t = time * 0.3;
            float amount = intensity;

            float block = floor(uv.y * 12.0 + t * 8.0);
            float blockRandom = random(vec2(block, seed));
            if (blockRandom > 0.92) {
                uv.x += (blockRandom - 0.5) * 0.1;
            }

            float lineNoise = noise(vec2(uv.y * 100.0, t * 10.0));
            uv.x += (lineNoise - 0.5) * amount * 0.02;

            float roll = sin(uv.y * 2.0 + t * 3.0) * amount * 0.01;
            uv.y += roll;

            float angle = sin(time * 0.5) * 3.14159265;
            vec2 rgbOffset = rgbAmount * vec2(cos(angle), sin(angle));

            vec4 color;
            color.r = texture2D(tDiffuse, uv + rgbOffset).r;
            color.g = texture2D(tDiffuse, uv).g;
            color.b = texture2D(tDiffuse, uv - rgbOffset).b;
            color.a = 1.0;

            float scanline = sin(uv.y * 800.0) * 0.04 * amount;
            color.rgb -= scanline;

            color.rgb += noise(uv * 500.0 + t * 10.0) * amount * 0.1;

            if (random(vec2(t, seed)) > 0.998) {
                color.rgb = vec3(1.0);
            }

            gl_FragColor = color;
        }
    `
};
