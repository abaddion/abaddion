/**
 * AUDIO-REACTOR.JS
 * Analyzes audio input or generates synthetic audio data for reactive visuals
 */

class AudioReactor {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.bufferLength = 0;
        
        this.isPlaying = false;
        this.useSynthetic = true;
        
        this.volume = 0;
        this.bass = 0;
        this.mid = 0;
        this.treble = 0;
        
        this.syntheticPhase = 0;
        this.syntheticSpeed = 0.5;
    }
    
    async init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);
            
            console.log('Audio context initialized');
            return true;
        } catch (error) {
            console.warn('Audio context not available, using synthetic data only');
            this.useSynthetic = true;
            return false;
        }
    }
    
    update(time) {
        if (this.useSynthetic) {
            this.updateSynthetic(time);
        }
    }
    
    updateSynthetic(time) {
        this.syntheticPhase += this.syntheticSpeed * 0.016;
        
        const bassKick = Math.sin(this.syntheticPhase * 2) > 0.7 ? 1 : 0;
        this.bass = Utils.lerp(this.bass, bassKick, 0.3);
        
        const midWave = (Math.sin(this.syntheticPhase * 4) + 1) / 2;
        this.mid = Utils.lerp(this.mid, midWave * 0.5, 0.2);
        
        const trebleNoise = Utils.noise(this.syntheticPhase * 10);
        this.treble = Utils.lerp(this.treble, trebleNoise * 0.3, 0.4);
        
        this.volume = (this.bass + this.mid + this.treble) / 3;
    }
    
    getBass() {
        return this.bass;
    }
    
    getMid() {
        return this.mid;
    }
    
    getTreble() {
        return this.treble;
    }
    
    getVolume() {
        return this.volume;
    }
    
    isReactive() {
        return this.isPlaying || this.useSynthetic;
    }
}

window.AudioReactor = AudioReactor;
