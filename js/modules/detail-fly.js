/**
 * 500 ms WebGL painting fly toward viewport center before DOM detail handoff.
 */

import * as THREE from 'three';

const FLY_MS = 500;

export class DetailFly {
    constructor({ scene, camera, reducedMotion }) {
        this.scene = scene;
        this.camera = camera;
        this.reducedMotion = reducedMotion;
        this.plane = null;
        this.sourceMesh = null;
        this.anim = null;
        this._v = new THREE.Vector3();
        this._corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    }

    isActive() {
        return !!this.anim;
    }

    /**
     * @param {THREE.Mesh} fromMesh
     * @returns {Promise<DOMRect>} screen rect at end of fly
     */
    start(fromMesh) {
        if (this.reducedMotion || !fromMesh?.material?.map) {
            return Promise.resolve(this._meshScreenRect(fromMesh));
        }

        this.cancel();
        this.sourceMesh = fromMesh;
        fromMesh.visible = false;

        const geo = fromMesh.geometry.clone();
        const mat = new THREE.MeshBasicMaterial({
            map: fromMesh.material.map,
            transparent: true,
            side: THREE.DoubleSide
        });
        this.plane = new THREE.Mesh(geo, mat);
        this.plane.matrixAutoUpdate = false;
        fromMesh.updateWorldMatrix(true, false);
        this.plane.matrix.copy(fromMesh.matrixWorld);
        this.scene.add(this.plane);

        const startScale = new THREE.Vector3();
        const startPos = new THREE.Vector3();
        const startQuat = new THREE.Quaternion();
        this.plane.matrix.decompose(startPos, startQuat, startScale);

        const endPos = new THREE.Vector3();
        const endQuat = new THREE.Quaternion();
        const endScale = new THREE.Vector3();
        this._computeEndTransform(fromMesh, endPos, endQuat, endScale);

        return new Promise((resolve) => {
            this.anim = {
                t0: performance.now(),
                duration: FLY_MS,
                startPos,
                startQuat,
                startScale,
                endPos,
                endQuat,
                endScale,
                resolve
            };
        });
    }

    _computeEndTransform(fromMesh, endPos, endQuat, endScale) {
        const aspect = fromMesh.geometry.parameters.height / fromMesh.geometry.parameters.width;
        const targetW = Math.min(window.innerWidth * 0.7, window.innerHeight * 0.8 / aspect);
        const targetH = targetW * aspect;
        const dist = 2.2;
        endPos.set(0, 0, -dist);
        endPos.applyMatrix4(this.camera.matrixWorld);
        endQuat.copy(this.camera.quaternion);
        const worldW = (targetW / window.innerWidth) * dist * 2 * Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect;
        const sx = worldW / fromMesh.geometry.parameters.width;
        endScale.set(sx, sx, 1);
    }

    update() {
        if (!this.anim || !this.plane) return;
        const t = Math.min(1, (performance.now() - this.anim.t0) / this.anim.duration);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        this._v.copy(this.anim.startPos).lerp(this.anim.endPos, e);
        const q = this.anim.startQuat.clone().slerp(this.anim.endQuat, e);
        const s = this.anim.startScale.clone().lerp(this.anim.endScale, e);
        this.plane.matrix.compose(this._v, q, s);
        this.plane.matrixWorldNeedsUpdate = true;

        if (t >= 1) {
            const rect = this._planeScreenRect();
            const resolve = this.anim.resolve;
            this.cancel(false);
            resolve(rect);
        }
    }

    cancel(restoreSource = true) {
        if (this.plane) {
            this.scene.remove(this.plane);
            this.plane.geometry.dispose();
            this.plane.material.dispose();
            this.plane = null;
        }
        if (restoreSource && this.sourceMesh) {
            this.sourceMesh.visible = true;
        }
        this.sourceMesh = null;
        this.anim = null;
    }

    _planeScreenRect() {
        if (!this.plane) return new DOMRect(0, 0, 0, 0);
        return this._meshScreenRect(this.plane);
    }

    _meshScreenRect(mesh) {
        if (!mesh) return new DOMRect(0, 0, 0, 0);
        mesh.updateWorldMatrix(true, false);
        const hw = mesh.geometry.parameters.width / 2;
        const hh = mesh.geometry.parameters.height / 2;
        const pts = [
            [-hw, hh, 0],
            [hw, hh, 0],
            [hw, -hh, 0],
            [-hw, -hh, 0]
        ];
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        pts.forEach(([x, y, z], i) => {
            this._corners[i].set(x, y, z).applyMatrix4(mesh.matrixWorld).project(this.camera);
            const sx = (this._corners[i].x * 0.5 + 0.5) * window.innerWidth;
            const sy = (-this._corners[i].y * 0.5 + 0.5) * window.innerHeight;
            minX = Math.min(minX, sx);
            minY = Math.min(minY, sy);
            maxX = Math.max(maxX, sx);
            maxY = Math.max(maxY, sy);
        });
        return new DOMRect(minX, minY, maxX - minX, maxY - minY);
    }
}
