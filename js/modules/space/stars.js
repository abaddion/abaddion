/**
 * One Points star layer — power-law brightness, shells, twinkle, parallax.
 */

const STAR_VERT = `
attribute float aSeed;
attribute float aShell;

uniform float uTime;
uniform float uPixelRatio;
uniform vec2 uParallax;
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
    float t = mod(uTime, 1000.0);
    float shellW = aShell < 0.5 ? 0.02 : (aShell < 1.5 ? 0.06 : 0.15);
    vec3 pos = position;
    pos.x += uParallax.x * shellW * (uReduced < 0.5 ? 1.0 : 0.0);
    pos.y += uParallax.y * shellW * (uReduced < 0.5 ? 1.0 : 0.0);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float hue = hash11(aSeed);
    float bright = pow(hash11(aSeed + 17.0), 7.0);
    float hero = step(0.97, hue);
    bright = mix(bright, 0.85, hero * 0.35);
    vec3 base = vec3(0.925, 0.908, 0.871);
    if (hue < 0.15) base = vec3(0.88, 0.92, 1.0);
    else if (hue > 0.92) base = vec3(1.0, 0.92, 0.82);
    vColor = base * (0.35 + bright * 1.4);

    float tw = 1.0;
    if (uTwinkle > 0.5 && uReduced < 0.5 && hash11(aSeed + 4.0) < 0.3) {
        float phase = hash11(aSeed + 9.0);
        float wave = abs(fract(t * 0.11 + phase) * 2.0 - 1.0);
        tw = 0.82 + 0.18 * wave;
    }
    vAlpha = bright * tw;

    float dist = max(0.001, -mv.z);
    float px = mix(1.0, 4.5, hero);
    float size = px * uPixelRatio * (280.0 / dist);
    size = clamp(size, 1.0, 64.0);
    gl_PointSize = size;
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
    float soft = smoothstep(0.5, 0.12, d);
    gl_FragColor = vec4(vColor, vAlpha * soft);
}
`;

export function resolveStarCount({ isMobile, dpr }) {
    if (dpr <= 1.05) return 1500;
    if (isMobile) return 3000;
    return 5000;
}

export class StarField {
    constructor(THREE, scene, options = {}) {
        this.THREE = THREE;
        this.reducedMotion = options.reducedMotion ?? false;
        this.count = options.count ?? 3000;
        this.group = new THREE.Group();
        this.group.name = 'starfield';
        this.group.renderOrder = -1000;
        scene.add(this.group);

        const seeds = new Float32Array(this.count);
        const shells = new Float32Array(this.count);
        const bases = new Float32Array(this.count * 3);

        for (let i = 0; i < this.count; i++) {
            const seed = Math.random();
            seeds[i] = seed;
            const shell = i % 3;
            shells[i] = shell;
            const r = 55 + shell * 18 + seed * 22;
            const theta = seed * Math.PI * 2 * 997.0;
            const phi = Math.acos(2 * hash01(seed + 1.7) - 1) * 0.55 + 0.35;
            bases[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            bases[i * 3 + 1] = r * Math.cos(phi) * 0.35 + 4;
            bases[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(bases, 3));
        geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
        geo.setAttribute('aShell', new THREE.BufferAttribute(shells, 1));

        this.material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            depthTest: true,
            blending: THREE.AdditiveBlending,
            uniforms: {
                uTime: { value: 0 },
                uPixelRatio: { value: 1 },
                uParallax: { value: new THREE.Vector2() },
                uTwinkle: { value: 1 },
                uReduced: { value: this.reducedMotion ? 1 : 0 }
            },
            vertexShader: STAR_VERT,
            fragmentShader: STAR_FRAG
        });

        this.points = new THREE.Points(geo, this.material);
        this.points.frustumCulled = false;
        this.group.add(this.points);
    }

    setPixelRatio(dpr) {
        this.material.uniforms.uPixelRatio.value = dpr;
    }

    setCorridorMode(active) {
        this.material.uniforms.uTwinkle.value = active ? 0 : 1;
    }

    setReducedMotion(reduced) {
        this.reducedMotion = reduced;
        this.material.uniforms.uReduced.value = reduced ? 1 : 0;
        if (reduced) this.material.uniforms.uTwinkle.value = 0;
    }

    update(time, parallax, { twinkleAllowed = true } = {}) {
        this.material.uniforms.uTime.value = time;
        if (this.reducedMotion) return;
        this.material.uniforms.uParallax.value.set(parallax.x, parallax.y);
        if (!twinkleAllowed) this.material.uniforms.uTwinkle.value = 0;
    }

    dispose() {
        this.points.geometry.dispose();
        this.material.dispose();
        this.group.removeFromParent();
    }
}

function hash01(x) {
    const h = ((x * 9301 + 49297) % 233280) / 233280;
    return h < 0 ? h + 1 : h;
}
