/**
 * CURSOR.JS — custom cursor (desktop fine pointer only).
 */

import { Utils } from './utils.js';

export function shouldUseCustomCursor() {
    if (navigator.maxTouchPoints > 0) return false;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function disableCustomCursorIfNeeded() {
    if (shouldUseCustomCursor()) return;
    document.documentElement.classList.add('no-custom-cursor');
    document.getElementById('cursor')?.remove();
}

export class CustomCursor {
    constructor() {
        disableCustomCursorIfNeeded();
        this.cursor = document.getElementById('cursor');
        this.cursorCore = this.cursor?.querySelector('.cursor-core');
        this.cursorTrail = this.cursor?.querySelector('.cursor-trail');

        this.mouse = { x: 0, y: 0 };
        this.pos = { x: 0, y: 0 };
        this.trailPos = { x: 0, y: 0 };

        this.lerpAmount = 0.15;
        this.trailLerpAmount = 0.05;

        if (this.cursor && shouldUseCustomCursor()) {
            this.init();
        }
    }

    init() {
        document.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        document.addEventListener('mousedown', () => {
            document.body.classList.add('cursor-active');
        });

        document.addEventListener('mouseup', () => {
            document.body.classList.remove('cursor-active');
        });

        this.setupHoverListeners();
        this.animate();
    }

    setupHoverListeners() {
        document.querySelectorAll('.nav-item, button, a, [data-cursor-hover]').forEach((el) => {
            el.addEventListener('mouseenter', () => {
                document.body.classList.add('cursor-hover');
            });
            el.addEventListener('mouseleave', () => {
                document.body.classList.remove('cursor-hover');
            });
        });
    }

    animate() {
        if (!this.cursorCore) return;

        this.pos.x = Utils.lerp(this.pos.x, this.mouse.x, this.lerpAmount);
        this.pos.y = Utils.lerp(this.pos.y, this.mouse.y, this.lerpAmount);

        this.trailPos.x = Utils.lerp(this.trailPos.x, this.mouse.x, this.trailLerpAmount);
        this.trailPos.y = Utils.lerp(this.trailPos.y, this.mouse.y, this.trailLerpAmount);

        this.cursorCore.style.transform = `translate(${this.pos.x}px, ${this.pos.y}px)`;
        this.cursorTrail.style.transform = `translate(${this.trailPos.x}px, ${this.trailPos.y}px)`;

        requestAnimationFrame(() => this.animate());
    }

    glitch(duration = 100) {
        if (!this.cursorCore) return;

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
