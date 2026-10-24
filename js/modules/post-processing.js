/**
 * Post-processing ON DEMAND — composer built lazily (first card open / chaos).
 */

import { Utils } from './utils.js';

export class PostProcessing {
    constructor(renderer, scene, camera, options = {}) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.reducedMotion = options.reducedMotion ?? false;
        this.datamoshAllowed = true;

        this.composer = null;
        this.composerActive = false;
        this.passes = {};
        this.previousFrameTarget = null;
        this.composerScale = 0.5;
        this.readyPromise = null;

        this.intensity = 0;
        this.rgbAmount = 0;
        this.datamosh = 0;
        this.decayUntil = 0;
        this.novaProgress = 0;
        this.novaUntil = 0;
    }

    async ensureComposer() {
        if (this.composer) return;
        if (!this.readyPromise) {
            this.readyPromise = this.buildComposer();
        }
        return this.readyPromise;
    }

    async buildComposer() {
        const three = await import('three');
        const { WebGLRenderTarget } = three;
        const { EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js');
        const { RenderPass } = await import('three/addons/postprocessing/RenderPass.js');
        const { ShaderPass } = await import('three/addons/postprocessing/ShaderPass.js');
        const { OutputPass } = await import('three/addons/postprocessing/OutputPass.js');
        const { UberGlitchShader } = await import('../shaders/uber-glitch.js');
        const { DatamoshShader } = await import('../shaders/datamosh.js');

        this.composer = new EffectComposer(this.renderer);
        this.passes.render = new RenderPass(this.scene, this.camera);
        this.composer.addPass(this.passes.render);

        this.passes.uberGlitch = new ShaderPass(UberGlitchShader);
        this.passes.uberGlitch.uniforms.seed.value = Math.random();
        this.composer.addPass(this.passes.uberGlitch);

        this.previousFrameTarget = new WebGLRenderTarget(16, 16);
        this.passes.datamosh = new ShaderPass(DatamoshShader);
        this.passes.datamosh.uniforms.tPrevious.value = this.previousFrameTarget.texture;
        this.passes.datamosh.enabled = false;
        this.composer.addPass(this.passes.datamosh);

        const { NovaPassShader } = await import('../shaders/nova-pass.js');
        this.passes.nova = new ShaderPass(NovaPassShader);
        this.passes.nova.enabled = false;
        this.composer.addPass(this.passes.nova);

        this.passes.output = new OutputPass();
        this.composer.addPass(this.passes.output);

        this.setComposerSize(window.innerWidth, window.innerHeight);
        this.disableComposer();
    }

    setComposerSize(w, h) {
        if (!this.composer) return;
        const sw = Math.max(2, Math.floor(w * this.composerScale));
        const sh = Math.max(2, Math.floor(h * this.composerScale));
        this.composer.setSize(sw, sh);
        this.previousFrameTarget?.setSize(sw, sh);
    }

    enableComposer() {
        this.composerActive = true;
    }

    disableComposer() {
        this.composerActive = false;
        this.intensity = 0;
        this.rgbAmount = 0;
        this.datamosh = 0;
        if (this.passes.datamosh) this.passes.datamosh.enabled = false;
    }

    applyReducedMotion(reduced) {
        this.reducedMotion = reduced;
        if (reduced) this.disableComposer();
    }

    setDatamoshAllowed(allowed) {
        this.datamoshAllowed = allowed;
        if (!allowed && this.passes.datamosh) this.passes.datamosh.enabled = false;
    }

    update(time, dt = 0.016) {
        if (this.novaUntil > 0 && performance.now() > this.novaUntil) {
            this.clearNova();
            if (this.intensity <= 0) this.disableComposer();
        }

        if (this.passes.nova?.enabled) {
            this.passes.nova.uniforms.uProgress.value = this.novaProgress;
        }

        if (this.decayUntil > 0 && performance.now() > this.decayUntil) {
            this.intensity = Utils.lerp(this.intensity, 0, 0.15);
            this.rgbAmount = Utils.lerp(this.rgbAmount, 0, 0.15);
            if (this.intensity < 0.005 && this.rgbAmount < 0.001) {
                this.disableComposer();
                this.decayUntil = 0;
            }
        }

        if (!this.composerActive || !this.composer) return;

        this.passes.uberGlitch.uniforms.time.value = time;
        this.passes.uberGlitch.uniforms.intensity.value = this.intensity;
        this.passes.uberGlitch.uniforms.rgbAmount.value = this.rgbAmount;

        if (this.passes.datamosh.enabled) {
            this.passes.datamosh.uniforms.time.value = time;
            this.passes.datamosh.uniforms.amount.value = this.datamosh;
        }
    }

    render() {
        const novaOn = this.passes?.nova?.enabled && this.novaProgress > 0;
        if (!this.composerActive || !this.composer || (this.intensity <= 0 && !novaOn)) {
            this.renderer.render(this.scene, this.camera);
            return;
        }

        if (this.passes.datamosh.enabled) {
            this.renderer.setRenderTarget(this.previousFrameTarget);
            this.renderer.render(this.scene, this.camera);
            this.renderer.setRenderTarget(null);
        }
        this.composer.render();
    }

    isComposerActive() {
        return (
            this.composerActive &&
            !!this.composer &&
            (this.intensity > 0 || this.novaProgress > 0 || this.passes?.nova?.enabled)
        );
    }

    clearNova() {
        this.novaProgress = 0;
        this.novaUntil = 0;
        if (this.passes?.nova) {
            this.passes.nova.enabled = false;
            this.passes.nova.uniforms.uProgress.value = 0;
        }
    }

    fireNova(progress = 0.5, center = [0.5, 0.5]) {
        if (this.reducedMotion) return;
        this.novaProgress = progress;
        this.novaUntil = performance.now() + 220;
        this.ensureComposer().then(() => {
            this.enableComposer();
            if (this.passes.nova) {
                this.passes.nova.enabled = true;
                this.passes.nova.uniforms.uProgress.value = progress;
                this.passes.nova.uniforms.uCenter.value = center;
            }
        });
    }

    transitionBurst(intensity = 0.6, duration = 200) {
        if (this.reducedMotion) return;
        this.ensureComposer().then(() => {
            this.enableComposer();
            this.intensity = intensity;
            this.rgbAmount = intensity * 0.045;
            if (this.datamoshAllowed) {
                this.datamosh = 0.35;
                this.passes.datamosh.enabled = true;
                setTimeout(() => {
                    this.passes.datamosh.enabled = false;
                    this.datamosh = 0;
                }, duration);
            }
            this.decayUntil = performance.now() + duration + 120;
        });
    }

    chaosMode(duration = 2000) {
        if (this.reducedMotion) return;
        this.ensureComposer().then(() => {
            this.enableComposer();
            this.intensity = 0.8;
            this.rgbAmount = 0.04;
            if (this.datamoshAllowed) {
                this.datamosh = 0.7;
                this.passes.datamosh.enabled = true;
            }
            this.decayUntil = performance.now() + duration;
            setTimeout(() => {
                this.passes.datamosh.enabled = false;
                this.datamosh = 0;
            }, duration);
        });
    }

    resize(width, height) {
        this.renderer.setSize(width, height);
        this.setComposerSize(width, height);
    }

    getPassCount() {
        return this.isComposerActive() ? this.composer.passes.length : 0;
    }
}
