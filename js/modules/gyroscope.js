/**
 * GYROSCOPE.JS
 * Device orientation tracking for immersive tilt effects
 */

class Gyroscope {
    constructor() {
        this.enabled = false;
        this.orientation = { alpha: 0, beta: 0, gamma: 0 };
        this.normalized = { x: 0, y: 0, z: 0 };
        this.smoothed = { x: 0, y: 0, z: 0 };
        this.lerpAmount = 0.1;
        
        this.callbacks = [];
        
        this.statusElement = document.getElementById('gyro-status');
    }
    
    async init() {
        if (!window.DeviceOrientationEvent) {
            this.updateStatus('UNAVAILABLE');
            return false;
        }
        
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') {
                    this.startListening();
                    return true;
                } else {
                    this.updateStatus('DENIED');
                    return false;
                }
            } catch (error) {
                console.error('Error requesting gyroscope permission:', error);
                this.updateStatus('ERROR');
                return false;
            }
        } else {
            this.startListening();
            return true;
        }
    }
    
    startListening() {
        window.addEventListener('deviceorientation', (e) => this.handleOrientation(e), true);
        this.enabled = true;
        this.updateStatus('ACTIVE');
    }
    
    handleOrientation(event) {
        this.orientation.alpha = event.alpha || 0;
        this.orientation.beta = event.beta || 0;
        this.orientation.gamma = event.gamma || 0;
        
        this.normalized.x = Utils.clamp(this.orientation.gamma / 90, -1, 1);
        this.normalized.y = Utils.clamp(this.orientation.beta / 90, -1, 1);
        this.normalized.z = this.orientation.alpha / 360;
        
        this.smoothed.x = Utils.lerp(this.smoothed.x, this.normalized.x, this.lerpAmount);
        this.smoothed.y = Utils.lerp(this.smoothed.y, this.normalized.y, this.lerpAmount);
        this.smoothed.z = Utils.lerp(this.smoothed.z, this.normalized.z, this.lerpAmount);
        
        this.callbacks.forEach(callback => callback(this.smoothed));
    }
    
    onChange(callback) {
        this.callbacks.push(callback);
    }
    
    getValues() {
        return this.smoothed;
    }
    
    isEnabled() {
        return this.enabled;
    }
    
    updateStatus(status) {
        if (this.statusElement) {
            this.statusElement.textContent = status;
            
            if (status === 'ACTIVE') {
                this.statusElement.style.color = 'var(--neon-cyan)';
            } else if (status === 'DENIED' || status === 'ERROR') {
                this.statusElement.style.color = 'var(--glitch-red)';
            } else {
                this.statusElement.style.color = 'var(--steel)';
            }
        }
    }
}

window.Gyroscope = Gyroscope;
