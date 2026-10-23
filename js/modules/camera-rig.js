/**
 * Camera states: OVERVIEW, FOCUS(i), OPEN(i) — viewport-aware framing.
 */

import * as THREE from 'three';
import { SLAB_W } from './stack.js';

export class CameraRig {
    constructor(camera, stack) {
        this.camera = camera;
        this.stack = stack;
        this.state = 'focus';
        this.focusIndex = 0;
        this.parallax = { x: 0, y: 0 };
        this.lookAt = new THREE.Vector3();
        this.targetPos = new THREE.Vector3();
        this.targetLook = new THREE.Vector3();
        this.settling = true;
    }

    setOverview() {
        this.state = 'overview';
        this.settling = true;
    }

    setFocus(index) {
        this.focusIndex = index;
        this.state = 'focus';
        this.settling = true;
    }

    setOpen(index) {
        this.focusIndex = index;
        this.state = 'open';
        this.settling = true;
    }

    setParallax(x, y) {
        this.parallax.x = x;
        this.parallax.y = y;
    }

    focusDistanceForViewport() {
        const mobile = window.innerWidth < 768;
        const fraction = mobile ? 0.9 : 0.7;
        const vFov = (this.camera.fov * Math.PI) / 180;
        const visibleWidth = 2 * Math.tan(vFov / 2) * this.camera.aspect;
        return SLAB_W / (visibleWidth * fraction);
    }

    computeTargets() {
        const y = this.stack.getFloorY(this.focusIndex);
        const px = this.parallax.x * 0.35;
        const py = this.parallax.y * 0.25;
        const dist = this.focusDistanceForViewport();
        const mobile = window.innerWidth < 768;
        const vh = window.visualViewport?.height ?? window.innerHeight;
        const portrait = window.innerHeight > window.innerWidth;
        let mobileYOffset = 0;
        if (mobile && portrait && this.state === 'focus') {
            const railReserve = 80;
            const targetY = (vh - railReserve) * 0.45;
            mobileYOffset = (targetY / vh - 0.5) * dist * 0.22;
        }

        if (this.state === 'overview') {
            this.targetPos.set(dist * 1.35 + px, y + dist * 0.55 + py - mobileYOffset * 0.5, dist * 1.45);
            this.targetLook.set(0, y - mobileYOffset * 0.3, 0);
        } else if (this.state === 'open') {
            this.targetPos.set(px, y + dist * 0.35 + py, dist * 0.85);
            this.targetLook.set(0, y, 0);
        } else {
            this.targetPos.set(dist * 0.75 + px, y + dist * 0.42 + py - mobileYOffset, dist * 0.95);
            this.targetLook.set(0, y - mobileYOffset * 0.65, 0);
        }
    }

    update(dt, instant = false) {
        this.computeTargets();
        const k = instant ? 1 : 1 - Math.exp(-6 * dt);
        this.camera.position.lerp(this.targetPos, k);
        this.lookAt.lerp(this.targetLook, k);
        this.camera.lookAt(this.lookAt);
        this.settling =
            this.camera.position.distanceTo(this.targetPos) > 0.08 ||
            this.lookAt.distanceTo(this.targetLook) > 0.08;
    }

    isSettling() {
        return this.settling;
    }
}
