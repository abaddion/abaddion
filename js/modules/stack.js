/**
 * Five glass-monitor slabs — one InstancedMesh + merged edge lines.
 */

import * as THREE from 'three';
import { createSlabMaterial } from '../shaders/slab-material.js';

const SLAB_W = 4;
const SLAB_H = 0.04;
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

        this.material = createSlabMaterial(this.reducedMotion);
        this.backdropDim = 1;
        this.slabs = new THREE.InstancedMesh(geometry, this.material, floorCount);
        this.slabs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        const edgePositions = [];
        const edgeColors = [];
        const bone = new THREE.Color(0xece8df);
        const dim = new THREE.Color(0xece8df).multiplyScalar(0.35);
        const bright = new THREE.Color(0xece8df);

        const dummy = new THREE.Object3D();
        for (let f = 0; f < floorCount; f++) {
            const y = (floorCount - 1 - f) * FLOOR_GAP;
            this.floorYs[f] = y;
            this.yRotations[f] = f * 0.11;
            dummy.position.set(0, y, 0);
            dummy.rotation.set(0, this.yRotations[f], 0);
            dummy.updateMatrix();
            this.slabs.setMatrixAt(f, dummy.matrix);

            const hw = SLAB_W / 2;
            const hd = SLAB_D / 2;
            const corners = [
                [-hw, y, -hd],
                [hw, y, -hd],
                [hw, y, hd],
                [-hw, y, hd],
                [-hw, y, -hd]
            ];
            for (let i = 0; i < 4; i++) {
                edgePositions.push(...corners[i], ...corners[i + 1]);
                const c = f === 0 ? bright : dim;
                edgeColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
            }
        }
        this.slabs.instanceMatrix.needsUpdate = true;

        const edgeGeo = new THREE.BufferGeometry();
        edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
        edgeGeo.setAttribute('color', new THREE.Float32BufferAttribute(edgeColors, 3));
        this.edges = new THREE.LineSegments(
            edgeGeo,
            new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55 })
        );

        this.root.add(this.slabs, this.edges);
        this.dummy = new THREE.Object3D();
        this.projectionBox = new THREE.Box3();
        this.setFocusedFloor(0, true);
        this.applyViewportLayout();
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
        if (this.material.uniforms.uMonitorGrid) {
            const portrait = mobile && window.innerHeight > window.innerWidth;
            this.material.uniforms.uMonitorGrid.value.set(portrait ? 6 : 8, portrait ? 4 : 5);
        }
    }

    setFocusedFloor(index, instant = false) {
        this.focusIndex = index;
        for (let i = 0; i < this.floorCount; i++) {
            this.focusTargets[i] = i === index ? 1 : 0;
            if (instant) this.focusValues[i] = this.focusTargets[i];
        }
        this.updateEdgeColors();
        this.focusAnimStart = instant ? null : performance.now();
    }

    updateEdgeColors(index = this.focusIndex) {
        const colors = this.edges.geometry.attributes.color.array;
        const bone = new THREE.Color(0xece8df);
        const dim = new THREE.Color(0xece8df).multiplyScalar(0.35);
        const bright = new THREE.Color(0xece8df).multiplyScalar(1.15);
        for (let f = 0; f < this.floorCount; f++) {
            const c = f === index ? bright : dim;
            for (let seg = 0; seg < 4; seg++) {
                const o = (f * 4 + seg) * 6;
                colors[o] = c.r;
                colors[o + 1] = c.g;
                colors[o + 2] = c.b;
                colors[o + 3] = c.r;
                colors[o + 4] = c.g;
                colors[o + 5] = c.b;
            }
        }
        this.edges.geometry.attributes.color.needsUpdate = true;
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

        for (let i = 0; i < this.floorCount; i++) {
            this.dummy.position.set(0, this.floorYs[i], 0);
            this.dummy.rotation.set(this.openRotations[i], this.yRotations[i], 0);
            this.dummy.updateMatrix();
            this.slabs.setMatrixAt(i, this.dummy.matrix);
        }
        this.slabs.instanceMatrix.needsUpdate = true;
    }

    getFloorY(index) {
        return this.floorYs[index] ?? 0;
    }

    getFloorGroup(index) {
        this.dummy.position.set(0, this.floorYs[index], 0);
        this.dummy.rotation.set(this.openRotations[index], this.yRotations[index], 0);
        this.dummy.updateMatrix();
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

    dispose() {
        this.root.remove(this.slabs, this.edges);
        this.scene.remove(this.root);
        this.slabs.geometry.dispose();
        this.material.dispose();
        this.edges.geometry.dispose();
        this.edges.material.dispose();
    }
}

export { SLAB_W, SLAB_D, FLOOR_GAP };
