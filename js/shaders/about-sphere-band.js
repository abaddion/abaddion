/**
 * Inner-sphere text band — scroll along meridian + loop opacity + rare glitch.
 */

import * as THREE from 'three';

export function createAboutBandMaterial(textTexture, reducedMotion = false) {
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        uniforms: {
            uTextMap: { value: textTexture },
            uScroll: { value: 0 },
            uTime: { value: 0 },
            uDim: { value: 1 },
            uReduced: { value: reducedMotion ? 1 : 0 },
            uGlitchSeed: { value: Math.random() * 1000 }
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vWorldPos;
            varying vec3 vLocalPos;

            void main() {
                vUv = uv;
                vec4 world = modelMatrix * vec4(position, 1.0);
                vWorldPos = world.xyz;
                vLocalPos = position;
                gl_Position = projectionMatrix * viewMatrix * world;
            }
        `,
        fragmentShader: `
            uniform sampler2D uTextMap;
            uniform float uScroll;
            uniform float uTime;
            uniform float uDim;
            uniform float uReduced;
            uniform float uGlitchSeed;

            varying vec2 vUv;
            varying vec3 vWorldPos;
            varying vec3 vLocalPos;

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }

            void main() {
                vec2 scrollUv = vec2(vUv.x, fract(vUv.y + uScroll));
                vec4 tex = texture2D(uTextMap, scrollUv);
                float glyph = max(tex.a, dot(tex.rgb, vec3(0.299, 0.587, 0.114)));

                vec3 nPos = normalize(vLocalPos);
                float phiNorm = acos(clamp(nPos.y, -1.0, 1.0)) / 3.14159265;

                float overhead = 1.0 - smoothstep(0.02, 0.2, phiNorm);
                float frontLower = smoothstep(0.38, 0.58, phiNorm) * (1.0 - smoothstep(0.78, 0.96, phiNorm));
                float midArc = smoothstep(0.22, 0.42, phiNorm) * (1.0 - smoothstep(0.55, 0.72, phiNorm));
                float legibility = max(frontLower, midArc * 0.75);
                legibility = max(legibility, 0.08);

                float opacity = mix(0.1, 1.0, legibility);
                opacity = mix(opacity, opacity * 0.1, overhead);
                opacity *= glyph * uDim;

                vec3 col = tex.rgb;

                if (uReduced < 0.5 && hash(vec2(uTime * 0.3, uGlitchSeed)) > 0.996) {
                    float tear = step(0.48, fract(scrollUv.y * 40.0 + uTime * 2.0));
                    col.r = texture2D(uTextMap, scrollUv + vec2(0.004, 0.0)).r;
                    col.b = texture2D(uTextMap, scrollUv - vec2(0.004, 0.0)).b;
                    opacity *= mix(1.0, 0.7, tear);
                }

                if (opacity < 0.02) discard;
                gl_FragColor = vec4(col, opacity);
            }
        `
    });
}
