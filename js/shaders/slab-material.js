/**
 * Procedural glass-monitor slab shader (instanced focus + atlas region).
 */

import * as THREE from 'three';

export function createSlabMaterial(reducedMotion = false) {
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: true,
        side: THREE.DoubleSide,
        uniforms: {
            uTime: { value: 0 },
            uCameraPos: { value: new THREE.Vector3() },
            uParallax: { value: new THREE.Vector2() },
            uSignal: { value: new THREE.Color(0xc6ff00) },
            uInk: { value: new THREE.Color(0x0a0a0a) },
            uReduced: { value: reducedMotion ? 1 : 0 },
            uBackdropDim: { value: 1 },
            uAtlas: { value: null },
            uAtlasReady: { value: 0 },
            uContentCollapse: { value: 1 },
            uPixelGrid: { value: new THREE.Vector2(48, 32) },
            uMobilePortrait: { value: 0 }
        },
        vertexShader: `
            attribute float aFocus;
            attribute vec4 aAtlasRect;
            varying float vFocus;
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            varying vec2 vUv;
            varying vec4 vAtlasRect;

            void main() {
                vFocus = aFocus;
                vUv = uv;
                vAtlasRect = aAtlasRect;
                vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
                vWorldPos = world.xyz;
                vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
                gl_Position = projectionMatrix * viewMatrix * world;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform vec3 uCameraPos;
            uniform vec2 uParallax;
            uniform vec3 uSignal;
            uniform vec3 uInk;
            uniform float uReduced;
            uniform float uBackdropDim;
            uniform sampler2D uAtlas;
            uniform float uAtlasReady;
            uniform float uContentCollapse;
            uniform vec2 uPixelGrid;
            uniform float uMobilePortrait;

            varying float vFocus;
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            varying vec2 vUv;
            varying vec4 vAtlasRect;

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            }

            vec3 sampleAtlas(vec2 uv) {
                vec2 atlasUv = mix(vAtlasRect.xy, vAtlasRect.zw, uv);
                vec2 px = floor(atlasUv * uPixelGrid * 4.0) / (uPixelGrid * 4.0);
                return texture2D(uAtlas, px).rgb;
            }

            void main() {
                float focus = clamp(vFocus, 0.0, 1.0);
                vec3 N = normalize(vNormal);
                vec3 V = normalize(uCameraPos - vWorldPos);
                float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.2);

                float scan = sin(vUv.y * 900.0 + uTime * 0.5) * 0.04;
                float grid = step(0.92, fract(vUv.x * 120.0)) + step(0.92, fract(vUv.y * 80.0));
                grid = clamp(grid * 0.08, 0.0, 0.12);

                float snow = noise(vUv * 420.0 + uTime * 0.02);
                snow += noise(vUv * 180.0 - uTime * 0.05) * 0.5;
                float snowAmt = mix(0.15, 0.03, focus);

                float band = 0.0;
                if (uReduced < 0.5) {
                    band = smoothstep(0.35, 0.0, abs(vUv.y - fract(uTime * 0.04)));
                    band *= (1.0 - focus) * 0.15;
                }

                vec3 base = mix(uInk, uInk * 1.2, 0.35);
                base += uSignal.rgb * focus * 0.08 * (grid + 0.2);
                base += vec3(fresnel * (0.25 + focus * 0.35));
                base -= scan * (0.5 - focus * 0.3);
                base += vec3(snow * snowAmt);
                base -= vec3(band);

                vec3 atlasCol = vec3(0.0);
                if (uAtlasReady > 0.5) {
                    atlasCol = sampleAtlas(vUv);
                }
                float atlasMix = focus * uContentCollapse * 0.92;
                if (focus > 0.95) {
                    snowAmt = 0.03;
                }
                base = mix(base, atlasCol, atlasMix);
                base += vec3(snow * snowAmt * (1.0 - atlasMix));

                float spec = pow(max(dot(reflect(-V, N), V), 0.0), 24.0);
                spec *= 0.35 + focus * 0.4;
                vec2 specDir = normalize(uParallax + vec2(0.001, 0.0));
                spec += pow(max(dot(N, normalize(vec3(specDir.x, 0.6, specDir.y))), 0.0), 8.0) * 0.2;

                base += vec3(spec);
                float alpha = 0.35 + fresnel * 0.25 + focus * 0.15;
                alpha *= mix(1.0, uBackdropDim, focus);
                if (uMobilePortrait > 0.5) {
                    alpha *= mix(0.25, 1.0, focus);
                }

                gl_FragColor = vec4(base, alpha);
            }
        `
    });
}
