/**
 * CURSOR.JS
 * Custom cursor with smooth following and interaction states
 */

class CustomCursor {
    constructor() {
        this.cursor = document.getElementById('cursor');
        this.cursorCore = this.cursor.querySelector('.cursor-core');
        this.cursorTrail = this.cursor.querySelector('.cursor-trail');
        
        this.mouse = { x: 0, y: 0 };
        this.pos = { x: 0, y: 0 };
        this.trailPos = { x: 0, y: 0 };
        
        this.lerpAmount = 0.15;
        this.trailLerpAmount = 0.05;
        
        this.isHovering = false;
        this.isActive = false;
        
        this.init();
    }
    
    init() {
        document.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        
        document.addEventListener('mousedown', () => {
            this.isActive = true;
            document.body.classList.add('cursor-active');
        });
        
        document.addEventListener('mouseup', () => {
            this.isActive = false;
            document.body.classList.remove('cursor-active');
        });
        
        this.setupHoverListeners();
        this.animate();
    }
    
    setupHoverListeners() {
        const interactiveElements = document.querySelectorAll('.nav-item, button, a, [data-cursor-hover]');
        
        interactiveElements.forEach(el => {
            el.addEventListener('mouseenter', () => {
                this.isHovering = true;
                document.body.classList.add('cursor-hover');
            });
            
            el.addEventListener('mouseleave', () => {
                this.isHovering = false;
                document.body.classList.remove('cursor-hover');
            });
        });
    }
    
    animate() {
        this.pos.x = Utils.lerp(this.pos.x, this.mouse.x, this.lerpAmount);
        this.pos.y = Utils.lerp(this.pos.y, this.mouse.y, this.lerpAmount);
        
        this.trailPos.x = Utils.lerp(this.trailPos.x, this.mouse.x, this.trailLerpAmount);
        this.trailPos.y = Utils.lerp(this.trailPos.y, this.mouse.y, this.trailLerpAmount);
        
        this.cursorCore.style.transform = `translate(${this.pos.x}px, ${this.pos.y}px)`;
        this.cursorTrail.style.transform = `translate(${this.trailPos.x}px, ${this.trailPos.y}px)`;
        
        requestAnimationFrame(() => this.animate());
    }
    
    glitch(duration = 100) {
        const originalX = this.pos.x;
        const originalY = this.pos.y;
        
        const glitchInterval = setInterval(() => {
            this.pos.x += Utils.random(-10, 10);
            this.pos.y += Utils.random(-10, 10);
        }, 16);
        
        setTimeout(() => {
            clearInterval(glitchInterval);
            this.pos.x = originalX;
            this.pos.y = originalY;
        }, duration);
    }
}

window.CustomCursor = CustomCursor;
