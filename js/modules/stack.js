/**
 * Glass chess slabs — one InstancedMesh + under-glow (≤2 stack draw calls).
 */

import * as THREE from 'three';
import { createSlabMaterial, createSlabGlowMaterial, resolveSlabVariantFromUrl } from '../shaders/slab-material.js';

const SLAB_W = 4;
const SLAB_H = 0.14;
const SLAB_D = 3;
const FLOOR_GAP = 2.2;
const FLOOR_GAP_MOBILE_PORTRAIT = 2.85;
const FOCUS_LERP_MS = 400;

export class BoardStack {
    constructor(scene, floorCount = 5, options = {}) {
        this.scene = scene;
        this.floorCount = floorCount;
        this.reducedMotion = options.reducedMotion ?? false;
        this.focusIndex = 0;
        this.focusValues = new Float32Array(floorCount);
        this.focusTargets = new Float32Array(floorCount);
        this.openRotations = new Float32Array(floorCount);
        this.yRotations = new Float32Array(floorCount);
        this.floorYs = new Float32Array(floorCount);

        this.root = new THREE.Group();
        scene.add(this.root);

        const geometry = new THREE.BoxGeometry(SLAB_W, SLAB_H, SLAB_D);
        this.focusAttr = new THREE.InstancedBufferAttribute(this.focusValues, 1);
        geometry.setAttribute('aFocus', this.focusAttr);
        const floorIdx = new Float32Array(floorCount);
        for (let f = 0; f < floorCount; f++) floorIdx[f] = f;
        this.floorIdxAttr = new THREE.InstancedBufferAttribute(floorIdx, 1);
        geometry.setAttribute('aFloorIdx', this.floorIdxAttr);

        this.atlasRects = new Float32Array(floorCount * 4);
        for (let f = 0; f < floorCount; f++) {
            const o = f * 4;
            this.atlasRects[o] = 0;
            this.atlasRects[o + 1] = 1 - (f + 1) / floorCount;
            this.atlasRects[o + 2] = 1;
            this.atlasRects[o + 3] = 1 - f / floorCount;
        }
        this.atlasAttr = new THREE.InstancedBufferAttribute(this.atlasRects, 4);
        geometry.setAttribute('aAtlasRect', this.atlasAttr);

        this.material = createSlabMaterial(this.reducedMotion, resolveSlabVariantFromUrl());
        this.backdropDim = 1;
        this.slabs = new THREE.InstancedMesh(geometry, this.material, floorCount);
        this.slabs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        const glowGeo = new THREE.PlaneGeometry(SLAB_W * 1.08, SLAB_D * 1.08);
        glowGeo.rotateX(-Math.PI / 2);
        glowGeo.setAttribute('aFocus', new THREE.InstancedBufferAttribute(this.focusValues, 1));
        this.glowMaterial = createSlabGlowMaterial();
        this.glowMesh = new THREE.InstancedMesh(glowGeo, this.glowMaterial, floorCount);
        this.glowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.glowMesh.renderOrder = -2;

        const dummy = new THREE.Object3D();
        for (let f = 0; f < floorCount; f++) {
            const y = (floorCount - 1 - f) * FLOOR_GAP;
            this.floorYs[f] = y;
            this.yRotations[f] = f * 0.11;
            dummy.position.set(0, y, 0);
            dummy.rotation.set(0, this.yRotations[f], 0);
            dummy.updateMatrix();
            this.slabs.setMatrixAt(f, dummy.matrix);
            dummy.position.y = y - SLAB_H * 0.52;
            dummy.updateMatrix();
            this.glowMesh.setMatrixAt(f, dummy.matrix);
        }
        this.slabs.instanceMatrix.needsUpdate = true;
        this.glowMesh.instanceMatrix.needsUpdate = true;

        this.root.add(this.glowMesh, this.slabs);
        this.dummy = new THREE.Object3D();
        this.projectionBox = new THREE.Box3();
        this.setFocusedFloor(0, true);
        this.applyViewportLayout();
    }

    bindNebula(nebula) {
        const tex = nebula?.getNebulaTexture?.() ?? null;
        if (tex) {
            this.material.uniforms.uNebula.value = tex;
            this.material.uniforms.uNebulaReady.value = 1;
        }
    }

    setGlitchState({ strength = 0, tear = 0, rgb = 0, drop = 0, slab = -1 } = {}) {
        const u = this.material.uniforms;
        u.uGlitchStrength.value = strength;
        u.uGlitchTear.value = tear;
        u.uGlitchRgb.value = rgb;
        u.uGlitchDrop.value = drop;
        u.uGlitchSlab.value = slab;
    }

    getFloorGap() {
        const mobile = window.innerWidth < 768;
        const portrait = window.innerHeight > window.innerWidth;
        return mobile && portrait ? FLOOR_GAP_MOBILE_PORTRAIT : FLOOR_GAP;
    }

    applyViewportLayout() {
        const gap = this.getFloorGap();
        const mobile = window.innerWidth < 768;
        for (let f = 0; f < this.floorCount; f++) {
            this.floorYs[f] = (this.floorCount - 1 - f) * gap;
        }
        if (this.material.uniforms.uMobilePortrait) {
            this.material.uniforms.uMobilePortrait.value =
                mobile && window.innerHeight > window.innerWidth ? 1 : 0;
        }
    }

    setFocusedFloor(index, instant = false) {
        this.focusIndex = index;
        for (let i = 0; i < this.floorCount; i++) {
            this.focusTargets[i] = i === index ? 1 : 0;
            if (instant) this.focusValues[i] = this.focusTargets[i];
        }
        this.focusAnimStart = instant ? null : performance.now();
    }

    update(time, dt, camera, parallax) {
        if (this.focusAnimStart != null) {
            const t = Math.min(1, (performance.now() - this.focusAnimStart) / FOCUS_LERP_MS);
            for (let i = 0; i < this.floorCount; i++) {
                this.focusValues[i] += (this.focusTargets[i] - this.focusValues[i]) * Math.min(1, dt * 8);
            }
            if (t >= 1) this.focusAnimStart = null;
            this.focusAttr.needsUpdate = true;
        }

        this.material.uniforms.uTime.value = time;
        this.material.uniforms.uCameraPos.value.copy(camera.position);
        this.material.uniforms.uParallax.value.set(parallax?.x ?? 0, parallax?.y ?? 0);
        const ld = this.material.uniforms.uLightDir.value;
        ld.set(0.2 + (parallax?.x ?? 0) * 0.45, 1, 0.3 + (parallax?.y ?? 0) * 0.4).normalize();

        for (let i = 0; i < this.floorCount; i++) {
            this.dummy.position.set(0, this.floorYs[i], 0);
            this.dummy.rotation.set(this.openRotations[i], this.yRotations[i], 0);
            this.dummy.updateMatrix();
            this.slabs.setMatrixAt(i, this.dummy.matrix);
            this.dummy.position.y = this.floorYs[i] - SLAB_H * 0.52;
            this.dummy.updateMatrix();
            this.glowMesh.setMatrixAt(i, this.dummy.matrix);
        }
        this.slabs.instanceMatrix.needsUpdate = true;
        this.glowMesh.instanceMatrix.needsUpdate = true;
    }

    getFloorY(index) {
        return this.floorYs[index] ?? 0;
    }

    getFloorGroup(index) {
        this.dummy.position.set(0, this.floorYs[index], 0);
        this.dummy.rotation.set(this.openRotations[index], this.yRotations[index], 0);
        this.dummy.updateMatrix();
        this.dummy.updateMatrixWorld(true);
        return this.dummy;
    }

    setFloorOpenRotation(index, radians) {
        this.openRotations[index] = radians;
    }

    setFloorDim() {
        /* slabs use focus uniform; dimming handled via focus + transition */
    }

    resetFloorVisuals() {
        this.openRotations.fill(0);
        this.setFloorBackdropDim(-1, 1);
        this.setGlitchState({ strength: 0, tear: 0, slab: -1 });
    }

    setFloorBackdropDim(_index, dim) {
        this.backdropDim = dim;
        if (this.material.uniforms.uBackdropDim) {
            this.material.uniforms.uBackdropDim.value = dim;
        }
    }

    setAtlasTexture(three, canvas, rects) {
        if (!canvas) return;
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.NearestFilter;
        tex.magFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = false;
        this.material.uniforms.uAtlas.value = tex;
        this.material.uniforms.uAtlasReady.value = 1;
        if (rects) {
            this.atlasRects.set(rects);
            this.atlasAttr.needsUpdate = true;
        }
    }

    setContentCollapse(value) {
        if (this.material.uniforms.uContentCollapse) {
            this.material.uniforms.uContentCollapse.value = value;
        }
    }

    stackDrawCallCount() {
        return 2;
    }

    dispose() {
        this.root.remove(this.slabs, this.glowMesh);
        this.scene.remove(this.root);
        this.slabs.geometry.dispose();
        this.material.dispose();
        this.glowMesh.geometry.dispose();
        this.glowMaterial.dispose();
    }
}

export { SLAB_W, SLAB_D, FLOOR_GAP };
