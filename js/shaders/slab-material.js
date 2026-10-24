/**
 * Glass chess slab shader — atlas mosaic under etched 8×8 frost, one draw call.
 */

import * as THREE from 'three';

/** @returns {0 | 1} uVariant: 0 = slab a (default), 1 = slab b */
export function resolveSlabVariantFromUrl(location = globalThis.location) {
    const params = new URLSearchParams(location?.search ?? '');
    const slab = (params.get('slab') ?? 'a').toLowerCase();
    return slab === 'b' ? 1 : 0;
}

export function createSlabMaterial(reducedMotion = false, variant = 0) {
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
            uVariant: { value: variant === 1 ? 1 : 0 },
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
            uniform float uVariant;
            uniform float uMobilePortrait;

            varying float vFocus;
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            varying vec2 vUv;
            varying vec4 vAtlasRect;

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }

            vec2 atlasUvFromLocal(vec2 uv01) {
                return mix(vAtlasRect.xy, vAtlasRect.zw, uv01);
            }

            vec3 sampleMosaic(vec2 uv, float focus, float seed) {
                if (uAtlasReady < 0.5) {
                    return uInk.rgb * 0.35;
                }

                float blockBase = mix(0.105, 0.068, uVariant);
                float blockJitter = hash(floor(uv / blockBase) + seed) * 0.35 + 0.82;
                float blockSize = blockBase * blockJitter;
                vec2 blockId = floor(uv / blockSize);
                vec2 blockLocal = fract(uv / blockSize);

                if (hash(blockId + seed + 19.7) < 0.15) {
                    return uInk.rgb * mix(0.08, 0.14, focus);
                }

                vec2 shift = (vec2(hash(blockId + seed), hash(blockId + seed + 3.1)) - 0.5);
                shift *= mix(0.07, 0.035, uVariant);
                vec2 sampleUv = clamp(blockLocal + shift, 0.02, 0.98);

                vec2 atlasBase = atlasUvFromLocal(sampleUv);
                float rgbSplit = mix(0.014, 0.006, uVariant);
                vec2 px = vec2(rgbSplit, rgbSplit * 0.65);

                float r = texture2D(uAtlas, atlasBase + px).r;
                float g = texture2D(uAtlas, atlasBase).g;
                float b = texture2D(uAtlas, atlasBase - px).b;
                vec3 col = vec3(r, g, b);

                float gate = hash(blockId + seed + 9.0);
                if (uReduced < 0.5 && focus > 0.25 && gate > 0.985) {
                    col = mix(col, vec3(0.9), 0.35);
                }

                float bright = mix(0.38, 0.95, focus);
                return col * bright;
            }

            vec3 glassTopColor(vec2 uv, vec3 mosaic, float focus, vec3 N, vec3 V) {
                vec2 chess = floor(uv * 8.0);
                float checker = mod(chess.x + chess.y, 2.0);
                float frostAmt = mix(0.55, 0.22, uVariant);
                frostAmt = mix(frostAmt + 0.18, frostAmt - 0.08, focus);

                float frost = mix(0.12, 0.38, checker) * frostAmt;
                frost += hash(chess + checker) * 0.04;

                vec3 glassBase = mix(vec3(0.02), vec3(0.06), checker * 0.5);
                glassBase = mix(glassBase, mosaic, (0.35 + focus * 0.55) * uContentCollapse);

                float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.4);
                glassBase += vec3(fresnel * (0.06 + focus * 0.14));

                float sweepSpeed = mix(1.15, 0.75, uVariant);
                float sweep = sin(dot(V, vec3(0.4, 0.9, 0.2)) * 6.0 + uTime * sweepSpeed);
                sweep = pow(max(sweep, 0.0), mix(3.2, 2.4, uVariant));
                float specGain = mix(0.18, 0.32, uVariant);
                glassBase += vec3(sweep * specGain * (0.25 + focus * 0.75));

                float innerRefl = pow(max(dot(reflect(-V, N), vec3(0.0, 1.0, 0.0)), 0.0), 8.0);
                glassBase += vec3(innerRefl * 0.04 * (0.4 + focus));

                if (focus > 0.35 && checker > 0.5) {
                    glassBase += uSignal.rgb * 0.08 * focus;
                }

                glassBase = mix(glassBase, mix(glassBase, mosaic, 0.15), frost);
                return glassBase;
            }

            vec3 sideBevelColor(vec3 N) {
                vec3 L = normalize(vec3(0.25, 1.0, 0.35));
                float ndotl = max(dot(N, L), 0.0);
                vec3 base = uInk.rgb * (0.22 + ndotl * 0.45);
                base += vec3(0.04, 0.04, 0.05) * ndotl;
                return base;
            }

            void main() {
                float focus = clamp(vFocus, 0.0, 1.0);
                vec3 N = normalize(vNormal);
                vec3 V = normalize(uCameraPos - vWorldPos);

                float reseedPeriod = mix(3.0, 4.5, uVariant);
                float seed = uReduced > 0.5 ? 0.0 : floor(uTime / reseedPeriod);

                vec3 col;
                float alpha;

                if (N.y > 0.72) {
                    vec2 mosaicUv = vUv + uParallax * 0.012 * (1.0 - focus);
                    vec3 mosaic = sampleMosaic(mosaicUv, focus, seed);
                    col = glassTopColor(vUv, mosaic, focus, N, V);
                    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.0);
                    alpha = 0.42 + fresnel * 0.22 + focus * 0.1;
                } else if (N.y < -0.72) {
                    col = uInk.rgb * 0.18;
                    alpha = 0.35;
                } else {
                    col = sideBevelColor(N);
                    alpha = 0.72;
                }

                col = mix(uInk.rgb * 0.35, col, mix(0.65, 1.0, focus) * uContentCollapse);
                alpha *= mix(1.0, uBackdropDim, focus);
                if (uMobilePortrait > 0.5) {
                    alpha *= mix(0.35, 1.0, focus);
                }

                gl_FragColor = vec4(col, alpha);
            }
        `
    });
}
