/**
 * Walk-through gallery corridor — camera dolly, right wall, lazy textures.
 */

import * as THREE from 'three';
import { getItems } from './content-loader.js';

const MAX_LOADED = 8;
const EYE_Y = 1.55;
const WALL_X = 2.35;
const SPACING_BASE = 2.1;
const CAMERA_X = -0.35;
const LOOK_X = 0.15;

function parseSizeCm(sizeStr) {
    if (!sizeStr) return { w: 60, h: 80 };
    const m = String(sizeStr).match(/([\d.]+)\s*[×x]\s*([\d.]+)/i);
    if (!m) return { w: 60, h: 80 };
    return { w: parseFloat(m[1], 10), h: parseFloat(m[2], 10) };
}

export class CanvasCorridor {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.onPaintingClick = options.onPaintingClick ?? (() => {});
        this.onActiveChange = options.onActiveChange ?? (() => {});

        this.root = new THREE.Group();
        this.root.visible = false;
        scene.add(this.root);

        this.items = getItems('canvas');
        this.cameraZ = 0;
        this.targetCameraZ = 0;
        this.focusIndex = 0;
        this.loader = new THREE.TextureLoader();
        this.loaded = new Map();
        this.meshes = [];
        this.spotlights = [];
        this.length = 0;

        this._buildEnvironment();
        this._buildPaintings();
    }

    _buildEnvironment() {
        const wallGeo = new THREE.PlaneGeometry(6, 5);
        const wallMat = new THREE.MeshBasicMaterial({ color: 0x060606, side: THREE.FrontSide });
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.set(WALL_X, 3, -this.length * 0.5 - 4);
        wall.rotation.y = -Math.PI / 2;
        this.root.add(wall);

        const floorGeo = new THREE.PlaneGeometry(8, this.length + 24);
        const floorMat = new THREE.MeshBasicMaterial({ color: 0x040404 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, 0, -this.length * 0.5 - 2);
        this.root.add(floor);
    }

    _buildPaintings() {
        let z = -2;
        this.items.forEach((item, i) => {
            const { w, h } = parseSizeCm(item.size);
            const scale = 0.012;
            const pw = w * scale;
            const ph = h * scale;
            const geo = new THREE.PlaneGeometry(pw, ph);
            const mat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.FrontSide });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(WALL_X, EYE_Y, z);
            mesh.rotation.y = -Math.PI / 2;
            mesh.userData = { index: i, slug: item.slug, item, z };
            this.root.add(mesh);
            this.meshes.push(mesh);

            const spotGeo = new THREE.PlaneGeometry(pw * 1.35, ph * 1.6);
            const spotMat = new THREE.MeshBasicMaterial({
                color: 0xfff4dc,
                transparent: true,
                opacity: 0.05,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const spot = new THREE.Mesh(spotGeo, spotMat);
            spot.position.copy(mesh.position);
            spot.position.x -= 0.02;
            spot.rotation.copy(mesh.rotation);
            this.root.add(spot);
            this.spotlights.push({ mesh: spot, base: 0.05, painting: mesh });

            z -= SPACING_BASE + ph * 0.4;
        });
        this.length = Math.abs(z) - 2;
        this.endZ = z + SPACING_BASE;
    }

    setVisible(v) {
        this.root.visible = v;
        if (v) {
            this.cameraZ = 0;
            this.targetCameraZ = 0;
            this._syncFocusFromCamera();
        }
    }

    resetWalk() {
        this.cameraZ = 0;
        this.targetCameraZ = 0;
        this._syncFocusFromCamera();
    }

    scroll(delta) {
        const step = delta > 0 ? -0.35 : 0.35;
        this.targetCameraZ = THREE.MathUtils.clamp(this.targetCameraZ + step, this.endZ - 1, 1.5);
    }

    stepPainting(delta) {
        const next = THREE.MathUtils.clamp(this.focusIndex + delta, 0, this.meshes.length - 1);
        if (next === this.focusIndex) return;
        this.focusIndex = next;
        this.targetCameraZ = this.meshes[next].userData.z + 1.2;
    }

    /** Restore corridor camera to a painting after detail (no walk reset). */
    focusBySlug(slug) {
        const idx = this.meshes.findIndex((m) => m.userData.slug === slug);
        if (idx < 0) return;
        this.focusIndex = idx;
        const z = this.meshes[idx].userData.z + 1.2;
        this.targetCameraZ = z;
        this.cameraZ = z;
        this._syncFocusFromCamera();
    }

    get progress() {
        return THREE.MathUtils.clamp(-this.cameraZ / Math.max(1, this.length), 0, 1);
    }

    setProgress(p) {
        this.targetCameraZ = THREE.MathUtils.lerp(1.5, this.endZ - 1, p);
    }

    getCameraPose() {
        const focusMesh = this.meshes[this.focusIndex];
        if (focusMesh) {
            const z = focusMesh.position.z;
            const narrow =
                typeof window !== 'undefined' &&
                window.innerWidth / Math.max(1, window.innerHeight) < 0.85;
            if (narrow) {
                return {
                    position: new THREE.Vector3(0.85, EYE_Y, z + 2.35),
                    lookAt: new THREE.Vector3(WALL_X - 0.05, EYE_Y, z)
                };
            }
            return {
                position: new THREE.Vector3(0.55, EYE_Y, z + 1.85),
                lookAt: new THREE.Vector3(WALL_X - 0.12, EYE_Y, z)
            };
        }
        return {
            position: new THREE.Vector3(CAMERA_X, EYE_Y, this.cameraZ),
            lookAt: new THREE.Vector3(LOOK_X, EYE_Y, this.cameraZ - 12)
        };
    }

    _syncFocusFromCamera() {
        let best = 0;
        let bestD = Infinity;
        this.meshes.forEach((m, i) => {
            const d = Math.abs(m.position.z - (this.cameraZ - 1.5));
            if (d < bestD) {
                bestD = d;
                best = i;
            }
        });
        if (best !== this.focusIndex) {
            this.focusIndex = best;
        }
        this._updateSpotlights();
        const item = this.items[this.focusIndex];
        this.onActiveChange({
            index: this.focusIndex,
            slug: item?.slug,
            title: item?.title,
            atEnd: this.focusIndex >= this.meshes.length - 1 && this.progress > 0.92
        });
    }

    _updateSpotlights() {
        this.meshes.forEach((m, i) => {
            const spot = this.spotlights[i];
            const active = i === this.focusIndex;
            spot.mesh.material.opacity = active ? 0.2 : spot.base;
            m.position.x = active ? WALL_X - 0.08 : WALL_X;
        });
    }

    update(dt, camera) {
        this.cameraZ += (this.targetCameraZ - this.cameraZ) * Math.min(1, dt * 5);
        const pose = this.getCameraPose();
        camera.position.lerp(pose.position, Math.min(1, dt * 8));
        camera.lookAt(pose.lookAt);

        this._syncFocusFromCamera();

        const center = this.focusIndex;
        this.meshes.forEach((m, i) => {
            if (Math.abs(i - center) <= 4 && !this.loaded.has(i)) this._loadTexture(i);
        });
        this._evictFar(center);
    }

    _loadTexture(index) {
        const item = this.items[index];
        if (!item?.thumb || this.loaded.has(index)) return;
        this.loader.load(item.thumb, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            this.meshes[index].material.map = tex;
            this.meshes[index].material.needsUpdate = true;
            this.loaded.set(index, tex);
        });
    }

    _evictFar(center) {
        if (this.loaded.size <= MAX_LOADED) return;
        for (const [i, tex] of [...this.loaded.entries()]) {
            if (Math.abs(i - center) > 5) {
                tex.dispose();
                this.meshes[i].material.map = null;
                this.loaded.delete(i);
            }
            if (this.loaded.size <= MAX_LOADED) break;
        }
    }

    getMeshForSlug(slug) {
        return this.meshes.find((m) => m.userData.slug === slug) ?? null;
    }

    pick(clientX, clientY, camera, domElement) {
        const rect = domElement.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        if (w < 1 || h < 1) return null;
        const raycaster = new THREE.Raycaster();
        const ndc = new THREE.Vector2(
            ((clientX - rect.left) / w) * 2 - 1,
            -((clientY - rect.top) / h) * 2 + 1
        );
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(this.meshes, false);
        return hits[0]?.object ?? null;
    }

    /** Project painting quad to viewport px (same basis as pick() / touch). */
    _projectMeshScreenRect(mesh, camera, canvasRect) {
        const params = mesh.geometry?.parameters;
        if (!params?.width || !params?.height) return null;

        const hw = params.width / 2;
        const hh = params.height / 2;
        const corners = [
            new THREE.Vector3(-hw, -hh, 0),
            new THREE.Vector3(hw, -hh, 0),
            new THREE.Vector3(hw, hh, 0),
            new THREE.Vector3(-hw, hh, 0)
        ];
        const world = new THREE.Vector3();
        const w = canvasRect.width;
        const h = canvasRect.height;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let any = false;

        mesh.updateWorldMatrix(true, false);
        for (const local of corners) {
            world.copy(local).applyMatrix4(mesh.matrixWorld);
            world.project(camera);
            if (world.z > 1) continue;
            any = true;
            const sx = canvasRect.left + (world.x * 0.5 + 0.5) * w;
            const sy = canvasRect.top + (-world.y * 0.5 + 0.5) * h;
            minX = Math.min(minX, sx);
            maxX = Math.max(maxX, sx);
            minY = Math.min(minY, sy);
            maxY = Math.max(maxY, sy);
        }
        if (!any) return null;

        const ix0 = Math.max(minX, canvasRect.left);
        const ix1 = Math.min(maxX, canvasRect.right);
        const iy0 = Math.max(minY, canvasRect.top);
        const iy1 = Math.min(maxY, canvasRect.bottom);
        const onScreen = ix0 < ix1 && iy0 < iy1;

        return {
            cx: onScreen ? (ix0 + ix1) / 2 : (minX + maxX) / 2,
            cy: onScreen ? (iy0 + iy1) / 2 : (minY + maxY) / 2,
            left: minX,
            top: minY,
            right: maxX,
            bottom: maxY,
            onScreen
        };
    }

    /** Read-only screen projection for tests / introspection (viewport client px). */
    getVisiblePaintingScreenRects(camera, canvas) {
        if (!this.root.visible || !canvas) return [];
        const rect = canvas.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return [];

        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();

        const out = [];
        for (const mesh of this.meshes) {
            if (!mesh.visible) continue;
            const screenRect = this._projectMeshScreenRect(mesh, camera, rect);
            if (!screenRect) continue;
            out.push({
                slug: mesh.userData.slug,
                index: mesh.userData.index,
                focused: mesh.userData.index === this.focusIndex,
                onScreen: screenRect.onScreen,
                screenRect: {
                    cx: screenRect.cx,
                    cy: screenRect.cy,
                    left: screenRect.left,
                    top: screenRect.top,
                    right: screenRect.right,
                    bottom: screenRect.bottom
                }
            });
        }
        return out;
    }

    dispose() {
        this.loaded.forEach((t) => t.dispose());
        this.root.removeFromParent();
    }
}
