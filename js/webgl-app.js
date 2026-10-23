/**
 * WebGL stack — deferred init with yields + compileAsync (Phase 1.2 TBT).
 */

import { Utils, yieldToMain } from './modules/utils.js';

function detectWebGL() {
    try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
    } catch {
        return false;
    }
}

class WebGLLayer {
    constructor(shell) {
        this.shell = shell;
        this.canvas = shell.canvas;
        this.reducedMotion = shell.reducedMotion;
        this.isMobile = shell.isMobile;
        this.content = shell.content;
        this.cardLayer = shell.cardLayer;
        this.rail = shell.rail;
        this.router = shell.router;
        this.focusIndex = shell.focusIndex;

        this.mouse = { x: 0, y: 0 };
        this.gyroOffset = { x: 0, y: 0 };
        this.lastShiftPress = 0;
        this.clock = null;
        this.fpsCounter = Utils.createFPSCounter();
        this.frame = 0;
        this.parallax = { x: 0, y: 0 };
        this.canvasRevealed = false;
        this.THREE = null;
        this.corridor = null;
        this.canvasDetail = null;
        this.detailFly = null;
        this._detailOpening = false;
        this._detailCorridorMesh = null;
        this.novaFallback = null;
        this.canvasFloorIndex = 1;

        this.fpsDisplay = document.getElementById('fps-counter');
        this.passCountDisplay = document.getElementById('pass-count');
    }

    async initAsync() {
        if (!detectWebGL()) {
            document.documentElement.classList.add('no-webgl');
            return;
        }

        await this.initRenderer();
        await yieldToMain();
        await this.initStack();
        await yieldToMain();
        await this.initLabels();
        await yieldToMain();
        await this.initSystems();
        await yieldToMain();

        if (this.renderer.compileAsync) {
            await this.renderer.compileAsync(this.scene, this.camera);
        }
        await yieldToMain();

        this.setupEvents();
        this.syncFromShellFocus();
        this.clock = new this.THREE.Clock();
        this.scheduleAtlasBuild();
        this.renderLoop.ping();
    }

    scheduleAtlasBuild() {
        const run = () => {
            import('./modules/atlas-builder.js')
                .then(({ buildFloorAtlas }) => buildFloorAtlas())
                .then(({ canvas, rects }) => {
                    this.stack?.setAtlasTexture(this.THREE, canvas, rects);
                })
                .catch((err) => console.warn('[atlas]', err));
        };
        if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 3000 });
        else setTimeout(run, 100);
    }

    async initRenderer() {
        this.THREE = await import('three');
        const THREE = this.THREE;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);
        this.scene.fog = new THREE.Fog(0x0a0a0a, 12, 40);

        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(52, aspect, 0.1, 100);
        this.camera.position.set(6, 8, 10);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: !this.isMobile,
            alpha: false,
            powerPreference: this.isMobile ? 'low-power' : 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        const { Quality } = await import('./modules/quality.js');
        this.quality = new Quality(this.renderer, {
            isMobile: this.isMobile,
            onDatamoshChange: (allowed) => this.postProcessing?.setDatamoshAllowed(allowed),
            onGlassChange: () => {}
        });
        this.quality.applyDpr();
        if (!this.quality.glassBlurAllowed) {
            document.documentElement.classList.add('no-glass-blur');
        }
    }

    async initStack() {
        const { BoardStack } = await import('./modules/stack.js');
        const { CameraRig } = await import('./modules/camera-rig.js');
        const { PostProcessing } = await import('./modules/post-processing.js');

        const floors = this.content.floors;
        this.stack = new BoardStack(this.scene, floors.length, { reducedMotion: this.reducedMotion });
        this.cameraRig = new CameraRig(this.camera, this.stack);
        this.cameraRig.setFocus(this.shell.focusIndex);

        this.postProcessing = new PostProcessing(this.renderer, this.scene, this.camera, {
            reducedMotion: this.reducedMotion
        });

        this.stack.setFocusedFloor(this.shell.focusIndex, true);
    }

    async initLabels() {
        const { FloorLabels } = await import('./modules/labels.js');
        this.labels = new FloorLabels(document.getElementById('floor-labels'), this.stack, this.content, {
            hintEl: document.getElementById('open-hint')
        });
        this.labels.setFocusIndex(this.shell.focusIndex);
    }

    async initSystems() {
        const floors = this.content.floors;
        const { InteractionState, InteractionStates } = await import('./modules/interaction-state.js');
        const { RenderLoop } = await import('./modules/render-loop.js');
        const { FloorTransition } = await import('./modules/floor-transition.js');
        const { Gyroscope } = await import('./modules/gyroscope.js');
        const { CustomCursor } = await import('./modules/cursor.js');
        const { FloorInput } = await import('./modules/input.js');
        const { NovaFallback } = await import('./modules/nova-fallback.js');
        const { CanvasCorridor } = await import('./modules/canvas-corridor.js');
        const { CanvasDetail } = await import('./modules/canvas-detail.js');
        const { DetailFly } = await import('./modules/detail-fly.js');

        this.canvasFloorIndex = floors.findIndex((f) => f.id === 'canvas');
        this.novaFallback = new NovaFallback();
        this.corridor = new CanvasCorridor(this.scene, {
            qualityTier: this.quality.glassBlurAllowed ? 'high' : 'low',
            onPaintingClick: (slug) => this.openCanvasDetail(slug)
        });
        this.detailFly = new DetailFly({
            scene: this.scene,
            camera: this.camera,
            reducedMotion: this.reducedMotion
        });
        this.canvasDetail = new CanvasDetail({
            onClose: () => {
                this._restoreDetailCorridorMesh();
                this.detailFly?.cancel();
                this.renderLoop.ping();
            },
            onNavigateSlug: () => this.renderLoop.ping()
        });
        this.cardLayer.setCanvasDetailOpener((slug) => this.openCanvasDetail(slug));

        this.interactionState = new InteractionState();
        this.interactionState.set(InteractionStates.FOCUS, this.shell.focusIndex);

        this.renderLoop = new RenderLoop({
            onFrame: () => this.frameRender(),
            getMode: (idleMs) => {
                const detailOpen = this.canvasDetail && !this.canvasDetail.el.hidden;
                const detailFlying = this.detailFly?.isActive();
                if (
                    idleMs > 8000 &&
                    !this.transition.isAnimating() &&
                    !this.transition.isOpen() &&
                    !detailOpen &&
                    !detailFlying &&
                    !this.cameraRig.isSettling() &&
                    !this.postProcessing.isComposerActive()
                ) {
                    return 'frozen';
                }
                if (
                    this.transition.isAnimating() ||
                    this.transition.isOpen() ||
                    detailOpen ||
                    detailFlying ||
                    this.corridor?.root?.visible ||
                    this.cameraRig.isSettling() ||
                    this.postProcessing.isComposerActive()
                ) {
                    return 'full';
                }
                return 'ambient';
            }
        });

        this.transition = new FloorTransition({
            interactionState: this.interactionState,
            stack: this.stack,
            postProcessing: this.postProcessing,
            floorView: this.cardLayer,
            cameraRig: this.cameraRig,
            reducedMotion: this.reducedMotion,
            novaFallback: this.novaFallback,
            onActivity: () => this.renderLoop.ping(),
            onFloorOpen: (idx) => this.onFloorOpened(idx),
            onFloorClose: () => this.onFloorClosed()
        });

        this.gyroscope = new Gyroscope();
        this.gyroscope.onChange((v) => {
            this.gyroOffset.x = v.x;
            this.gyroOffset.y = v.y;
            this.renderLoop.ping();
        });

        this.cursor = new CustomCursor();

        this.input = new FloorInput({
            canvas: this.canvas,
            cardsRoot: document.getElementById('cards'),
            getFocusIndex: () => this.focusIndex,
            getFloorCount: () => floors.length,
            onFloorChange: (index) => this.navigateToFloor(index, this.router.routeForIndex(index)),
            onOpen: (index) => this.openFloor(index),
            onClose: () => this.closeFloor(),
            isOpen: () => this.interactionState.isOpen(),
            isTransitioning: () => this.interactionState.isTransitioning(),
            onCancelTransition: () =>
                this.transition.interruptToFocus(this.focusIndex),
            onActivity: () => this.renderLoop.ping(),
            isCorridorActive: () => this.isCorridorActive(),
            isDetailOpen: () => this.isDetailOpen(),
            onCorridorScroll: (delta) => this.corridorScroll(delta),
            onCorridorStep: (delta) => this.corridor?.stepPainting(delta)
        });
    }

    isCorridorActive() {
        return (
            this.interactionState.isOpen() &&
            this.interactionState.floorIndex === this.canvasFloorIndex &&
            !this.isDetailOpen()
        );
    }

    isDetailOpen() {
        return this.canvasDetail && !this.canvasDetail.el.hidden;
    }

    onFloorOpened(index) {
        if (index === this.canvasFloorIndex) {
            this.stack.root.visible = false;
            this.labels.container.style.visibility = 'hidden';
            this.corridor.setVisible(true);
        }
    }

    onFloorClosed() {
        this.stack.root.visible = true;
        this.labels.container.style.visibility = '';
        this.corridor?.setVisible(false);
        this.detailFly?.cancel();
        this._restoreDetailCorridorMesh();
        this.canvasDetail?.close();
    }

    corridorScroll(delta) {
        const step = delta > 0 ? 0.04 : -0.04;
        this.corridor.setProgress(this.corridor.progress + step);
        this.renderLoop.ping();
    }

    _restoreDetailCorridorMesh() {
        if (this._detailCorridorMesh) {
            this._detailCorridorMesh.visible = true;
            this._detailCorridorMesh = null;
        }
    }

    async openCanvasDetail(slug) {
        if (this._detailOpening) return;
        this._detailOpening = true;
        try {
            const mesh = this.corridor?.getMeshForSlug(slug) ?? null;
            this._detailCorridorMesh = mesh;
            let handoffRect;
            if (mesh && this.detailFly) {
                this.renderLoop.ping();
                handoffRect = await this.detailFly.start(mesh);
            }
            await this.canvasDetail.open(slug, handoffRect?.width > 0 ? { handoffRect } : {});
        } finally {
            this._detailOpening = false;
        }
        this.renderLoop.ping();
    }

    handleRoute({ index, openOnLoad, scrollContact, canvasSlug }) {
        this.navigateToFloor(index, this.router.routeForIndex(index), { skipHistory: true });
        if (openOnLoad) {
            this.openFloor(index, true);
        }
        if (canvasSlug) {
            setTimeout(() => this.openCanvasDetail(canvasSlug), 700);
        }
        if (scrollContact) {
            setTimeout(() => this.cardLayer.scrollToContact(), 300);
        }
    }

    syncFromShellFocus() {
        const idx = this.shell.focusIndex;
        this.focusIndex = idx;
        this.stack?.setFocusedFloor(idx);
        this.labels?.setFocusIndex(idx);
        this.cameraRig?.setFocus(idx);
    }

    navigateToFloor(index, route, { skipHistory = false } = {}) {
        this.transition.interruptToFocus(index);
        this.focusIndex = index;
        this.shell.focusIndex = index;
        this.stack?.setFocusedFloor(index);
        this.labels?.setFocusIndex(index);
        this.cameraRig?.setFocus(index);
        this.rail.setActive(index);
        if (!skipHistory) {
            this.router.navigate(route ?? this.router.routeForIndex(index), true);
        }
        this.renderLoop?.ping();
        this.updateHeroHandoffState();
        this.dismissOpenHint();
    }

    goToFloor(index, route) {
        this.navigateToFloor(index, route);
    }

    openFloor(index, fromRoute = false) {
        this.cardLayer.ensureBuilt(index);
        this.focusIndex = index;
        this.shell.focusIndex = index;
        this.stack?.setFocusedFloor(index);
        this.labels?.setFocusIndex(index);
        this.rail.setActive(index);
        const route = this.router.routeForIndex(index);
        if (!fromRoute && location.pathname.replace(/\/+$/, '') !== route.replace(/\/+$/, '')) {
            this.router.navigate(route, true);
        }
        this.transition.open(index);
        this.renderLoop.ping();
        this.updateHeroHandoffState();
    }

    closeFloor() {
        this.transition.close();
        this.renderLoop.ping();
    }

    updateHeroHandoffState() {
        if (!this.canvasRevealed) return;
        const root = document.documentElement;
        if (this.focusIndex !== 0) {
            root.classList.add('hero-dismissed');
            root.classList.remove('hero-handoff');
        }
    }

    dismissOpenHint() {
        if (localStorage.getItem('open-hint-seen')) return;
        localStorage.setItem('open-hint-seen', '1');
        document.getElementById('open-hint')?.classList.add('hidden');
    }

    setupEvents() {
        const ping = () => this.renderLoop.ping();
        window.addEventListener('resize', () => this.onResize());
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('wheel', ping, { passive: true });
        window.addEventListener('pointerdown', ping, { passive: true });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.renderLoop.stop();
            else this.renderLoop.ping();
        });

        window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
            this.reducedMotion = e.matches;
            this.shell.reducedMotion = e.matches;
            document.documentElement.classList.toggle('reduce-motion', this.reducedMotion);
            this.postProcessing?.applyReducedMotion(this.reducedMotion);
        });

        const enableGyro = () => this.gyroscope.requestFromUserGesture();
        this.canvas.addEventListener('touchstart', enableGyro, { passive: true });
        document.getElementById('gyro-status')?.addEventListener('click', enableGyro);

        this.canvas.addEventListener('click', (e) => {
            if (!this.isCorridorActive()) return;
            const hit = this.corridor.pick(e.clientX, e.clientY, this.camera, this.canvas);
            if (hit?.userData?.slug) this.openCanvasDetail(hit.userData.slug);
        });
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isCorridorActive()) return;
            const hit = this.corridor.pick(e.clientX, e.clientY, this.camera, this.canvas);
            this.corridor.setHover(hit);
        });
    }

    onMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.renderLoop.ping();
    }

    onKeyDown(event) {
        this.renderLoop.ping();
        if (this.isCorridorActive() && (event.code === 'ArrowLeft' || event.code === 'ArrowRight')) {
            event.preventDefault();
            this.corridor.stepPainting(event.code === 'ArrowRight' ? 1 : -1);
            return;
        }
        if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
            const now = Date.now();
            if (now - this.lastShiftPress < 300) {
                this.postProcessing.chaosMode(2000);
                this.cursor?.glitch(2000);
            }
            this.lastShiftPress = now;
        }
    }

    onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.stack?.applyViewportLayout();
        this.postProcessing?.resize(w, h);
        this.renderLoop.ping();
    }

    updateParallax() {
        const mouseX = this.mouse.x * 0.4;
        const mouseY = this.mouse.y * 0.25;
        const gyroWeight = this.gyroscope?.isEnabled() ? 1 : 0;
        const mouseWeight = this.gyroscope?.isEnabled() ? 0.35 : 1;
        this.parallax.x = mouseX * mouseWeight + this.gyroOffset.x * 0.5 * gyroWeight;
        this.parallax.y = mouseY * mouseWeight + this.gyroOffset.y * 0.3 * gyroWeight;
        this.cameraRig.setParallax(this.parallax.x, this.parallax.y);
    }

    revealCanvas() {
        if (this.canvasRevealed) return;
        this.canvasRevealed = true;
        const root = document.documentElement;
        root.classList.add('canvas-ready');

        if (this.focusIndex === 0) {
            root.classList.add('webgl-active', 'hero-handoff');
            const ms = this.reducedMotion ? 0 : 400;
            setTimeout(() => root.classList.add('hero-dismissed'), ms);
        } else {
            root.classList.add('webgl-active', 'hero-dismissed');
        }
    }

    frameRender() {
        const frameStart = performance.now();
        const dt = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        this.updateParallax();
        if (this.isCorridorActive()) {
            this.corridor.update(dt, this.camera);
        } else {
            this.cameraRig.update(dt);
            this.stack.update(time, dt, this.camera, this.parallax);
            this.labels.update(this.camera);
            this.labels.setFocusIndex(this.focusIndex);
        }
        this.transition.update(this.camera, performance.now());
        this.detailFly?.update();

        this.postProcessing.update(time, dt);
        this.renderer.info.reset();
        this.postProcessing.render();

        this.revealCanvas();

        this.quality.recordFrame(performance.now() - frameStart);

        this.frame++;
        if (this.frame % 12 === 0) {
            if (this.fpsDisplay) {
                if (this.renderLoop.isFrozen()) {
                    this.fpsDisplay.textContent = 'IDLE';
                } else {
                    this.fpsDisplay.textContent = this.fpsCounter
                        .update()
                        .toString()
                        .padStart(2, '0');
                }
            }
            if (this.passCountDisplay) {
                this.passCountDisplay.textContent = this.postProcessing
                    .getPassCount()
                    .toString()
                    .padStart(2, '0');
            }
        }
    }
}

export async function attachWebGL(shell) {
    const layer = new WebGLLayer(shell);
    await layer.initAsync();
    shell.webgl = layer;
    // Capture prototype method before defineProperty shadows instance goToFloor (rail uses shell.goToFloor).
    const shellGoToFloor = Object.getPrototypeOf(shell).goToFloor.bind(shell);
    Object.defineProperty(window.app, 'stack', { get: () => layer.stack });
    Object.defineProperty(window.app, 'renderer', { get: () => layer.renderer });
    Object.defineProperty(window.app, 'renderLoop', { get: () => layer.renderLoop });
    Object.defineProperty(window.app, 'postProcessing', { get: () => layer.postProcessing });
    Object.defineProperty(window.app, 'transition', { get: () => layer.transition });
    Object.defineProperty(window.app, 'goToFloor', { value: (i, r) => shellGoToFloor(i, r) });
    Object.defineProperty(window.app, 'openFloor', { value: (i, fr) => layer.openFloor(i, fr) });
    Object.defineProperty(window.app, 'closeFloor', { value: () => layer.closeFloor() });
    Object.defineProperty(window.app, 'openCanvasDetail', {
        value: (slug) => layer.openCanvasDetail(slug)
    });
    Object.defineProperty(window.app, 'canvasDetail', { get: () => layer.canvasDetail });
    Object.defineProperty(window.app, 'frame', { get: () => layer.frame });
    Object.defineProperty(window.app, 'frameRender', { value: () => layer.frameRender() });
    return layer;
}
