/**
 * About floor — inner-sphere text crawl (WebGL), lazy-loaded.
 */

import * as THREE from 'three';
import { createAboutBandMaterial } from '../shaders/about-sphere-band.js';
import { rasterizeAboutCopy } from './about-text-texture.js';

const R = 5;
const LOOP_SEC = 65;

export class AboutSphere {
    /**
     * @param {THREE.Scene} scene
     * @param {{ reducedMotion?: boolean, onFirstLoopComplete?: () => void }} options
     */
    constructor(scene, options = {}) {
        this.scene = scene;
        this.reducedMotion = options.reducedMotion ?? false;
        this.onFirstLoopComplete = options.onFirstLoopComplete ?? (() => {});

        this.group = new THREE.Group();
        this.group.visible = false;
        scene.add(this.group);

        this.scroll = 0;
        this.autoScroll = true;
        this.paused = false;
        this.resumeTimer = null;
        this.firstLoopDone = false;
        this.copy = { byline: '', paragraphs: [] };
        this.breakpointKey = '';

        this._buildPlaceholder();
    }

    _breakpointKey() {
        const mp = window.innerWidth < 768 && window.innerHeight > window.innerWidth;
        return mp ? 'mp' : 'desk';
    }

    _buildPlaceholder() {
        const geo = new THREE.SphereGeometry(R, 48, 32, 0, Math.PI * 2, 0, Math.PI);
        const mat = new THREE.MeshBasicMaterial({ visible: false });
        this.bandMesh = new THREE.Mesh(geo, mat);
        this.group.add(this.bandMesh);
    }

    setCopy(copy) {
        this.copy = copy;
        this._rebuildTexture();
    }

    _rebuildTexture() {
        const key = this._breakpointKey();
        if (key === this.breakpointKey && this.texture) return;
        this.breakpointKey = key;

        const mobilePortrait = key === 'mp';
        const { canvas } = rasterizeAboutCopy({
            ...this.copy,
            mobilePortrait
        });

        if (this.texture) this.texture.dispose();
        this.texture = new THREE.CanvasTexture(canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.minFilter = THREE.LinearMipmapLinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.generateMipmaps = true;
        this.texture.needsUpdate = true;

        if (this.bandMaterial) this.bandMaterial.dispose();
        this.bandMaterial = createAboutBandMaterial(this.texture, this.reducedMotion);

        const hBand = (52 * Math.PI) / 180;
        const phiStart = Math.PI / 2 - hBand;
        const phiLen = hBand * 2;
        if (this.bandMesh.geometry) this.bandMesh.geometry.dispose();
        this.bandMesh.geometry = new THREE.SphereGeometry(
            R * 0.998,
            64,
            64,
            phiStart,
            phiLen,
            0,
            Math.PI
        );
        this.bandMesh.material = this.bandMaterial;

        if (this.gridMesh) {
            this.gridMesh.geometry.dispose();
            this.gridMesh.material.dispose();
            this.group.remove(this.gridMesh);
        }
        const gridGeo = new THREE.SphereGeometry(R, 24, 16);
        const gridMat = new THREE.MeshBasicMaterial({
            color: 0xece8df,
            wireframe: true,
            transparent: true,
            opacity: 0.07,
            depthWrite: false
        });
        this.gridMesh = new THREE.Mesh(gridGeo, gridMat);
        this.group.add(this.gridMesh);
    }

    setVisible(visible) {
        this.group.visible = visible;
        if (visible) {
            this._rebuildTexture();
            this.renderLoopPing?.();
        }
    }

    setDim(dim) {
        if (this.bandMaterial) this.bandMaterial.uniforms.uDim.value = dim;
    }

    bindRenderLoopPing(fn) {
        this.renderLoopPing = fn;
    }

    onWheel(deltaY) {
        if (this.paused) this.paused = false;
        this.autoScroll = false;
        clearTimeout(this.resumeTimer);
        this.scroll = (this.scroll + deltaY * 0.00035) % 1;
        if (this.scroll < 0) this.scroll += 1;
        this._syncUniforms();
        this.resumeTimer = setTimeout(() => {
            this.autoScroll = true;
        }, 2000);
        return true;
    }

    onTapTogglePause() {
        this.paused = !this.paused;
        this.renderLoopPing?.();
    }

    update(dt, time, camera, parallax = { x: 0, y: 0 }) {
        if (!this.group.visible || !this.bandMaterial) return;

        if (this._breakpointKey() !== this.breakpointKey) this._rebuildTexture();

        if (!this.paused && this.autoScroll && !this.reducedMotion) {
            this.scroll = (this.scroll + dt / LOOP_SEC) % 1;
            if (!this.firstLoopDone && this.scroll > 0.98) {
                this.firstLoopDone = true;
                this.onFirstLoopComplete();
            }
        }

        this._syncUniforms(time);

        const px = parallax.x * 0.15;
        const py = parallax.y * 0.1;
        camera.fov = 62;
        camera.updateProjectionMatrix();
        camera.position.set(px * 0.35, 0.12 + py * 0.25, px * 0.15 + 0.35);
        camera.lookAt(px * 0.25, -0.35 + py * 0.35, -4.2);
    }

    _syncUniforms(time = 0) {
        if (!this.bandMaterial) return;
        this.bandMaterial.uniforms.uScroll.value = this.scroll;
        this.bandMaterial.uniforms.uTime.value = time;
    }

    resetScroll() {
        this.scroll = 0;
        this.firstLoopDone = false;
        this._syncUniforms();
    }

    dispose() {
        clearTimeout(this.resumeTimer);
        if (this.texture) this.texture.dispose();
        if (this.bandMaterial) this.bandMaterial.dispose();
        this.bandMesh?.geometry?.dispose();
        this.gridMesh?.geometry?.dispose();
        this.gridMesh?.material?.dispose();
        this.scene.remove(this.group);
    }
}
