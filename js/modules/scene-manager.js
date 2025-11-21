/**
 * SCENE-MANAGER.JS
 * Manages multiple 3D scenes and transitions between them
 */

class SceneManager {
    constructor(scene, camera, isMobile = false) {
        this.scene = scene;
        this.camera = camera;
        this.isMobile = isMobile;
        
        this.scenes = [];
        this.currentSceneIndex = 0;
        this.isTransitioning = false;
        
        // Reduce geometry complexity on mobile
        const sphereSegments = isMobile ? 16 : 32;
        const torusSegments = isMobile ? 8 : 16;
        const torusRadialSegments = isMobile ? 50 : 100;
        
        this.geometryPool = {
            plane: new THREE.PlaneGeometry(2, 2),
            box: new THREE.BoxGeometry(1, 1, 1),
            sphere: new THREE.SphereGeometry(1, sphereSegments, sphereSegments),
            torus: new THREE.TorusGeometry(1, 0.4, torusSegments, torusRadialSegments)
        };
        
        this.init();
    }
    
    init() {
        this.createScene0();
        this.createScene1();
        this.createScene2();
        this.createScene3();
        
        this.switchScene(0, true);
    }
    
    createScene0() {
        const sceneObjects = [];
        // Reduce particle count on mobile for better performance
        const particleCount = this.isMobile ? 50 : 100;
        
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = Utils.random(-5, 5);
            positions[i * 3 + 1] = Utils.random(-3, 3);
            positions[i * 3 + 2] = Utils.random(-5, 5);
            
            velocities.push({
                x: Utils.random(-0.02, 0.02),
                y: Utils.random(-0.02, 0.02),
                z: Utils.random(-0.02, 0.02)
            });
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.PointsMaterial({
            color: 0x00fff9,
            size: 0.05,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        const particles = new THREE.Points(geometry, material);
        sceneObjects.push(particles);
        
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x00fff9,
            transparent: true,
            opacity: 0.2
        });
        
        const lines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMaterial);
        sceneObjects.push(lines);
        
        this.scenes.push({
            name: 'INIT',
            objects: sceneObjects,
            update: (time) => {
                const positions = particles.geometry.attributes.position.array;
                for (let i = 0; i < particleCount; i++) {
                    positions[i * 3] += velocities[i].x;
                    positions[i * 3 + 1] += velocities[i].y;
                    positions[i * 3 + 2] += velocities[i].z;
                    
                    if (Math.abs(positions[i * 3]) > 5) velocities[i].x *= -1;
                    if (Math.abs(positions[i * 3 + 1]) > 3) velocities[i].y *= -1;
                    if (Math.abs(positions[i * 3 + 2]) > 5) velocities[i].z *= -1;
                }
                particles.geometry.attributes.position.needsUpdate = true;
                
                const linePositions = [];
                for (let i = 0; i < particleCount; i++) {
                    for (let j = i + 1; j < particleCount; j++) {
                        const dx = positions[i * 3] - positions[j * 3];
                        const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
                        const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
                        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                        
                        if (distance < 2) {
                            linePositions.push(
                                positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2],
                                positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]
                            );
                        }
                    }
                }
                
                lines.geometry.setAttribute('position', 
                    new THREE.BufferAttribute(new Float32Array(linePositions), 3));
            }
        });
    }
    
    createScene1() {
        const sceneObjects = [];
        
        const shapes = [
            { geo: this.geometryPool.box, pos: [-2, 0, 0], rot: [0, 0, 0] },
            { geo: this.geometryPool.sphere, pos: [0, 0, 0], rot: [0, 0, 0] },
            { geo: this.geometryPool.torus, pos: [2, 0, 0], rot: [0, 0, 0] }
        ];
        
        shapes.forEach(shape => {
            const material = new THREE.MeshBasicMaterial({
                color: 0x00d9ff,
                wireframe: true,
                transparent: true,
                opacity: 0.8
            });
            
            const mesh = new THREE.Mesh(shape.geo, material);
            mesh.position.set(...shape.pos);
            sceneObjects.push(mesh);
        });
        
        this.scenes.push({
            name: 'WORK',
            objects: sceneObjects,
            update: (time) => {
                sceneObjects.forEach((obj, i) => {
                    obj.rotation.x = time * 0.3 + i;
                    obj.rotation.y = time * 0.5 + i;
                    obj.position.y = Math.sin(time + i) * 0.5;
                });
            }
        });
    }
    
    createScene2() {
        const sceneObjects = [];
        
        const gridSize = 20;
        const gridHelper = new THREE.GridHelper(gridSize, gridSize, 0xff00ea, 0xff00ea);
        gridHelper.material.transparent = true;
        gridHelper.material.opacity = 0.3;
        sceneObjects.push(gridHelper);
        
        // Reduce cube count on mobile
        const cubeCount = this.isMobile ? 25 : 50;
        const cubes = [];
        
        for (let i = 0; i < cubeCount; i++) {
            const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
            const material = new THREE.MeshBasicMaterial({
                color: 0xff00ea,
                wireframe: true,
                transparent: true,
                opacity: 0.6
            });
            
            const cube = new THREE.Mesh(geometry, material);
            cube.position.x = Utils.random(-gridSize/2, gridSize/2);
            cube.position.y = 0.25;
            cube.position.z = Utils.random(-gridSize/2, gridSize/2);
            
            cube.userData.phase = Utils.random(0, Math.PI * 2);
            cube.userData.speed = Utils.random(1, 3);
            
            cubes.push(cube);
            sceneObjects.push(cube);
        }
        
        this.scenes.push({
            name: 'INFO',
            objects: sceneObjects,
            update: (time) => {
                cubes.forEach(cube => {
                    const scale = 1 + Math.sin(time * cube.userData.speed + cube.userData.phase) * 0.5;
                    cube.scale.set(scale, scale, scale);
                    cube.rotation.y = time * 0.5;
                });
            }
        });
    }
    
    createScene3() {
        const sceneObjects = [];
        
        // Reduce line count on mobile
        const lineCount = this.isMobile ? 25 : 50;
        const radius = 3;
        
        for (let i = 0; i < lineCount; i++) {
            const t = i / lineCount;
            const angle = t * Math.PI * 4;
            const r = radius * t;
            
            const points = [];
            points.push(new THREE.Vector3(
                Math.cos(angle) * r,
                t * 5 - 2.5,
                Math.sin(angle) * r
            ));
            points.push(new THREE.Vector3(
                Math.cos(angle + 0.1) * (r + 0.1),
                t * 5 - 2.5,
                Math.sin(angle + 0.1) * (r + 0.1)
            ));
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
                color: 0xfff700,
                transparent: true,
                opacity: 0.7
            });
            
            const line = new THREE.Line(geometry, material);
            line.userData.index = i;
            sceneObjects.push(line);
        }
        
        this.scenes.push({
            name: 'CONTACT',
            objects: sceneObjects,
            update: (time) => {
                sceneObjects.forEach((line, i) => {
                    line.rotation.y = time * 0.5 + i * 0.1;
                    line.position.y = Math.sin(time + i * 0.1) * 0.5;
                });
            }
        });
    }
    
    switchScene(index, immediate = false) {
        if (index === this.currentSceneIndex || this.isTransitioning) return;
        if (index < 0 || index >= this.scenes.length) return;
        
        this.isTransitioning = true;
        
        const currentScene = this.scenes[this.currentSceneIndex];
        const nextScene = this.scenes[index];
        
        if (currentScene) {
            currentScene.objects.forEach(obj => {
                this.scene.remove(obj);
            });
        }
        
        nextScene.objects.forEach(obj => {
            this.scene.add(obj);
            if (!immediate) {
                obj.visible = false;
            }
        });
        
        if (!immediate) {
            setTimeout(() => {
                nextScene.objects.forEach(obj => {
                    obj.visible = true;
                });
                this.isTransitioning = false;
            }, 300);
        } else {
            this.isTransitioning = false;
        }
        
        this.currentSceneIndex = index;
        
        document.querySelectorAll('.nav-item').forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });
    }
    
    update(time) {
        const currentScene = this.scenes[this.currentSceneIndex];
        if (currentScene && currentScene.update) {
            currentScene.update(time);
        }
    }
    
    getCurrentSceneName() {
        return this.scenes[this.currentSceneIndex]?.name || '';
    }
}

window.SceneManager = SceneManager;
