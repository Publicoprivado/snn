import * as THREE from 'three';
import gsap from 'gsap';

export class InputManager {
    constructor(camera, renderer, connectionManager) {
        this.camera = camera;
        this.renderer = renderer;
        this.connectionManager = connectionManager;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.draggedNeuron = null;
        this.isDragging = false;
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.dragOffset = new THREE.Vector3();
        this.lastPosition = new THREE.Vector3();
        this.velocity = new THREE.Vector3();

        // Mobile-specific properties
        this.isMobile = 'ontouchstart' in window;
        this.lastTouchDistance = 0;
        this.isMultiTouch = false;
        this.lastTapTime = 0;
        this.doubleTapDelay = 300;
        this.lastTapPosition = { x: 0, y: 0 };
        this.tapDistanceThreshold = 30;

        // Mobile GUI properties - only create if on mobile
        if (this.isMobile) {
            this.selectedConnection = null;
            this.mobileControls = null;
            this.createMobileControls();
        }


        this.lastClickTime = 0;
        this.doubleClickDelay = 300; // milliseconds
        this.lastClickPosition = { x: 0, y: 0 };
        this.clickDistanceThreshold = 30;

        // Bind methods
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);

        // Prevent default touch behavior on the canvas
        renderer.domElement.style.touchAction = 'none';

        // Add event listeners based on device type
        if (this.isMobile) {
            renderer.domElement.addEventListener('touchstart', this.onTouchStart, { passive: false });
            renderer.domElement.addEventListener('touchmove', this.onTouchMove, { passive: false });
            renderer.domElement.addEventListener('touchend', this.onTouchEnd, { passive: false });
            // Prevent context menu on long press
            renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
        } else {
            renderer.domElement.addEventListener('mousedown', this.onMouseDown);
            renderer.domElement.addEventListener('mousemove', this.onMouseMove);
            renderer.domElement.addEventListener('mouseup', this.onMouseUp);
            renderer.domElement.addEventListener('wheel', this.onWheel);
            renderer.domElement.addEventListener('dblclick', this.onDoubleClick.bind(this)); // Add double click for desktop
        }
    }

    createMobileControls() {
        this.mobileControls = document.createElement('div');
        this.mobileControls.style.position = 'fixed';
        this.mobileControls.style.bottom = '20px';
        this.mobileControls.style.left = '50%';
        this.mobileControls.style.transform = 'translateX(-50%)';
        this.mobileControls.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.mobileControls.style.padding = '15px';
        this.mobileControls.style.borderRadius = '10px';
        this.mobileControls.style.display = 'none';
        this.mobileControls.style.zIndex = '1000';
        this.mobileControls.style.width = '80%';
        this.mobileControls.style.maxWidth = '300px';

        const title = document.createElement('div');
        title.textContent = 'Synapse Control';
        title.style.color = 'white';
        title.style.textAlign = 'center';
        title.style.marginBottom = '15px';
        title.style.fontSize = '18px';
        this.mobileControls.appendChild(title);

        // Weight Slider
        const weightContainer = this.createSliderContainer('Weight');
        this.mobileControls.appendChild(weightContainer);

        // Speed Slider
        const speedContainer = this.createSliderContainer('Speed');
        this.mobileControls.appendChild(speedContainer);

        document.body.appendChild(this.mobileControls);
    }

    createSliderContainer(label) {
        const container = document.createElement('div');
        container.style.marginBottom = '20px';
        
        const labelElement = document.createElement('div');
        labelElement.style.color = 'white';
        labelElement.style.marginBottom = '10px';
        labelElement.style.display = 'flex';
        labelElement.style.justifyContent = 'space-between';
        labelElement.style.alignItems = 'center';
        
        const labelText = document.createElement('span');
        labelText.textContent = label;
        labelText.style.fontSize = '16px';
        labelElement.appendChild(labelText);
        
        const value = document.createElement('span');
        value.textContent = '0.50';
        value.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        value.style.padding = '4px 8px';
        value.style.borderRadius = '4px';
        value.style.fontSize = '14px';
        labelElement.appendChild(value);
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '1';
        slider.step = '0.01';
        slider.value = '0.5';
        slider.style.width = '100%';
        slider.style.height = '20px';
        slider.style.webkitAppearance = 'none';
        slider.style.appearance = 'none';
        slider.style.background = 'rgba(255, 255, 255, 0.1)';
        slider.style.outline = 'none';
        slider.style.borderRadius = '10px';
        slider.style.transition = 'background 0.2s';
        
        // Slider thumb styles
        const thumbStyles = `
            input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 24px;
                height: 24px;
                background: #4CAF50;
                border-radius: 50%;
                cursor: pointer;
                transition: background 0.2s;
            }
            input[type="range"]::-webkit-slider-thumb:hover {
                background: #45a049;
            }
            input[type="range"]::-moz-range-thumb {
                width: 24px;
                height: 24px;
                background: #4CAF50;
                border-radius: 50%;
                cursor: pointer;
                border: none;
                transition: background 0.2s;
            }
            input[type="range"]::-moz-range-thumb:hover {
                background: #45a049;
            }
        `;
    
        // Add styles to document if not already added
        if (!document.getElementById('sliderStyles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'sliderStyles';
            styleSheet.textContent = thumbStyles;
            document.head.appendChild(styleSheet);
        }
        
        slider.addEventListener('input', (e) => {
            value.textContent = parseFloat(e.target.value).toFixed(2);
            if (label === 'Weight') {
                this.updateConnectionWeight(e.target.value);
            } else {
                this.updateConnectionSpeed(e.target.value);
            }
        });
    
        container.appendChild(labelElement);
        container.appendChild(slider);
        return container;
    }
    updateMousePosition(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    updateTouchPosition(touch) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    }

    getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getIntersectionPoint(mouse) {
        this.raycaster.setFromCamera(mouse, this.camera);
        const intersectionPoint = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.dragPlane, intersectionPoint);
        return intersectionPoint;
    }

    updateConnectionWeight(value) {
        if (!this.isMobile || !this.selectedConnection) return;
        const newWeight = parseFloat(value);
        this.selectedConnection.weight = newWeight;
        
        const targetIndex = window.circles.indexOf(this.selectedConnection.target);
        if (this.selectedConnection.source?.neuron) {
            this.selectedConnection.source.neuron.updateConnectionWeight(targetIndex, newWeight);
        }
    }

    updateConnectionSpeed(value) {
        if (!this.isMobile || !this.selectedConnection) return;
        const newSpeed = parseFloat(value);
        this.selectedConnection.speed = newSpeed;
        
        const targetIndex = window.circles.indexOf(this.selectedConnection.target);
        if (this.selectedConnection.source?.neuron) {
            this.selectedConnection.source.neuron.updateConnectionSpeed(targetIndex, newSpeed);
        }
    }

    onTouchStart(event) {
        event.preventDefault();
        const touch = event.touches[0];
        const currentTime = Date.now();
    
        if (event.touches.length === 2) {
            this.isMultiTouch = true;
            this.lastTouchDistance = this.getTouchDistance(event.touches);
            return;
        }
    
        // Check for arrows/synapses first
        this.updateTouchPosition(touch);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const arrows = Array.from(this.connectionManager.connections.values())
            .map(connection => connection.arrow)
            .filter(Boolean);
    
        const arrowIntersects = this.raycaster.intersectObjects(arrows);
    
        if (arrowIntersects.length > 0) {
            this.connectionManager.connections.forEach((connection) => {
                if (connection.arrow === arrowIntersects[0].object) {
                    this.selectedConnection = connection;
                    
                    // Update slider values
                    const weightSlider = this.mobileControls.querySelector('input[type="range"]:nth-of-type(1)');
                    const speedSlider = this.mobileControls.querySelector('input[type="range"]:nth-of-type(2)');
                    const weightValue = this.mobileControls.querySelector('div:nth-of-type(2) span');
                    const speedValue = this.mobileControls.querySelector('div:nth-of-type(3) span');
                    
                    weightSlider.value = connection.weight || 0.5;
                    speedSlider.value = connection.speed || 0.5;
                    weightValue.textContent = (connection.weight || 0.5).toFixed(2);
                    speedValue.textContent = (connection.speed || 0.5).toFixed(2);
                    
                    // Show controls
                    this.mobileControls.style.display = 'block';
                }
            });
            return;
        }
    
        // If we click anywhere else, hide the controls
        if (this.mobileControls.style.display === 'block') {
            this.mobileControls.style.display = 'none';
            this.selectedConnection = null;
        }
    
        // Handle double tap
        const tapPosition = { x: touch.clientX, y: touch.clientY };
        const timeDiff = currentTime - this.lastTapTime;
        const distance = Math.sqrt(
            Math.pow(tapPosition.x - this.lastTapPosition.x, 2) +
            Math.pow(tapPosition.y - this.lastTapPosition.y, 2)
        );
    
        if (timeDiff < this.doubleTapDelay && distance < this.tapDistanceThreshold) {
            this.updateTouchPosition(touch);
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(window.circles);
            
            if (intersects.length > 0) {
                // Handle existing neuron double tap
                const neuron = intersects[0].object;
                const currentDC = neuron.neuron.dcInput || 0;
                const newDC = Math.min(1, currentDC + 0.1);
                neuron.neuron.setDCInput(newDC);
            } else {
                // Create new neuron on empty space double tap
                const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                const intersectionPoint = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(plane, intersectionPoint);
                
                // Create new neuron at intersection point
                const neuron = window.settings.addNeuron(intersectionPoint);
                if (neuron) {
                    neuron.position.copy(intersectionPoint);
                    neuron.position.y = -10; // Keep it on the ground plane
                }
            }
        }
    
        this.lastTapTime = currentTime;
        this.lastTapPosition = tapPosition;
    
        // Handle regular touch start
        this.updateTouchPosition(touch);
        this.onMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
    }


    onDoubleClick(event) {
        event.preventDefault();
        
        // Get mouse position in normalized device coordinates (-1 to +1)
        this.updateMousePosition(event);
        
        // Set up raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Create a plane at y=0 to intersect with
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersectionPoint = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(plane, intersectionPoint);
        
        // Check if we clicked on empty space (not on existing neurons)
        const intersects = this.raycaster.intersectObjects(window.circles);
        if (intersects.length === 0) {
            // Create new neuron at intersection point
            const neuron = window.settings.addNeuron(intersectionPoint);
            if (neuron) {
                neuron.position.copy(intersectionPoint);
                neuron.position.y = -10; // Keep it on the ground plane
            }
        }
    }
onTouchMove(event) {
    event.preventDefault();

    if (event.touches.length === 2) {
        // Reset velocity to prevent slingshot
        this.velocity.set(0, 0, 0);
        
        const currentDistance = this.getTouchDistance(event.touches);
        const delta = (currentDistance - this.lastTouchDistance) * 0.01;
        
        // Calculate midpoint between fingers
        const midpoint = {
            x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
            y: (event.touches[0].clientY + event.touches[1].clientY) / 2
        };
        
        if (this.draggedNeuron?.neuron) {
            const currentDC = this.draggedNeuron.neuron.dcInput || 0;
            const newDC = Math.max(0, Math.min(1, currentDC + delta));
            this.draggedNeuron.neuron.setDCInput(newDC);
            
            // Update position based on midpoint
            this.updateTouchPosition({ clientX: midpoint.x, clientY: midpoint.y });
            this.lastPosition.copy(this.draggedNeuron.position);
        }
        
        this.lastTouchDistance = currentDistance;
        this.lastMidpoint = midpoint; // Store midpoint for touch end
        return;
    }

    const touch = event.touches[0];
    this.updateTouchPosition(touch);
    this.onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
}

onTouchEnd(event) {
    event.preventDefault();
    
    if (this.isMultiTouch) {
        // If we were pinching, use the last midpoint position
        if (this.lastMidpoint && this.draggedNeuron) {
            this.updateTouchPosition({ clientX: this.lastMidpoint.x, clientY: this.lastMidpoint.y });
            this.velocity.set(0, 0, 0); // Reset velocity to prevent throw
        }
        this.isMultiTouch = false;
        this.lastTouchDistance = 0;
        this.lastMidpoint = null;
    }
    
    if (event.touches.length === 0) {
        this.onMouseUp();
    }
}

    onMouseDown(event) {
        this.updateMousePosition(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(window.circles);
        
        if (intersects.length > 0) {
            this.isDragging = true;
            this.draggedNeuron = intersects[0].object;
            
            const intersectionPoint = this.getIntersectionPoint(this.mouse);
            this.dragOffset.copy(this.draggedNeuron.position).sub(intersectionPoint);
            this.lastPosition.copy(this.draggedNeuron.position);
        }
    }

    onMouseMove(event) {
        if (!this.isDragging || !this.draggedNeuron) return;
    
        this.updateMousePosition(event);
        const intersectionPoint = this.getIntersectionPoint(this.mouse);
        
        const newPosition = intersectionPoint.add(this.dragOffset);
        newPosition.y = 0;
    
        this.velocity.subVectors(newPosition, this.lastPosition);
        
        this.draggedNeuron.position.copy(newPosition);
        this.lastPosition.copy(newPosition);
    
        // Check for nearby neurons and trigger feedback
        const circles = window.circles || [];
        circles.forEach(otherNeuron => {
            if (otherNeuron === this.draggedNeuron) return;
            
            const distance = this.draggedNeuron.position.distanceTo(otherNeuron.position);
            const threshold = 0.5;
    
            // Check if connection exists
            let connectionExists = false;
            this.connectionManager.connections.forEach(connection => {
                if ((connection.source === this.draggedNeuron && connection.target === otherNeuron) ||
                    (connection.source === otherNeuron && connection.target === this.draggedNeuron)) {
                    connectionExists = true;
                }
            });
    
            if (distance < threshold && !connectionExists) {
                // Trigger green feedback on both neurons
                const originalColor = this.draggedNeuron.material.color.clone();
                gsap.to(this.draggedNeuron.material.color, {
                    r: 0,
                    g: 1,
                    b: 0,
                    duration: 0.2,
                    onComplete: () => {
                        gsap.to(this.draggedNeuron.material.color, {
                            r: originalColor.r,
                            g: originalColor.g,
                            b: originalColor.b,
                            duration: 0.2
                        });
                    }
                });
            }
        });
    
        // Check for connections while dragging
        this.connectionManager.checkProximityConnection(this.draggedNeuron);
    }

    onMouseUp() {
        if (this.isDragging && this.draggedNeuron) {
            const speed = this.velocity.length();
            if (speed > 0.001) {
                const targetPosition = new THREE.Vector3()
                    .copy(this.draggedNeuron.position)
                    .add(this.velocity.multiplyScalar(10));

                gsap.to(this.draggedNeuron.position, {
                    x: targetPosition.x,
                    z: targetPosition.z,
                    duration: 0.5,
                    ease: "power2.out",
                    onUpdate: () => {
                        this.connectionManager.checkProximityConnection(this.draggedNeuron);
                    }
                });
            }
        }

        this.isDragging = false;
        this.draggedNeuron = null;
        this.velocity.set(0, 0, 0);
    }

    onWheel(event) {
        event.preventDefault();
        
        this.updateMousePosition(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(window.circles);
        
        if (intersects.length > 0) {
            const neuron = intersects[0].object;
            const delta = event.deltaY > 0 ? -0.1 : 0.1;
            
            if (neuron.neuron) {
                // If we're increasing DC input (scrolling up), reset the neuron's state
                if (delta > 0) {
                    neuron.neuron.currentCharge = neuron.neuron.dcInput || 0;
                    neuron.neuron.isFiring = false;
                    neuron.neuron.lastFiringTime = 0;
                }
                
                let newDC = (neuron.neuron.dcInput || 0) + delta;
                newDC = Math.max(0, Math.min(1, newDC));
                
                // Reset neuron state if DC becomes 0
                if (newDC === 0) {
                    neuron.neuron.currentCharge = 0;
                    neuron.neuron.isFiring = false;
                    neuron.neuron.lastFiringTime = 0;
                }
                
                neuron.neuron.setDCInput(newDC);
                
                // Force update scale
                const targetScale = neuron.neuron.baseScale + 
                    (neuron.neuron.maxScale - neuron.neuron.baseScale) * newDC;
                
                gsap.to(neuron.scale, {
                    x: targetScale,
                    y: targetScale,
                    z: targetScale,
                    duration: 0.2,
                    ease: "power2.out"
                });
            }
        }
    }

    cleanup() {
        if (this.isMobile) {
            this.renderer.domElement.removeEventListener('touchstart', this.onTouchStart);
            this.renderer.domElement.removeEventListener('touchmove', this.onTouchMove);
            this.renderer.domElement.removeEventListener('touchend', this.onTouchEnd);
            this.renderer.domElement.removeEventListener('contextmenu', e => e.preventDefault());
            
            if (this.mobileControls?.parentNode) {
                this.mobileControls.parentNode.removeChild(this.mobileControls);
                this.mobileControls = null;
            }
        } else {
            this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
            this.renderer.domElement.removeEventListener('mousemove', this.onMouseMove);
            this.renderer.domElement.removeEventListener('mouseup', this.onMouseUp);
            this.renderer.domElement.removeEventListener('wheel', this.onWheel);
            this.renderer.domElement.removeEventListener('dblclick', this.onDoubleClick.bind(this)); // Added this line
        }
    }
}