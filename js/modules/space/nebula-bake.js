/**
 * Bake fbm nebula once (RGBA8), draw each frame with gain + vignette + dither.
 */

const INK = 0x0a0a0a;
const BONE = 0xece8df;
const SIGNAL = 0xc6ff00;

const BAKE_VERT = `
void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BAKE_FRAG = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uInk;
uniform vec3 uBone;
uniform vec3 uAccent;

float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.55;
    mat2 rot = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 5; i++) {
        v += a * vnoise(p);
        p = rot * p;
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec2 p = uv * vec2(1.8, 1.0);
    float n = fbm(p + vec2(0.04, 0.07));
    float band = fbm(p * 0.6 + 3.1);
    vec3 col = uInk / 255.0;
    col += uBone / 255.0 * (0.11 * n + 0.05 * band);
    col += uAccent / 255.0 * (0.09 * smoothstep(0.45, 0.88, n) * smoothstep(0.15, 0.85, uv.x));
    gl_FragColor = vec4(col, 1.0);
}
`;

const SCREEN_VERT = `
void main() {
    gl_Position = vec4(position.xy, 0.999, 1.0);
}
`;

const SCREEN_FRAG = `
precision highp float;
uniform sampler2D uNebula;
uniform sampler2D uBlueNoise;
uniform vec2 uResolution;
uniform float uGain;
uniform vec2 uParallax;

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec2 sampleUv = uv + uParallax * vec2(0.012, 0.008);
    sampleUv = clamp(sampleUv, 0.001, 0.999);
    vec3 col = texture2D(uNebula, sampleUv).rgb;
    float vig = smoothstep(1.05, 0.35, length(uv - 0.5) * 1.15);
    col *= mix(0.82, 1.0, vig);
    col *= uGain;
    float n = texture2D(uBlueNoise, fract(uv * uResolution / 64.0)).r;
    col += (n - 0.5) * (1.0 / 255.0);
    gl_FragColor = vec4(col, 1.0);
}
`;

function makeBlueNoiseTexture(THREE) {
    const size = 64;
    const data = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const h =
                ((x * 374761 + y * 668265) ^ (x * y * 982451)) & 0xffff;
            data[y * size + x] = Math.floor((h / 65535) * 255);
        }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RedFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
}

function bakeSize(aspect) {
    return aspect < 1 ? { w: 512, h: 1024 } : { w: 1024, h: 512 };
}

export class NebulaBackground {
    constructor(THREE, renderer) {
        this.THREE = THREE;
        this.renderer = renderer;
        this.gain = 1;
        this._portrait = null;
        this._target = null;
        this._nebulaTexture = null;
        this._blueNoise = makeBlueNoiseTexture(THREE);
        this._screenScene = new THREE.Scene();
        this._screenCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute(
            'position',
            new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)
        );
        this._screenMesh = new THREE.Mesh(
            geo,
            new THREE.ShaderMaterial({
                depthTest: false,
                depthWrite: false,
                uniforms: {
                    uNebula: { value: null },
                    uBlueNoise: { value: this._blueNoise },
                    uResolution: { value: new THREE.Vector2(1, 1) },
                    uGain: { value: 1 },
                    uParallax: { value: new THREE.Vector2() }
                },
                vertexShader: SCREEN_VERT,
                fragmentShader: SCREEN_FRAG
            })
        );
        this._screenScene.add(this._screenMesh);
    }

    async bake(aspect) {
        const THREE = this.THREE;
        const { w, h } = bakeSize(aspect);
        this._portrait = aspect < 1;

        if (this._target) this._target.dispose();
        this._target = new THREE.WebGLRenderTarget(w, h, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
            depthBuffer: false,
            stencilBuffer: false
        });

        const bakeScene = new THREE.Scene();
        const bakeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const bakeMat = new THREE.ShaderMaterial({
            uniforms: {
                uResolution: { value: new THREE.Vector2(w, h) },
                uTime: { value: 0 },
                uInk: { value: new THREE.Color(INK) },
                uBone: { value: new THREE.Color(BONE) },
                uAccent: { value: new THREE.Color(SIGNAL) }
            },
            vertexShader: BAKE_VERT,
            fragmentShader: BAKE_FRAG
        });
        const mesh = new THREE.Mesh(
            new THREE.BufferGeometry().setAttribute(
                'position',
                new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)
            ),
            bakeMat
        );
        bakeScene.add(mesh);

        const prevTarget = this.renderer.getRenderTarget();
        this.renderer.setRenderTarget(this._target);
        this.renderer.render(bakeScene, bakeCam);
        this.renderer.setRenderTarget(prevTarget);

        bakeMat.dispose();
        mesh.geometry.dispose();

        this._nebulaTexture = this._target.texture;
        this._screenMesh.material.uniforms.uNebula.value = this._nebulaTexture;
    }

    setGain(value) {
        this.gain = value;
        this._screenMesh.material.uniforms.uGain.value = value;
    }

  setParallax(x, y) {
        this._screenMesh.material.uniforms.uParallax.value.set(x * 0.15, y * 0.15);
    }

    resize(width, height) {
        this._screenMesh.material.uniforms.uResolution.value.set(width, height);
        const aspect = width / height;
        const portrait = aspect < 1;
        if (this._portrait === null || portrait !== this._portrait) {
            return this.bake(aspect);
        }
        return Promise.resolve();
    }

    async onContextRestored(aspect) {
        await this.bake(aspect);
    }

    render(renderer) {
        renderer.setRenderTarget(null);
        renderer.clear(true, false, false);
        renderer.render(this._screenScene, this._screenCam);
    }

    async compileAsync(renderer) {
        if (!renderer.compileAsync) return;
        await renderer.compileAsync(this._screenScene, this._screenCam);
    }

    dispose() {
        this._target?.dispose();
        this._blueNoise?.dispose();
        this._screenMesh.geometry.dispose();
        this._screenMesh.material.dispose();
    }
}
