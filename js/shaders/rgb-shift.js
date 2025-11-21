/**
 * RGB-SHIFT.JS
 * Chromatic aberration shader - separates RGB channels for analog glitch effect
 */

const RGBShiftShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'amount': { value: 0.005 },
        'angle': { value: 0.0 }
    },

    vertexShader: `
        varying vec2 vUv;
        
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float amount;
        uniform float angle;
        
        varying vec2 vUv;
        
        void main() {
            vec2 offset = amount * vec2(cos(angle), sin(angle));
            
            float r = texture2D(tDiffuse, vUv + offset).r;
            float g = texture2D(tDiffuse, vUv).g;
            float b = texture2D(tDiffuse, vUv - offset).b;
            
            gl_FragColor = vec4(r, g, b, 1.0);
        }
    `
};

window.RGBShiftShader = RGBShiftShader;
