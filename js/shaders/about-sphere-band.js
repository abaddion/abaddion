/**
 * Inner-sphere text band — scroll + opacity falloff + rare glitch.
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

                vec3 viewDir = normalize(cameraPosition - vWorldPos);
                vec3 inward = normalize(-vLocalPos);
                float facing = dot(normalize(inward), viewDir);

                float yNorm = vLocalPos.y / max(length(vLocalPos), 0.001);
                float frontBottom = smoothstep(-0.15, 0.55, facing) * smoothstep(0.95, -0.35, yNorm);
                float overhead = smoothstep(0.2, 0.85, yNorm) * (1.0 - smoothstep(0.85, 1.0, yNorm));
                float opacity = mix(0.08, 1.0, frontBottom);
                opacity = mix(opacity, 0.1, overhead);
                opacity *= tex.a * uDim;

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
