/**
 * DATAMOSH.JS
 * Datamoshing shader - creates video compression artifacts and motion bleeding
 */

const DatamoshShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'tPrevious': { value: null },
        'amount': { value: 0.5 },
        'time': { value: 0.0 }
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
        uniform sampler2D tPrevious;
        uniform float amount;
        uniform float time;
        
        varying vec2 vUv;
        
        float random(vec2 co) {
            return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
        }
        
        void main() {
            vec2 uv = vUv;
            
            vec4 current = texture2D(tDiffuse, uv);
            vec4 previous = texture2D(tPrevious, uv);
            
            float blockSize = 8.0;
            vec2 blockUv = floor(uv * blockSize) / blockSize;
            float blockRandom = random(blockUv + time);
            
            vec4 color;
            if (blockRandom > (1.0 - amount * 0.3)) {
                vec2 offset = (vec2(random(blockUv), random(blockUv + 0.5)) - 0.5) * 0.02 * amount;
                color = texture2D(tPrevious, uv + offset);
            } else {
                color = current;
            }
            
            float blockiness = step(0.5, fract(uv.x * 40.0)) * step(0.5, fract(uv.y * 30.0));
            color.rgb -= blockiness * 0.05 * amount;
            
            if (random(blockUv + time * 0.5) > 0.95) {
                color.r = previous.r;
            }
            if (random(blockUv + time * 0.7) > 0.95) {
                color.g = previous.g;
            }
            
            gl_FragColor = color;
        }
    `
};

window.DatamoshShader = DatamoshShader;
