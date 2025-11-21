/**
 * POST-PROCESSING.JS
 * Manages the entire post-processing pipeline with custom shaders
 */

class PostProcessing {
    constructor(renderer, scene, camera, isMobile = false) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.isMobile = isMobile;
        
        this.composer = null;
        
        this.passes = {
            render: null,
            glitch: null,
            rgbShift: null,
            datamosh: null
        };
        
        // Reduce intensity on mobile for better performance
        this.intensities = {
            glitch: isMobile ? 0.03 : 0.05,
            rgbShift: isMobile ? 0.003 : 0.005,
            datamosh: 0.0
        };
        
        this.previousFrameTarget = null;
        
        this.init();
    }
    
    init() {
        if (typeof THREE.EffectComposer === 'undefined') {
            console.warn('EffectComposer not found, loading from CDN...');
            this.loadPostProcessingScripts();
            return;
        }
        
        this.setup();
    }
    
    loadPostProcessingScripts() {
        // Use working version and add timeout/error handling for mobile
        const scripts = [
            'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/postprocessing/EffectComposer.js',
            'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/postprocessing/RenderPass.js',
            'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/postprocessing/ShaderPass.js',
            'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/shaders/CopyShader.js'
        ];
        
        let loaded = 0;
        let failed = false;
        const timeout = setTimeout(() => {
            if (!failed && loaded < scripts.length) {
                console.warn('Post-processing scripts timeout, falling back to basic rendering');
                failed = true;
                this.setupFallback();
            }
        }, 10000); // 10 second timeout for mobile
        
        scripts.forEach(src => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                if (failed) return;
                loaded++;
                if (loaded === scripts.length) {
                    clearTimeout(timeout);
                    setTimeout(() => this.setup(), 100);
                }
            };
            script.onerror = () => {
                console.error('Failed to load post-processing script:', src);
                if (loaded === 0) {
                    clearTimeout(timeout);
                    failed = true;
                    this.setupFallback();
                }
            };
            document.head.appendChild(script);
        });
    }
    
    setupFallback() {
        console.warn('Using fallback rendering without post-processing');
        this.composer = null;
    }
    
    setup() {
        this.composer = new THREE.EffectComposer(this.renderer);
        
        this.passes.render = new THREE.RenderPass(this.scene, this.camera);
        this.composer.addPass(this.passes.render);
        
        this.passes.glitch = new THREE.ShaderPass(GlitchShader);
        this.passes.glitch.uniforms.seed.value = Math.random();
        this.composer.addPass(this.passes.glitch);
        
        this.passes.rgbShift = new THREE.ShaderPass(RGBShiftShader);
        this.composer.addPass(this.passes.rgbShift);
        
        this.previousFrameTarget = new THREE.WebGLRenderTarget(
            window.innerWidth,
            window.innerHeight
        );
        
        this.passes.datamosh = new THREE.ShaderPass(DatamoshShader);
        this.passes.datamosh.uniforms.tPrevious.value = this.previousFrameTarget.texture;
        this.passes.datamosh.enabled = false;
        this.composer.addPass(this.passes.datamosh);
        
        const finalPass = new THREE.ShaderPass(THREE.CopyShader);
        finalPass.renderToScreen = true;
        this.composer.addPass(finalPass);
        
        console.log('Post-processing initialized with', this.composer.passes.length, 'passes');
    }
    
    update(time) {
        if (!this.composer) return;
        
        if (this.passes.glitch) {
            this.passes.glitch.uniforms.time.value = time;
            this.passes.glitch.uniforms.amount.value = this.intensities.glitch;
        }
        
        if (this.passes.rgbShift) {
            this.passes.rgbShift.uniforms.amount.value = this.intensities.rgbShift;
            this.passes.rgbShift.uniforms.angle.value = Math.sin(time * 0.5) * Math.PI;
        }
        
        if (this.passes.datamosh && this.passes.datamosh.enabled) {
            this.passes.datamosh.uniforms.time.value = time;
            this.passes.datamosh.uniforms.amount.value = this.intensities.datamosh;
        }
    }
    
    render() {
        if (!this.composer) {
            this.renderer.render(this.scene, this.camera);
            return;
        }
        
        this.composer.render();
        
        if (this.passes.datamosh && this.passes.datamosh.enabled) {
            this.renderer.setRenderTarget(this.previousFrameTarget);
            this.renderer.render(this.scene, this.camera);
            this.renderer.setRenderTarget(null);
        }
    }
    
    setIntensity(effect, value) {
        if (this.intensities.hasOwnProperty(effect)) {
            this.intensities[effect] = Utils.clamp(value, 0, 1);
        }
    }
    
    getIntensity(effect) {
        return this.intensities[effect] || 0;
    }
    
    chaosMode(duration = 1000) {
        const original = { ...this.intensities };
        
        this.intensities.glitch = 0.8;
        this.intensities.rgbShift = 0.03;
        this.intensities.datamosh = 0.7;
        
        if (this.passes.datamosh) {
            this.passes.datamosh.enabled = true;
        }
        
        setTimeout(() => {
            this.intensities = original;
            if (this.passes.datamosh) {
                this.passes.datamosh.enabled = false;
            }
        }, duration);
    }
    
    burst(intensity = 0.5, duration = 200) {
        const originalGlitch = this.intensities.glitch;
        this.intensities.glitch = intensity;
        
        setTimeout(() => {
            this.intensities.glitch = originalGlitch;
        }, duration);
    }
    
    resize(width, height) {
        if (this.composer) {
            this.composer.setSize(width, height);
        }
        
        if (this.previousFrameTarget) {
            this.previousFrameTarget.setSize(width, height);
        }
    }
    
    getPassCount() {
        return this.composer ? this.composer.passes.length : 0;
    }
}

window.PostProcessing = PostProcessing;
