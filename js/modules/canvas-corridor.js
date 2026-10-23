/**
 * Gallery corridor — right wall, lazy painting textures, damped dolly.
 */

import * as THREE from 'three';
import { getItems } from './content-loader.js';

const MAX_LOADED = 8;
const EYE_Y = 1.55;
const WALL_X = 2.2;
const SPACING_BASE = 1.8;

function parseSizeCm(sizeStr) {
    if (!sizeStr) return { w: 60, h: 80 };
    const m = String(sizeStr).match(/([\d.]+)\s*[×x]\s*([\d.]+)/i);
    if (!m) return { w: 60, h: 80 };
    return { w: parseFloat(m[1], 10), h: parseFloat(m[2], 10) };
}

export class CanvasCorridor {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.qualityTier = options.qualityTier ?? 'high';
        this.onPaintingClick = options.onPaintingClick ?? (() => {});
        this.onProgressChange = options.onProgressChange ?? (() => {});

        this.root = new THREE.Group();
        this.root.visible = false;
        scene.add(this.root);

        this.items = getItems('canvas');
        this.progress = 0;
        this.targetProgress = 0;
        this.focusIndex = 0;
        this.loader = new THREE.TextureLoader();
        this.loaded = new Map();
        this.meshes = [];
        this.spotlights = [];
        this.hovered = null;

        this._buildEnvironment();
        this._buildPaintings();
    }

    _buildEnvironment() {
        const wallGeo = new THREE.PlaneGeometry(40, 6);
        const wallMat = new THREE.MeshBasicMaterial({ color: 0x080808, side: THREE.FrontSide });
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.set(WALL_X, 3, -10);
        wall.rotation.y = -Math.PI / 2;
        this.root.add(wall);

        const floorGeo = new THREE.PlaneGeometry(40, 40);
        const floorMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, 0, -10);
        this.root.add(floor);

        if (this.qualityTier !== 'low') {
            const gloss = new THREE.Mesh(
                new THREE.PlaneGeometry(40, 40),
                new THREE.MeshBasicMaterial({
                    color: 0x1a1a1a,
                    transparent: true,
                    opacity: 0.12
                })
            );
            gloss.rotation.x = -Math.PI / 2;
            gloss.position.set(0, 0.01, -10);
            this.root.add(gloss);
        }
    }

    _buildPaintings() {
        let z = 0;
        this.items.forEach((item, i) => {
            const { w, h } = parseSizeCm(item.size);
            const scale = 0.012;
            const pw = w * scale;
            const ph = h * scale;
            const geo = new THREE.PlaneGeometry(pw, ph);
            const mat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(WALL_X - 0.02, EYE_Y, z);
            mesh.rotation.y = -Math.PI / 2;
            mesh.userData = { index: i, slug: item.slug, item };
            this.root.add(mesh);
            this.meshes.push(mesh);

            const spotGeo = new THREE.PlaneGeometry(pw * 1.4, ph * 1.8);
            const spotMat = new THREE.MeshBasicMaterial({
                color: 0xfff8e8,
                transparent: true,
                opacity: 0.06,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const spot = new THREE.Mesh(spotGeo, spotMat);
            spot.position.copy(mesh.position);
            spot.position.x -= 0.01;
            spot.rotation.copy(mesh.rotation);
            this.root.add(spot);
            this.spotlights.push({ mesh: spot, base: 0.06, painting: mesh });

            z -= SPACING_BASE + ph * 0.35;
        });
        this.length = Math.abs(z);
    }

    setVisible(v) {
        this.root.visible = v;
    }

    setProgress(p) {
        this.targetProgress = Math.max(0, Math.min(1, p));
    }

    stepPainting(delta) {
        const next = Math.max(0, Math.min(this.meshes.length - 1, this.focusIndex + delta));
        if (next === this.focusIndex) return;
        this.focusIndex = next;
        this.targetProgress = next / Math.max(1, this.meshes.length - 1);
    }

    getCameraPose() {
        const z = -this.progress * this.length;
        return {
            position: new THREE.Vector3(-1.2, EYE_Y, z + 2),
            lookAt: new THREE.Vector3(WALL_X, EYE_Y, z - 4)
        };
    }

    update(dt, camera) {
        this.progress += (this.targetProgress - this.progress) * Math.min(1, dt * 4);
        const pose = this.getCameraPose();
        camera.position.lerp(pose.position, Math.min(1, dt * 6));
        camera.lookAt(pose.lookAt);

        const center = Math.round(this.progress * (this.meshes.length - 1));
        this.meshes.forEach((m, i) => {
            const dist = Math.abs(i - center);
            if (dist <= 4 && !this.loaded.has(i)) this._loadTexture(i);
        });
        this._evictFar(center);
        this.onProgressChange(this.progress, this.meshes[center]?.userData.slug);
    }

    _loadTexture(index) {
        const item = this.items[index];
        if (!item?.thumb || this.loaded.has(index)) return;
        this.loader.load(item.thumb, (tex) => {
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

    setHover(mesh) {
        if (this.hovered === mesh) return;
        if (this.hovered) {
            this.hovered.position.x = WALL_X - 0.02;
            const si = this.hovered.userData.index;
            this.spotlights[si].mesh.material.opacity = this.spotlights[si].base;
        }
        this.hovered = mesh;
        if (mesh) {
            mesh.position.x = WALL_X - 0.35;
            const si = mesh.userData.index;
            this.spotlights[si].mesh.material.opacity = 0.18;
        }
    }

    getMeshForSlug(slug) {
        return this.meshes.find((m) => m.userData.slug === slug) ?? null;
    }

    pick(clientX, clientY, camera, domElement) {
        const raycaster = new THREE.Raycaster();
        const ndc = new THREE.Vector2(
            (clientX / domElement.clientWidth) * 2 - 1,
            -(clientY / domElement.clientHeight) * 2 + 1
        );
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(this.meshes, false);
        return hits[0]?.object ?? null;
    }

    dispose() {
        this.loaded.forEach((t) => t.dispose());
        this.root.removeFromParent();
    }
}
