/**
 * About floor — inner-sphere text crawl (WebGL), lazy-loaded.
 * Band: vertical great circle facing −Z (meridian), scroll along phi.
 */

import * as THREE from 'three';
import { createAboutBandMaterial } from '../shaders/about-sphere-band.js';
import { rasterizeAboutCopy } from './about-text-texture.js';

const R = 5;
const LOOP_SEC_DEFAULT = 78;
const LOOP_SEC_SHORT = 14;

/** @returns {number} Full crawl loop duration (seconds); `?loop=short` for preview QA */
export function resolveAboutLoopSeconds(location = globalThis.location) {
    const flag = (new URLSearchParams(location?.search ?? '').get('loop') ?? '').toLowerCase();
    return flag === 'short' ? LOOP_SEC_SHORT : LOOP_SEC_DEFAULT;
}
const THETA_CENTER = Math.PI * 1.5;
const H_BAND_DESK = (35 * Math.PI) / 180;
const H_BAND_MOBILE = (26 * Math.PI) / 180;

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
        this.loopSec = resolveAboutLoopSeconds();
        this.copy = { byline: '', paragraphs: [] };
        this.breakpointKey = '';

        this._buildPlaceholder();
    }

    _breakpointKey() {
        const mp = window.innerWidth < 768 && window.innerHeight > window.innerWidth;
        return mp ? 'mp' : 'desk';
    }

    _buildPlaceholder() {
        const geo = new THREE.SphereGeometry(R, 8, 8, 0, Math.PI, THETA_CENTER - 0.1, 0.2);
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

        const hBand = mobilePortrait ? H_BAND_MOBILE : H_BAND_DESK;
        if (this.bandMesh.geometry) this.bandMesh.geometry.dispose();
        this.bandMesh.geometry = new THREE.SphereGeometry(
            R * 0.998,
            32,
            128,
            0,
            Math.PI,
            THETA_CENTER - hBand,
            hBand * 2
        );
        this.bandMesh.material = this.bandMaterial;

        if (this.gridMesh) {
            this.gridMesh.geometry.dispose();
            this.gridMesh.material.dispose();
            this.group.remove(this.gridMesh);
        }
        const gridGeo = new THREE.SphereGeometry(R, 28, 18);
        const gridMat = new THREE.MeshBasicMaterial({
            color: 0xece8df,
            wireframe: true,
            transparent: true,
            opacity: 0.06,
            depthWrite: false,
            side: THREE.BackSide
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
        this.scroll = (this.scroll + deltaY * 0.0004) % 1;
        if (this.scroll < 0) this.scroll += 1;
        this._syncUniforms();
        this.resumeTimer = setTimeout(() => {
            this.autoScroll = true;
        }, 2000);
        this.renderLoopPing?.();
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
            this.loopSec = resolveAboutLoopSeconds();
            this.scroll = (this.scroll + dt / this.loopSec) % 1;
            if (!this.firstLoopDone && this.scroll > 0.98) {
                this.firstLoopDone = true;
                this.onFirstLoopComplete();
            }
        }

        this._syncUniforms(time);

        const mobilePortrait = this.breakpointKey === 'mp';
        const px = parallax.x * (mobilePortrait ? 0.12 : 0.15);
        const py = parallax.y * (mobilePortrait ? 0.08 : 0.1);

        camera.fov = mobilePortrait ? 66 : 58;
        camera.updateProjectionMatrix();
        camera.position.set(
            px * 0.35,
            (mobilePortrait ? 0.2 : 0.12) + py * 0.25,
            (mobilePortrait ? 0.12 : 0.2) + px * 0.1
        );
        camera.lookAt(px * 0.25, mobilePortrait ? -0.12 : -0.28, -3.8);
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
