import * as THREE from 'three';
import { gsap } from 'gsap';
import { SoundManager } from './SoundManager';

export class ConnectionManager {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.connections = new Map();
        this.soundManager = new SoundManager();
        
        // Core properties
        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Line.threshold = 10;
        this.mouse = new THREE.Vector2();
        
        // State
        this.isDraggingArrow = false;
        this.selectedArrow = null;
        this.selectedConnection = null;
        this.isDraggingBeforeStart = false;
        this.lastTapTime = 0;
        this.doubleTapDelay = 300;
        this.lastTapPosition = { x: 0, y: 0 };
        this.tapDistanceThreshold = 30;

        // Performance
        this.frameCount = 0;
        this.updateInterval = 3;
        this.needsUpdate = false;
        this.lastUpdateTime = 0;
        this.updateThreshold = 1000 / 120;
        
        // Cache
        this.arrowsCache = [];
        this.lastConnectionCount = 0;
        this.cachedRect = this.renderer.domElement.getBoundingClientRect();
        this.lastRectUpdate = 0;
        this.rectUpdateInterval = 1000;
        
        this.setupGeometry();
        this.setupEventListeners();
        
        // Validation interval
        this.validationInterval = setInterval(() => this.validateConnections(), 5000);
    }

    setupGeometry() {
          // Check if device is mobile
        const isMobile = 'ontouchstart' in window;
        
        // Set size multiplier based on device type
        const sizeMultiplier = isMobile ? 1.55 : 1; // 15% larger for mobile
        
        this.arrowShape = new THREE.Shape();
        this.arrowShape.moveTo(1.4 * sizeMultiplier, 0);
        this.arrowShape.lineTo(-0.7 * sizeMultiplier, 1.05 * sizeMultiplier);
        this.arrowShape.lineTo(-0.7 * sizeMultiplier, -1.05 * sizeMultiplier);
        this.arrowShape.lineTo(1.4 * sizeMultiplier, 0);

        const extrudeSettings = {
            steps: 1,
            depth: 0.2,
            bevelEnabled: false
        };
        
        this.arrowGeometry = new THREE.ExtrudeGeometry(this.arrowShape, extrudeSettings);
        this.arrowGeometry.computeBoundingSphere();
        this.arrowGeometry.computeBoundingBox();
        
        this.arrowMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            transparent: true,
            depthTest: true,
            depthWrite: true,
            precision: 'lowp'
        });
    }

    setupEventListeners() {
        const canvas = this.renderer.domElement;
        
        // Bind methods
        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
        this.handleDoubleClick = this.handleDoubleClick.bind(this);
        this.handleWheel = this.handleWheel.bind(this);

        // Mouse events
        canvas.addEventListener('mousedown', this.handlePointerDown);
        canvas.addEventListener('mousemove', this.handlePointerMove);
        canvas.addEventListener('mouseup', this.handlePointerUp);
        canvas.addEventListener('wheel', this.handleWheel);
        canvas.addEventListener('dblclick', this.handleDoubleClick);
        canvas.addEventListener('mouseleave', () => this.hideWeightLabel());

        // Touch events
        canvas.addEventListener('touchstart', this.handlePointerDown);
        canvas.addEventListener('touchmove', this.handlePointerMove);
        canvas.addEventListener('touchend', this.handlePointerUp);
        
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        canvas.style.touchAction = 'none';
    }

    updateMousePosition(event) {
        const now = performance.now();
        
        if (now - this.lastRectUpdate > this.rectUpdateInterval) {
            this.cachedRect = this.renderer.domElement.getBoundingClientRect();
            this.lastRectUpdate = now;
        }
        
        if (event.touches) {
            const touch = event.touches[0];
            this.mouse.x = ((touch.clientX - this.cachedRect.left) / this.cachedRect.width) * 2 - 1;
            this.mouse.y = -((touch.clientY - this.cachedRect.top) / this.cachedRect.height) * 2 + 1;
        } else {
            this.mouse.x = ((event.clientX - this.cachedRect.left) / this.cachedRect.width) * 2 - 1;
            this.mouse.y = -((event.clientY - this.cachedRect.top) / this.cachedRect.height) * 2 + 1;
        }
    }


    checkProximityConnection(neuron) {
        if (!neuron || !neuron.position) return;

        const circles = window.circles || [];
        circles.forEach(otherNeuron => {
            if (!otherNeuron || !otherNeuron.position) return;
            if (neuron === otherNeuron) return;

            const distance = neuron.position.distanceTo(otherNeuron.position);
            const threshold = 0.5;

            let existingConnection = null;
            let existingGroup = null;
            
            this.connections.forEach((connection, connectionGroup) => {
                if (!connection.source || !connection.target) return;
                
                if ((connection.source === neuron && connection.target === otherNeuron) ||
                    (connection.source === otherNeuron && connection.target === neuron)) {
                    existingConnection = connection;
                    existingGroup = connectionGroup;
                }
            });

            if (distance < threshold) {
                const triggerVisualFeedback = (targetNeuron) => {
                    const originalColor = targetNeuron.material.color.clone();
                    const originalScale = targetNeuron.scale.clone();
                    
                    gsap.timeline()
                        .to(targetNeuron.scale, {
                            x: originalScale.x * 1.3,
                            y: originalScale.y * 1.3,
                            z: originalScale.z * 1.3,
                            duration: 0.2,
                            ease: "power2.out"
                        }, 0)
                        .to(targetNeuron.material.color, {
                            r: 0,
                            g: 1,
                            b: 0,
                            duration: 0.2
                        }, 0)
                        .to(targetNeuron.scale, {
                            x: originalScale.x,
                            y: originalScale.y,
                            z: originalScale.z,
                            duration: 0.2,
                            ease: "power2.in"
                        }, 0.2)
                        .to(targetNeuron.material.color, {
                            r: originalColor.r,
                            g: originalColor.g,
                            b: originalColor.b,
                            duration: 0.2
                        }, 0.2);
                };

                if (existingConnection) {
                    if (existingConnection.source !== neuron) {
                        const oldTargetIndex = window.circles.indexOf(existingConnection.target);
                        existingConnection.source.neuron.removeConnection(oldTargetIndex);
                        
                        existingConnection.line.geometry.dispose();
                        existingConnection.line.material.dispose();
                        existingConnection.arrow.geometry.dispose();
                        existingConnection.arrow.material.dispose();
                        this.scene.remove(existingGroup);
                        this.connections.delete(existingGroup);
                        
                        triggerVisualFeedback(neuron);
                        triggerVisualFeedback(otherNeuron);
                        this.createConnection(neuron, otherNeuron);
                    }
                } else {
                    triggerVisualFeedback(neuron);
                    triggerVisualFeedback(otherNeuron);
                    this.createConnection(neuron, otherNeuron);
                }
            }
        });
    }

    updateConnectionProperties(weight, speed) {
        if (this.selectedConnection) {
            if (weight !== undefined) {
                this.selectedConnection.weight = weight;
                const targetIndex = window.circles.indexOf(this.selectedConnection.target);
                if (this.selectedConnection.source?.neuron) {
                    this.selectedConnection.source.neuron.updateConnectionWeight(targetIndex, weight);
                }
            }
    
            if (speed !== undefined) {
                this.selectedConnection.speed = speed;
                const targetIndex = window.circles.indexOf(this.selectedConnection.target);
                if (this.selectedConnection.source?.neuron) {
                    this.selectedConnection.source.neuron.updateConnectionSpeed(targetIndex, speed);
                }
    
                // Update arrow position based on speed
                if (this.selectedConnection.arrow) {
                    const source = this.selectedConnection.source.position;
                    const target = this.selectedConnection.target.position;
                    const position = new THREE.Vector3().lerpVectors(
                        source,
                        target,
                        0.2 + (speed * 0.6)  // Map 0-1 to 0.2-0.8 range
                    );
                    this.selectedConnection.arrow.position.set(position.x, -10, position.z);
                }
            }
    
            // Update GUI to reflect current values
            if (window.settings) {
                window.settings.selectedConnection = this.selectedConnection;
                if (weight !== undefined) window.settings.selectedWeight = weight;
                if (speed !== undefined) window.settings.selectedSpeed = speed;
            }
    
            const connectionGroup = Array.from(this.connections.entries())
                .find(([_, conn]) => conn === this.selectedConnection)?.[0];
            if (connectionGroup) {
                this.updateConnection(connectionGroup);
            }

            // Show updated weight label if visible
            if (this.weightLabel && this.selectedConnection.arrow) {
                this.showWeightLabel(this.selectedConnection.arrow, this.selectedConnection.weight);
            }
        }
    }

    updateArrowsCache() {
        if (this.connections.size !== this.lastConnectionCount) {
            this.arrowsCache = Array.from(this.connections.values())
                .map(connection => connection.arrow)
                .filter(Boolean);
            this.lastConnectionCount = this.connections.size;
        }
        return this.arrowsCache;
    }

    showWeightLabel(arrow, weight) {
        if (!this.weightLabel) {
            this.weightLabel = document.createElement('div');
            this.weightLabel.style.position = 'absolute';
            this.weightLabel.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
            this.weightLabel.style.padding = '5px';
            this.weightLabel.style.color = 'white';
            this.weightLabel.style.borderRadius = '3px';
            this.weightLabel.style.fontSize = '14px';
            this.weightLabel.style.fontFamily = 'Consolas, monospace';
            this.weightLabel.style.pointerEvents = 'none';
            document.body.appendChild(this.weightLabel);
        }

        let speed = 0;
        this.connections.forEach((connection) => {
            if (connection.arrow === arrow) {
                speed = connection.speed;
            }
        });

        this.weightLabel.innerHTML = `Weight: ${weight.toFixed(1)}<br>Speed: ${speed.toFixed(1)}`;
        const vector = new THREE.Vector3();
        arrow.getWorldPosition(vector);
        vector.project(this.camera);

        const x = (vector.x * 0.5 + 0.5) * this.renderer.domElement.clientWidth;
        const y = (-vector.y * 0.5 + 0.5) * this.renderer.domElement.clientHeight;

        this.weightLabel.style.left = `${x}px`;
        this.weightLabel.style.top = `${y - 50}px`;
    }

    hideWeightLabel() {
        if (this.weightLabel) {
            document.body.removeChild(this.weightLabel);
            this.weightLabel = null;
        }
    }

    handlePointerDown(event) {
        event.preventDefault();
        const isTouch = event.type === 'touchstart';
        const pointer = isTouch ? event.touches[0] : event;
        
        this.updateMousePosition(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const arrows = Array.from(this.connections.values())
            .map(connection => connection.arrow)
            .filter(Boolean);

        const intersects = this.raycaster.intersectObjects(arrows);
        
        if (intersects.length > 0) {
            this.connections.forEach((connection) => {
                if (connection.arrow === intersects[0].object) {
                    if (this.selectedConnection && this.selectedConnection !== connection) {
                        this.selectedConnection.arrow.material.color.setHex(0xffffff);
                        this.selectedConnection.arrow.scale.setScalar(0.25);
                    }

                    this.selectedConnection = connection;
                    this.selectedArrow = connection.arrow;
                    this.isDraggingArrow = true;
                    
                    if (window.settings) {
                        window.settings.selectedConnection = connection;
                        window.settings.selectedWeight = connection.weight || 0.5;
                        window.settings.selectedSpeed = connection.speed || 0.5;
                    }
                    
                    connection.arrow.material.color.setHex(0x00ff00);
                    connection.arrow.scale.setScalar(0.4);
                }
            });
        } else if (this.selectedConnection) {
            this.selectedConnection.arrow.material.color.setHex(0xffffff);
            this.selectedConnection = null;
            this.selectedArrow = null;
            this.isDraggingArrow = false;
            
            if (window.settings) {
                window.settings.selectedConnection = null;
                window.settings.selectedWeight = 0.5;
                window.settings.selectedSpeed = 0.5;
            }
        }

        if (isTouch) {
            const currentTime = Date.now();
            const tapPosition = { x: pointer.clientX, y: pointer.clientY };
            const timeDiff = currentTime - this.lastTapTime;
            const distance = Math.sqrt(
                Math.pow(tapPosition.x - this.lastTapPosition.x, 2) +
                Math.pow(tapPosition.y - this.lastTapPosition.y, 2)
            );

            if (timeDiff < this.doubleTapDelay && distance < this.tapDistanceThreshold) {
                this.handleDoubleClick(event);
            }

            this.lastTapTime = currentTime;
            this.lastTapPosition = tapPosition;
        }
    }

    handlePointerMove(event) {
        if (!this.isDraggingArrow || !this.selectedArrow || !this.selectedConnection) {
            this.updateMousePosition(event);
            this.raycaster.setFromCamera(this.mouse, this.camera);
            
            const arrows = this.updateArrowsCache();
            const intersects = this.raycaster.intersectObjects(arrows);
            
            if (intersects.length > 0) {
                const arrow = intersects[0].object;
                const connection = Array.from(this.connections.values())
                    .find(conn => conn.arrow === arrow);
                if (connection) {
                    this.showWeightLabel(arrow, connection.weight);
                }
            } else {
                this.hideWeightLabel();
            }
            return;
        }

        event.preventDefault();
        const isTouch = event.type === 'touchmove';
        const pointer = isTouch ? event.touches[0] : event;
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouseX = pointer.clientX - rect.left;
        const mouseZ = pointer.clientY - rect.top;

        const source = this.selectedConnection.source.position.clone();
        const target = this.selectedConnection.target.position.clone();
        
        source.project(this.camera);
        target.project(this.camera);
        
        const sourceScreen = {
            x: (source.x + 1) * rect.width / 2,
            y: (-source.y + 1) * rect.height / 2
        };
        
        const targetScreen = {
            x: (target.x + 1) * rect.width / 2,
            y: (-target.y + 1) * rect.height / 2
        };

        const dragResult = this.calculateDragPosition(mouseX, mouseZ, sourceScreen, targetScreen);
        
        const worldPos = new THREE.Vector3();
        worldPos.copy(this.selectedConnection.source.position);
        const direction = new THREE.Vector3().subVectors(
            this.selectedConnection.target.position,
            this.selectedConnection.source.position
        ).normalize();
        
        const distance = this.selectedConnection.source.position.distanceTo(
            this.selectedConnection.target.position
        );
        
        worldPos.add(direction.multiplyScalar(dragResult.percentage * distance));
        this.selectedArrow.position.set(worldPos.x, -10, worldPos.z);

        this.selectedConnection.speed = dragResult.normalizedSpeed;
        
        if (window.settings) {
            window.settings.selectedSpeed = dragResult.normalizedSpeed;
        }

        this.needsUpdate = true;

        const targetIndex = window.circles.indexOf(this.selectedConnection.target);
        if (this.selectedConnection.source?.neuron) {
            this.selectedConnection.source.neuron.updateConnectionSpeed(targetIndex, dragResult.normalizedSpeed);
        }

        this.showWeightLabel(this.selectedArrow, this.selectedConnection.weight);
    }

    handlePointerUp(event) {
        if (!this.isDraggingArrow) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const speed = this.selectedConnection.speed;
        const targetIndex = window.circles.indexOf(this.selectedConnection.target);
        if (this.selectedConnection.source?.neuron) {
            this.selectedConnection.source.neuron.updateConnectionSpeed(targetIndex, speed);
        }
        
        this.isDraggingArrow = false;
        this.selectedArrow.material.color.setHex(0x00ff00);
        this.selectedArrow.scale.setScalar(0.25);
        
        if (window.settings) {
            window.settings.selectedConnection = this.selectedConnection;
            window.settings.selectedSpeed = speed;
            window.settings.selectedWeight = this.selectedConnection.weight;
        }

        this.isDraggingBeforeStart = false;
        this.hideWeightLabel();
    }

    handleWheel(event) {
        if (this.isDraggingArrow) return;
        event.preventDefault();
        
        this.updateMousePosition(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const arrows = this.updateArrowsCache();
        const intersects = this.raycaster.intersectObjects(arrows);
        
        if (intersects.length > 0) {
            const arrow = intersects[0].object;
            this.connections.forEach((connection, connectionGroup) => {
                if (connection.arrow === arrow) {
                    if (connection.source.neuron) {
                        connection.source.neuron.isScrolling = true;
                        if (connection.source.neuron.scrollTimeout) {
                            clearTimeout(connection.source.neuron.scrollTimeout);
                        }
                    }

                    const delta = event.deltaY > 0 ? -0.1 : 0.1;
                    const currentWeight = connection.weight ?? 0.5;
                    let newWeight = Math.max(0, Math.min(1, currentWeight + delta));
                    
                    connection.weight = newWeight;
                    if (window.settings) {
                        window.settings.selectedConnection = connection;
                        window.settings.selectedWeight = newWeight;
                    }
                    
                    const targetIndex = window.circles.indexOf(connection.target);
                    connection.source.neuron.updateConnectionWeight(targetIndex, newWeight);
                    
                    this.updateConnection(connectionGroup);
                    this.showWeightLabel(arrow, newWeight);

                    if (connection.source.neuron) {
                        connection.source.neuron.scrollTimeout = setTimeout(() => {
                            connection.source.neuron.isScrolling = false;
                            connection.source.neuron.updateVisualState();
                        }, 150);
                    }
                }
            });
        }
    }

    handleDoubleClick(event) {
        if (this.isDraggingArrow) {
            event.stopPropagation();
            return;
        }
        
        this.updateMousePosition(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const arrows = Array.from(this.connections.values())
            .map(connection => connection.arrow)
            .filter(Boolean);
        
        const intersects = this.raycaster.intersectObjects(arrows);
        if (intersects.length > 0) {
            const clickedArrow = intersects[0].object;
            this.connections.forEach((connection, connectionGroup) => {
                if (connection.arrow === clickedArrow) {
                    const targetIndex = window.circles.indexOf(connection.target);
                    connection.source.neuron.removeConnection(targetIndex);
                    
                    this.disposeConnection(connection, connectionGroup);
                }
            });
        }
    }

    calculateDragPosition(mouseX, mouseY, sourceScreen, targetScreen) {
        const screenVector = {
            x: targetScreen.x - sourceScreen.x,
            y: targetScreen.y - sourceScreen.y
        };

        const mouseVector = {
            x: mouseX - sourceScreen.x,
            y: mouseY - sourceScreen.y
        };

        const screenVectorLength = Math.sqrt(screenVector.x * screenVector.x + screenVector.y * screenVector.y);
        const dotProduct = mouseVector.x * screenVector.x + mouseVector.y * screenVector.y;
        
        let rawPercentage = dotProduct / (screenVectorLength * screenVectorLength);

        const sourceGrowth = this.selectedConnection.source.neuron ? 
            this.selectedConnection.source.neuron.baseScale + 
            (this.selectedConnection.source.neuron.dcInput * 0.2) : 0.2;
        const targetGrowth = this.selectedConnection.target.neuron ? 
            this.selectedConnection.target.neuron.baseScale + 
            (this.selectedConnection.target.neuron.dcInput * 0.2) : 0.2;

        const MIN_VISUAL = sourceGrowth;
        const MAX_VISUAL = 1 - targetGrowth;
        
        rawPercentage = Math.max(MIN_VISUAL, Math.min(MAX_VISUAL, rawPercentage));
        
        const normalizedSpeed = (rawPercentage - MIN_VISUAL) / (MAX_VISUAL - MIN_VISUAL);
        
        return {
            percentage: rawPercentage,
            normalizedSpeed: Math.max(0, Math.min(1, normalizedSpeed))
        };
    }

    updateAllConnections() {
        this.frameCount++;
        const now = performance.now();
        
        if (now - this.lastUpdateTime < this.updateThreshold && 
            !this.isDraggingArrow && 
            !this.needsUpdate) {
            return;
        }
        
        if (this.isDraggingArrow) {
            const connectionGroup = Array.from(this.connections.entries())
                .find(([_, conn]) => conn === this.selectedConnection)?.[0];
            if (connectionGroup) {
                this.updateConnection(connectionGroup);
            }
        } else {
            if (!this.needsUpdate && this.frameCount % this.updateInterval !== 0) {
                return;
            }
            
            for (const [connectionGroup, connection] of this.connections) {
                this.tempVec3 = new THREE.Vector3().copy(connection.source.position);
                const distToCamera = this.tempVec3.distanceTo(this.camera.position);
                if (distToCamera < 20) {
                    this.updateConnection(connectionGroup);
                }
            }
        }
        
        this.lastUpdateTime = now;
        this.needsUpdate = false;
    }

    updateConnection(connectionGroup) {
        const connection = this.connections.get(connectionGroup);
        if (!connection) return;

        const { source, target, line, arrow } = connection;
        
        const positions = line.geometry.attributes.position.array;
        positions[0] = source.position.x;
        positions[1] = -10;
        positions[2] = source.position.z;
        positions[3] = target.position.x;
        positions[4] = -10;
        positions[5] = target.position.z;
        line.geometry.attributes.position.needsUpdate = true;
        
        const direction = new THREE.Vector3().subVectors(target.position, source.position).normalize();

        const sourceGrowth = source.neuron ? 
            source.neuron.baseScale + (source.neuron.dcInput * 0.2) : 0.2;
        const targetGrowth = target.neuron ? 
            target.neuron.baseScale + (target.neuron.dcInput * 0.2) : 0.2;

        const minPosition = sourceGrowth;
        const maxPosition = 1 - targetGrowth;

        if (this.isDraggingArrow && arrow === this.selectedArrow) {
            arrow.material.opacity = 1.0;
            arrow.material.color.setHex(0xFFFFFF);
            arrow.scale.setScalar(0.3);
        } else {
            const baseOpacity = 0.4;
            const opacity = baseOpacity + (Math.abs(connection.weight ?? 0.5) * 0.6);
            arrow.material.opacity = opacity;
            arrow.scale.setScalar(0.25);
        }

        if (!this.isDraggingArrow || arrow !== this.selectedArrow) {
            const speed = connection.speed ?? 0.5;
            const restrictedPosition = minPosition + (speed * (maxPosition - minPosition));
            
            arrow.position.lerpVectors(
                source.position,
                target.position,
                restrictedPosition
            );
            arrow.position.y = -10;
        }

        const angle = Math.atan2(direction.z, direction.x);
        arrow.rotation.set(-Math.PI/2, 0, -angle);

        line.material.opacity = arrow.material.opacity;
        line.material.color.setHex(0xFFFFFF);
    }

    createConnection(sourceNeuron, targetNeuron) {
        if (!sourceNeuron || !sourceNeuron.position || 
            !targetNeuron || !targetNeuron.position) {
            console.warn('Invalid neurons for connection');
            return null;
        }
    
        // Generate random speed between 0.3 and 0.8
        const randomSpeed = 0.3 + Math.random() * 0.5;  // This gives us a range of 0.3 to 0.8
        
        const connectionGroup = new THREE.Group();
        
        const line = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                depthTest: true,
                depthWrite: true
            })
        );
        
        const positions = new Float32Array(6);
        line.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        const arrow = new THREE.Mesh(this.arrowGeometry, this.arrowMaterial.clone());
        arrow.userData.isConnectionArrow = true;
        arrow.matrixAutoUpdate = true;
        arrow.raycast = THREE.Mesh.prototype.raycast;
        
        connectionGroup.add(line);
        connectionGroup.add(arrow);
        
        const connection = {
            source: sourceNeuron,
            target: targetNeuron,
            line: line,
            arrow: arrow,
            weight: 0.2,
            speed: randomSpeed  // Use the random speed
        };
        this.connections.set(connectionGroup, connection);
        
        this.scene.add(connectionGroup);
    
        const targetIndex = window.circles.indexOf(targetNeuron);
        sourceNeuron.neuron.addConnection(targetIndex, connection.weight, connection.speed);
        
        return connectionGroup;
    }

    validateConnections() {
        for (const [group, connection] of this.connections) {
            if (!connection.arrow || !connection.arrow.parent) {
                console.warn('Invalid connection found:', connection);
                this.connections.delete(group);
                this.lastConnectionCount = this.connections.size;
            }
        }
    }

    disposeConnection(connection, connectionGroup) {
        connection.line.geometry.dispose();
        connection.line.material.dispose();
        connection.arrow.geometry.dispose();
        connection.arrow.material.dispose();
        this.scene.remove(connectionGroup);
        this.connections.delete(connectionGroup);
    }

    dispose() {
        const canvas = this.renderer.domElement;
        
        canvas.removeEventListener('mousedown', this.handlePointerDown);
        canvas.removeEventListener('mousemove', this.handlePointerMove);
        canvas.removeEventListener('mouseup', this.handlePointerUp);
        canvas.removeEventListener('wheel', this.handleWheel);
        canvas.removeEventListener('dblclick', this.handleDoubleClick);
        canvas.removeEventListener('mouseleave', () => this.hideWeightLabel());
        
        canvas.removeEventListener('touchstart', this.handlePointerDown);
        canvas.removeEventListener('touchmove', this.handlePointerMove);
        canvas.removeEventListener('touchend', this.handlePointerUp);
        
        canvas.removeEventListener('contextmenu', (e) => e.preventDefault());
        
        this.hideWeightLabel();
        this.arrowGeometry.dispose();
        this.arrowMaterial.dispose();
        
        this.connections.forEach(this.disposeConnection.bind(this));
        clearInterval(this.validationInterval);
    }
}
