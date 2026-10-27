/**
 * Monitor-wall slab shader — grid of atlas cells, one draw call.
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
            uInk: { value: new THREE.Color(0x0a0a0a) },
            uBone: { value: new THREE.Color(0xece8df) },
            uReduced: { value: reducedMotion ? 1 : 0 },
            uBackdropDim: { value: 1 },
            uAtlas: { value: null },
            uAtlasReady: { value: 0 },
            uContentCollapse: { value: 1 },
            uMonitorGrid: { value: new THREE.Vector2(8, 5) },
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
            uniform vec3 uInk;
            uniform vec3 uBone;
            uniform float uReduced;
            uniform float uBackdropDim;
            uniform sampler2D uAtlas;
            uniform float uAtlasReady;
            uniform float uContentCollapse;
            uniform vec2 uMonitorGrid;
            uniform float uMobilePortrait;

            varying float vFocus;
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            varying vec2 vUv;
            varying vec4 vAtlasRect;

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }

            vec3 sampleAtlasCell(vec2 cellId, vec2 cellUv) {
                vec2 grid = uMonitorGrid;
                vec2 atlasUv = mix(vAtlasRect.xy, vAtlasRect.zw, (cellId + cellUv) / grid);
                return texture2D(uAtlas, atlasUv).rgb;
            }

            void main() {
                float focus = clamp(vFocus, 0.0, 1.0);
                vec3 N = normalize(vNormal);
                vec3 V = normalize(uCameraPos - vWorldPos);
                float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.2);

                vec2 grid = uMonitorGrid;
                vec2 cellId = floor(vUv * grid);
                vec2 cellUv = fract(vUv * grid);
                float inset = 0.08;
                float inBezel = step(inset, cellUv.x) * step(cellUv.x, 1.0 - inset) *
                    step(inset, cellUv.y) * step(cellUv.y, 1.0 - inset);
                inBezel = 1.0 - inBezel;

                vec3 glassBase = mix(uInk * 0.55, uBone, 0.12 + fresnel * 0.38);
                vec3 bezelCol = glassBase * (0.52 + 0.08 * hash(cellId));
                vec3 screenCol = bezelCol;

                if (inBezel < 0.5 && uAtlasReady > 0.5) {
                    vec2 sampleUv = (cellUv - inset) / (1.0 - 2.0 * inset);
                    screenCol = sampleAtlasCell(cellId, sampleUv);
                    float flickerGate = hash(cellId + 17.0);
                    if (uReduced < 0.5 && focus > 0.2 && flickerGate > 0.992) {
                        float t = mod(uTime + hash(cellId) * 6.0, 0.18);
                        if (t < 0.04) {
                            screenCol = mix(screenCol, vec3(0.85), 0.6);
                        } else if (t < 0.08) {
                            screenCol = vec3(hash(cellUv + uTime));
                        }
                    }
                    float bright = mix(0.5, 1.05, focus);
                    screenCol *= bright;
                } else if (inBezel > 0.5) {
                    bezelCol = mix(bezelCol, uBone * 0.12, fresnel * (0.35 + focus * 0.25));
                }

                vec3 base = mix(screenCol, bezelCol, inBezel);
                base += uBone * fresnel * (0.04 + focus * 0.06);
                float atlasMix = focus * uContentCollapse;
                base = mix(uInk * 0.35, base, atlasMix);

                float spec = pow(max(dot(reflect(-V, N), V), 0.0), 28.0) * (0.12 + focus * 0.18);
                base += uBone * spec;

                float alpha = 0.38 + fresnel * 0.34 + focus * 0.08;
                alpha *= mix(1.0, uBackdropDim, focus);
                if (uMobilePortrait > 0.5) {
                    alpha *= mix(0.3, 1.0, focus);
                }

                gl_FragColor = vec4(base, alpha);
            }
        `
    });
}
