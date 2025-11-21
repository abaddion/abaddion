/**
 * MAIN.JS
 * The orchestrator - brings all modules together
 */

class GlitchPortfolio {
    constructor() {
        this.canvas = document.getElementById('glitch-canvas');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        this.cursor = null;
        this.gyroscope = null;
        this.postProcessing = null;
        this.sceneManager = null;
        this.audioReactor = null;
        
        this.clock = new THREE.Clock();
        this.time = 0;
        this.frame = 0;
        this.fpsCounter = Utils.createFPSCounter();
        
        this.loadingScreen = document.getElementById('loading');
        this.loadingProgress = document.querySelector('.loading-progress');
        this.fpsDisplay = document.getElementById('fps-counter');
        this.passCountDisplay = document.getElementById('pass-count');
        
        this.keys = {};
        this.lastShiftPress = 0;
        
        this.mouse = { x: 0, y: 0 };
        
        this.init();
    }
    
    async init() {
        console.log('Initializing Glitch Portfolio...');
        
        this.updateLoading(10, 'LOADING_THREE.JS');
        
        this.initThree();
        
        this.updateLoading(30, 'INITIALIZING_MODULES');
        
        await this.initModules();
        
        this.updateLoading(60, 'COMPILING_SHADERS');
        
        this.setupEvents();
        
        this.updateLoading(80, 'STARTING_RENDER_ENGINE');
        
        this.animate();
        
        setTimeout(() => {
            this.updateLoading(100, 'COMPLETE');
            setTimeout(() => {
                this.loadingScreen.classList.add('hidden');
            }, 500);
        }, 1000);
    }
    
    initThree() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x000000, 5, 15);
        
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.z = 5;
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: false,
            alpha: false
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000);
        
        console.log('Three.js initialized');
    }
    
    async initModules() {
        this.cursor = new CustomCursor();
        console.log('Cursor initialized');
        
        this.gyroscope = new Gyroscope();
        
        if (Utils.isMobile() || Utils.isTouchDevice()) {
            const gyroEnabled = await this.gyroscope.init();
            
            if (!gyroEnabled && Utils.isIOS()) {
                const button = this.gyroscope.createPermissionButton();
                if (button) {
                    document.body.appendChild(button);
                }
            }
        }
        
        this.gyroscope.onChange((values) => {
            if (this.camera) {
                this.camera.position.x = Utils.lerp(
                    this.camera.position.x,
                    values.x * 0.5,
                    0.05
                );
                this.camera.position.y = Utils.lerp(
                    this.camera.position.y,
                    values.y * 0.3,
                    0.05
                );
            }
        });
        
        console.log('Gyroscope initialized');
        
        this.sceneManager = new SceneManager(this.scene, this.camera);
        console.log('Scene Manager initialized');
        
        this.postProcessing = new PostProcessing(this.renderer, this.scene, this.camera);
        console.log('Post-processing initialized');
        
        this.audioReactor = new AudioReactor();
        await this.audioReactor.init();
        console.log('Audio Reactor initialized');
    }
    
    setupEvents() {
        window.addEventListener('resize', () => this.onResize(), false);
        
        window.addEventListener('mousemove', (e) => this.onMouseMove(e), false);
        
        window.addEventListener('keydown', (e) => this.onKeyDown(e), false);
        window.addEventListener('keyup', (e) => this.onKeyUp(e), false);
        
        document.querySelectorAll('.nav-item').forEach((item, index) => {
            item.addEventListener('click', () => {
                this.sceneManager.switchScene(index);
                this.postProcessing.burst(0.3, 150);
            });
        });
        
        if (Utils.isTouchDevice()) {
            this.canvas.addEventListener('touchstart', () => {
                this.postProcessing.burst(0.2, 100);
            }, false);
        }
    }
    
    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
        
        if (this.postProcessing) {
            this.postProcessing.resize(width, height);
        }
    }
    
    onMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        const targetX = this.mouse.x * 0.5;
        const targetY = this.mouse.y * 0.3;
        
        this.camera.position.x = Utils.lerp(this.camera.position.x, targetX, 0.05);
        this.camera.position.y = Utils.lerp(this.camera.position.y, targetY, 0.05);
        
        const distanceFromCenter = Math.sqrt(this.mouse.x * this.mouse.x + this.mouse.y * this.mouse.y);
        const rgbIntensity = Utils.map(distanceFromCenter, 0, 1.4, 0.002, 0.01);
        this.postProcessing.setIntensity('rgbShift', rgbIntensity);
    }
    
    onKeyDown(event) {
        this.keys[event.code] = true;
        
        if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
            const now = Date.now();
            if (now - this.lastShiftPress < 300) {
                console.log('CHAOS MODE ACTIVATED');
                this.postProcessing.chaosMode(2000);
                this.cursor.glitch(2000);
            }
            this.lastShiftPress = now;
        }
        
        if (event.code === 'Space') {
            this.clock.stop();
            setTimeout(() => this.clock.start(), 100);
        }
        
        const numberKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
        const index = numberKeys.indexOf(event.code);
        if (index !== -1) {
            this.sceneManager.switchScene(index);
            this.postProcessing.burst(0.3, 150);
        }
    }
    
    onKeyUp(event) {
        this.keys[event.code] = false;
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();
        this.time = this.clock.getElapsedTime();
        this.frame++;
        
        this.sceneManager.update(this.time);
        this.audioReactor.update(this.time);
        this.postProcessing.update(this.time);
        
        const bass = this.audioReactor.getBass();
        const volume = this.audioReactor.getVolume();
        
        if (bass > 0.7) {
            this.postProcessing.setIntensity('glitch', 0.15);
        } else {
            const currentGlitch = this.postProcessing.getIntensity('glitch');
            this.postProcessing.setIntensity('glitch', Utils.lerp(currentGlitch, 0.05, 0.1));
        }
        
        this.camera.position.z = 5 + Math.sin(this.time * 2) * volume * 0.1;
        
        this.postProcessing.render();
        
        if (this.frame % 10 === 0) {
            const fps = this.fpsCounter.update();
            if (this.fpsDisplay) {
                this.fpsDisplay.textContent = fps.toString().padStart(2, '0');
            }
            
            if (this.passCountDisplay) {
                const passCount = this.postProcessing.getPassCount();
                this.passCountDisplay.textContent = passCount.toString().padStart(2, '0');
            }
        }
    }
    
    updateLoading(progress, text) {
        if (this.loadingProgress) {
            this.loadingProgress.style.width = progress + '%';
        }
        
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = text;
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new GlitchPortfolio();
    });
} else {
    window.app = new GlitchPortfolio();
}
