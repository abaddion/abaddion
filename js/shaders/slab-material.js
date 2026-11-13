/**
 * Glass chess slab — atlas mosaic, nebula refraction, bevel rims (one draw call).
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
            uLightDir: { value: new THREE.Vector3(0.25, 1, 0.35) },
            uInk: { value: new THREE.Color(0x0a0a0a) },
            uBone: { value: new THREE.Color(0xece8df) },
            uReduced: { value: reducedMotion ? 1 : 0 },
            uBackdropDim: { value: 1 },
            uAtlas: { value: null },
            uAtlasReady: { value: 0 },
            uNebula: { value: null },
            uNebulaReady: { value: 0 },
            uContentCollapse: { value: 1 },
            uVariant: { value: variant === 1 ? 1 : 0 },
            uMobilePortrait: { value: 0 },
            uGlitchStrength: { value: 0 },
            uGlitchTear: { value: 0 },
            uGlitchRgb: { value: 0 },
            uGlitchDrop: { value: 0 },
            uGlitchSlab: { value: -1 }
        },
        vertexShader: `
            attribute float aFocus;
            attribute float aFloorIdx;
            attribute vec4 aAtlasRect;
            varying float vFocus;
            varying float vFloorIdx;
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            varying vec2 vUv;
            varying vec4 vAtlasRect;
            varying vec4 vClipPos;

            void main() {
                vFocus = aFocus;
                vFloorIdx = aFloorIdx;
                vUv = uv;
                vAtlasRect = aAtlasRect;
                vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
                vWorldPos = world.xyz;
                vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
                vec4 clip = projectionMatrix * viewMatrix * world;
                vClipPos = clip;
                gl_Position = clip;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform vec3 uCameraPos;
            uniform vec2 uParallax;
            uniform vec3 uLightDir;
            uniform vec3 uInk;
            uniform vec3 uBone;
            uniform float uReduced;
            uniform float uBackdropDim;
            uniform sampler2D uAtlas;
            uniform float uAtlasReady;
            uniform sampler2D uNebula;
            uniform float uNebulaReady;
            uniform float uContentCollapse;
            uniform float uVariant;
            uniform float uMobilePortrait;
            uniform float uGlitchStrength;
            uniform float uGlitchTear;
            uniform float uGlitchRgb;
            uniform float uGlitchDrop;
            uniform float uGlitchSlab;

            varying float vFocus;
            varying float vFloorIdx;
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            varying vec2 vUv;
            varying vec4 vAtlasRect;
            varying vec4 vClipPos;

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }

            vec2 atlasUvFromLocal(vec2 uv01) {
                return mix(vAtlasRect.xy, vAtlasRect.zw, uv01);
            }

            vec3 sampleMosaic(vec2 uv, float focus, float seed, float tear, float drop) {
                if (uAtlasReady < 0.5) {
                    return uInk.rgb * 0.35;
                }

                float blockBase = mix(0.105, 0.068, uVariant);
                float blockJitter = hash(floor(uv / blockBase) + seed) * 0.35 + 0.82;
                float blockSize = blockBase * blockJitter;
                vec2 blockId = floor(uv / blockSize);
                vec2 blockLocal = fract(uv / blockSize);

                vec2 tearUv = uv;
                if (tear > 0.01) {
                    float band = step(0.5, hash(vec2(blockId.y, seed)));
                    tearUv.y += band * tear * 0.12;
                }
                if (drop > 0.01 && hash(blockId + seed + 31.0) < drop * 0.35) {
                    blockLocal.y -= drop * 0.15;
                }

                if (hash(blockId + seed + 19.7) < 0.12) {
                    return uInk.rgb * mix(0.08, 0.14, focus);
                }

                vec2 shift = (vec2(hash(blockId + seed), hash(blockId + seed + 3.1)) - 0.5);
                shift *= mix(0.07, 0.035, uVariant);
                vec2 sampleUv = clamp(blockLocal + shift, 0.02, 0.98);

                vec2 mosaicCoord = tearUv;
                vec2 atlasBase = atlasUvFromLocal(sampleUv);
                float rgbSplit = mix(0.014, 0.006, uVariant);
                vec2 px = vec2(rgbSplit, rgbSplit * 0.65);

                float r = texture2D(uAtlas, atlasBase + px).r;
                float g = texture2D(uAtlas, atlasBase).g;
                float b = texture2D(uAtlas, atlasBase - px).b;
                vec3 col = vec3(r, g, b);

                float bright = mix(0.17, 0.95, focus);
                return col * bright;
            }

            vec3 sampleSpaceThroughGlass(vec2 screenUv, vec3 N, vec3 V, float focus) {
                if (uNebulaReady < 0.5) return vec3(0.0);
                vec3 nView = normalize((viewMatrix * vec4(N, 0.0)).xyz);
                vec2 nOff = nView.xy * mix(0.008, 0.022, 1.0 - focus) * (1.0 + uParallax.x * 0.02);
                vec2 chr = nOff * 2.8;
                float r = texture2D(uNebula, screenUv + chr).r;
                float g = texture2D(uNebula, screenUv + nOff).g;
                float b = texture2D(uNebula, screenUv - chr).b;
                vec3 neb = vec3(r, g, b);
                float starMask = smoothstep(0.52, 0.88, neb.g + hash(screenUv * 900.0) * 0.18);
                return mix(neb, neb * 1.25 + vec3(starMask * 0.15), 0.55);
            }

            float faceBevel(vec2 uv, float focus) {
                float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
                return smoothstep(0.18, 0.04, edge) * mix(0.45, 0.92, focus);
            }

            vec3 glassTopColor(vec2 uv, vec3 mosaic, float focus, vec3 N, vec3 V, vec3 spaceCol) {
                vec2 chess = floor(uv * 8.0);
                float checker = mod(chess.x + chess.y, 2.0);
                float frostAmt = mix(0.42, 0.18, uVariant);
                frostAmt = mix(frostAmt + 0.12, frostAmt - 0.06, focus);

                float frost = mix(0.1, 0.32, checker) * frostAmt;

                vec3 glassBase = mix(vec3(0.03), vec3(0.07), checker * 0.45);
                glassBase = mix(glassBase, mosaic, (0.42 + focus * 0.52) * uContentCollapse);
                glassBase = mix(glassBase, spaceCol, 0.22 + focus * 0.18);

                float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.2);
                glassBase += uBone.rgb * fresnel * (0.12 + focus * 0.22);

                vec3 L = normalize(uLightDir + vec3(uParallax.x * 0.4, 0.0, uParallax.y * 0.3));
                float spec = pow(max(dot(reflect(-V, N), L), 0.0), 48.0);
                glassBase += uBone.rgb * spec * (0.22 + focus * 0.55);

                float innerRefl = pow(max(dot(reflect(-V, N), vec3(0.0, 1.0, 0.0)), 0.0), 6.0);
                glassBase += vec3(innerRefl * 0.06 * (0.5 + focus));

                glassBase = mix(glassBase, mix(glassBase, mosaic, 0.12), frost);
                glassBase += uBone.rgb * faceBevel(uv, focus) * 0.35;
                return glassBase;
            }

            vec3 sideBevelColor(vec3 N, vec3 V, float focus) {
                vec3 L = normalize(uLightDir);
                float ndotl = max(dot(N, L), 0.0);
                vec3 base = uInk.rgb * (0.28 + ndotl * 0.5);
                base += uBone.rgb * (0.08 + ndotl * 0.12);
                float rim = pow(1.0 - max(abs(dot(N, V)), 0.0), 2.5);
                base += uBone.rgb * rim * mix(0.45, 0.9, focus);
                return base;
            }

            void main() {
                float focus = clamp(vFocus, 0.0, 1.0);
                vec3 N = normalize(vNormal);
                vec3 V = normalize(uCameraPos - vWorldPos);

                vec2 screenUv = (vClipPos.xy / max(vClipPos.w, 0.0001)) * 0.5 + 0.5;

                float reseedPeriod = mix(3.0, 4.5, uVariant);
                float seed = uReduced > 0.5 ? 0.0 : floor(uTime / reseedPeriod);

                float glitchOn = 0.0;
                if (uGlitchStrength > 0.01 && abs(vFloorIdx - uGlitchSlab) < 0.5) {
                    glitchOn = 1.0;
                }

                float tear = uGlitchTear * glitchOn;
                float drop = uGlitchDrop * glitchOn;
                float gstr = uGlitchStrength * glitchOn;

                vec2 mosaicUv = vUv + uParallax * 0.012 * (1.0 - focus);
                if (gstr > 0.01) {
                    mosaicUv.x += sin(vUv.y * 120.0 + uTime * 40.0) * gstr * 0.004;
                }

                vec3 mosaic = sampleMosaic(mosaicUv, focus, seed, tear, drop);
                vec3 spaceCol = sampleSpaceThroughGlass(screenUv, N, V, focus);

                vec3 col;
                float alpha;

                if (N.y > 0.65) {
                    col = glassTopColor(vUv, mosaic, focus, N, V, spaceCol);
                    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.0);
                    alpha = 0.52 + fresnel * 0.22 + focus * 0.12;
                } else if (N.y < -0.65) {
                    col = uInk.rgb * 0.22 + spaceCol * 0.08;
                    alpha = 0.42;
                } else {
                    col = sideBevelColor(N, V, focus);
                    col = mix(col, mosaic * 0.25 + spaceCol * 0.12, 0.35 + focus * 0.25);
                    alpha = 0.78;
                }

                col += uBone.rgb * faceBevel(vUv, focus) * 0.28;

                if (gstr > 0.01) {
                    float rimRgb = uGlitchRgb * gstr;
                    col.r += rimRgb * 0.04;
                    col.b += rimRgb * 0.05;
                }

                col = mix(uInk.rgb * 0.42, col, mix(0.72, 1.0, focus) * uContentCollapse);
                alpha *= mix(1.0, uBackdropDim, focus * 0.35);
                if (uMobilePortrait > 0.5) {
                    alpha = mix(alpha * 0.55, alpha, focus);
                }

                gl_FragColor = vec4(col, alpha);
            }
        `
    });
}

export function createSlabGlowMaterial() {
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uBone: { value: new THREE.Color(0xece8df) },
            uSignal: { value: new THREE.Color(0xc6ff00) }
        },
        vertexShader: `
            attribute float aFocus;
            varying float vFocus;
            void main() {
                vFocus = aFocus;
                gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 uBone;
            uniform vec3 uSignal;
            varying float vFocus;
            void main() {
                float focus = clamp(vFocus, 0.0, 1.0);
                float a = 0.06 + focus * 0.14;
                vec3 col = mix(uBone, uSignal, focus * 0.12);
                gl_FragColor = vec4(col, a);
            }
        `
    });
}
