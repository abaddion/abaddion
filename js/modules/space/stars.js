/**
 * Directional star dome — rotates with camera only (no world translation / parallax slide).
 */

const STAR_VERT = `
attribute vec3 aDirection;
attribute float aSeed;

uniform float uTime;
uniform float uPixelRatio;
uniform float uTwinkle;
uniform float uReduced;

varying float vAlpha;
varying vec3 vColor;

float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    return fract(p * p);
}

void main() {
    vec3 dir = normalize(aDirection);
    vec3 eye = normalize(mat3(viewMatrix) * dir);
    if (eye.z >= -0.0001) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        gl_PointSize = 0.0;
        return;
    }

    vec4 clip = projectionMatrix * vec4(eye, 0.0);
    gl_Position = vec4(clip.xy / max(clip.w, 1e-4), clip.w - 1e-3, clip.w);

    float hue = hash11(aSeed);
    float bright = pow(hash11(aSeed + 17.0), 8.0);
    vec3 base = vec3(0.925, 0.908, 0.871);
    if (hue < 0.12) base = vec3(0.88, 0.92, 1.0);
    else if (hue > 0.94) base = vec3(1.0, 0.92, 0.82);
    vColor = base * (0.4 + bright * 1.15);

    float tw = 1.0;
    float t = mod(uTime, 1000.0);
    if (uTwinkle > 0.5 && uReduced < 0.5 && hash11(aSeed + 4.0) < 0.22) {
        float phase = hash11(aSeed + 9.0);
        float wave = abs(fract(t * 0.13 + phase) * 2.0 - 1.0);
        tw = 0.86 + 0.14 * wave;
    }
    vAlpha = clamp(bright * 1.2 * tw, 0.08, 1.0);

    float px = mix(1.0, 2.2, step(0.992, hue));
    gl_PointSize = min(4.0, px * uPixelRatio);
}
`;

const STAR_FRAG = `
precision highp float;
varying float vAlpha;
varying vec3 vColor;

void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = 1.0 - smoothstep(0.22, 0.5, d);
    gl_FragColor = vec4(vColor, vAlpha * core);
}
`;

export function resolveStarCount({ isMobile, dpr }) {
    if (dpr <= 1.05) return 1800;
    if (isMobile) return 3200;
    return 5200;
}

export class StarField {
    constructor(THREE, scene, options = {}) {
        this.THREE = THREE;
        this.reducedMotion = options.reducedMotion ?? false;
        this.count = options.count ?? 3000;
        this.group = new THREE.Group();
        this.group.name = 'starfield';
        this.group.renderOrder = -2000;
        scene.add(this.group);

        const directions = new Float32Array(this.count * 3);
        const seeds = new Float32Array(this.count);

        for (let i = 0; i < this.count; i++) {
            const u = Math.random();
            const v = Math.random();
            const theta = 2 * Math.PI * u;
            const phi = Math.acos(2 * v - 1);
            directions[i * 3] = Math.sin(phi) * Math.cos(theta);
            directions[i * 3 + 1] = Math.cos(phi);
            directions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta);
            seeds[i] = Math.random();
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('aDirection', new THREE.BufferAttribute(directions, 3));
        geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

        this.material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
            uniforms: {
                uTime: { value: 0 },
                uPixelRatio: { value: 1 },
                uTwinkle: { value: 1 },
                uReduced: { value: this.reducedMotion ? 1 : 0 }
            },
            vertexShader: STAR_VERT,
            fragmentShader: STAR_FRAG
        });

        this.points = new THREE.Points(geo, this.material);
        this.points.frustumCulled = false;
        this.points.renderOrder = -2000;
        this.group.add(this.points);
    }

    setPixelRatio(dpr) {
        this.material.uniforms.uPixelRatio.value = Math.min(dpr, 2);
    }

    setCorridorMode(active) {
        this.material.uniforms.uTwinkle.value = active ? 0 : 1;
    }

    setReducedMotion(reduced) {
        this.reducedMotion = reduced;
        this.material.uniforms.uReduced.value = reduced ? 1 : 0;
        if (reduced) this.material.uniforms.uTwinkle.value = 0;
    }

    update(time, _parallax, { twinkleAllowed = true } = {}) {
        this.material.uniforms.uTime.value = time;
        if (!twinkleAllowed) this.material.uniforms.uTwinkle.value = 0;
    }

    dispose() {
        this.points.geometry.dispose();
        this.material.dispose();
        this.group.removeFromParent();
    }
}
