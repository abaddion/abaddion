/**
 * Screen-space nova — horizontal line + tight flash (no full-screen wash).
 */

export const NovaPassShader = {
    uniforms: {
        tDiffuse: { value: null },
        uProgress: { value: 0 },
        uCenter: { value: [0.5, 0.5] },
        uResolution: { value: [1920, 1080] },
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
        uniform vec2 uResolution;
        uniform float uRadius;
        uniform vec3 uSignal;
        varying vec2 vUv;

        void main() {
            vec4 base = texture2D(tDiffuse, vUv);
            vec2 fragPx = vUv * uResolution;
            vec2 centerPx = uCenter * uResolution;
            vec2 d = fragPx - centerPx;
            float minSide = min(uResolution.x, uResolution.y);
            float maxFlash = minSide * uRadius;
            float dist = length(d);

            float lineW = max(1.0, uResolution.y * 0.0035);
            float horiz = exp(-abs(d.y) / lineW) * uProgress * 0.92;
            float ring = smoothstep(maxFlash * uProgress, maxFlash * uProgress * 0.55, dist);
            ring *= uProgress * (1.0 - uProgress * 0.9) * 0.45;

            vec3 nova = vec3(0.95, 0.92, 0.88) * (horiz * 0.55 + ring);
            nova += uSignal * horiz * 0.12;
            vec3 outCol = base.rgb + nova;
            gl_FragColor = vec4(outCol, base.a);
        }
    `
};
