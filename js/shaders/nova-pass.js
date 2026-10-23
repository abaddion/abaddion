/**
 * Fullscreen nova burst — warm white + signal hint.
 */

export const NovaPassShader = {
    uniforms: {
        tDiffuse: { value: null },
        uProgress: { value: 0 },
        uCenter: { value: [0.5, 0.5] },
        uRadius: { value: 0.25 },
        uSignal: { value: [0.78, 1, 0] }
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
        uniform float uProgress;
        uniform vec2 uCenter;
        uniform float uRadius;
        uniform vec3 uSignal;
        varying vec2 vUv;

        void main() {
            vec4 base = texture2D(tDiffuse, vUv);
            vec2 d = vUv - uCenter;
            float dist = length(d);
            float ring = smoothstep(uRadius * uProgress, 0.0, dist) * (1.0 - uProgress * 0.85);
            float streak = abs(d.x) * 8.0 + abs(d.y) * 2.0;
            streak = exp(-streak) * uProgress * 0.6;
            vec3 nova = vec3(0.95, 0.92, 0.88) * (ring + streak);
            nova += uSignal * streak * 0.35;
            vec3 outCol = base.rgb + nova * (1.0 - base.a * 0.2);
            gl_FragColor = vec4(outCol, base.a);
        }
    `
};
