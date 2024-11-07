import * as THREE from 'three';
import gsap from 'gsap';

export class Neuron {
    static isScrolling = false;
    static scrollTimeout = null;
    static neuronCount = 0;
    
    // Pre-allocate reusable objects
    static tempVector = new THREE.Vector3();
    static tempVector2 = new THREE.Vector3();
    static tempColor = new THREE.Color();

    // Static initialization block
    static {
        // Pre-allocate reusable geometry
        this.particleGeometry = new THREE.CircleGeometry(0.05, 8);
        this.particleGeometry.rotateZ(Math.PI / 4); // Make it square
        this.particleGeometry.computeBoundingSphere();
    }

    // Shared particle material
    static particleMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8
    });

    constructor(mesh) {
        this.id = ++Neuron.neuronCount;
        mesh.position.y = -0.01 + (this.id * 0.1);
        this.mesh = mesh;

        //Sound id
        this.id = Math.floor(Math.random() * 10000);
        
        // Constants
        this.threshold = 1;
        this.chargeRate = 0.01;
        this.chargingInterval = 1000;
        this.baseScale = 0.2;
        this.maxScale = 1;
        this.refractionPeriod = 100;
        this.originalColor = 0xff0000;
        this.firingColor = 0xffff00;

        // Add envelope details storage here
        this.currentEnvelope = {
            attack: 0,
            sustain: 0,
            release: 0
        };
        
        // State
        this.currentCharge = 0;
        this.lastFiringTime = 0;
        this.isFiring = false;
        this.dcInput = 0;
        this.dcInterval = null;
        
        // Scale management
        this.targetScale = this.baseScale;
        this.isScaling = false;
        this.scrollTimeout = null;
        
        // Optimized collections
        this.outgoingConnections = new Set();
        this.synapticWeights = new Map();
        this.synapticSpeeds = new Map();
        
        // Animation management
        this.currentAnimation = null;
        this.particleAnimations = new Set();
        this.lastUpdateTime = performance.now();
    
        // Set initial scale
        this.mesh.scale.setScalar(this.baseScale);
    
        // Initialize label after all properties are set
        requestAnimationFrame(() => {
            if (window.updateChargeLabel) {
                window.updateChargeLabel(this.mesh);
            }
        });
    }


    update() {
        const currentTime = performance.now();

        // Safety check for stuck firing state
        if (this.isFiring && currentTime - this.lastFiringTime > this.refractionPeriod * 2) {
            this.forceReset();
            return;
        }

        // Check if we should be firing based on DC input
        if (!this.isFiring && !this.isInRefractoryPeriod() && this.dcInput > 0) {
            const timeSinceLastFiring = currentTime - this.lastFiringTime;
            if (timeSinceLastFiring > this.refractionPeriod) {
                this.addCharge(this.dcInput * 0.1);
            }
        }

        // Handle firing state and visual effects
        if (this.isFiring) {
            const timeSinceFiring = currentTime - this.lastFiringTime;
            if (timeSinceFiring < this.refractionPeriod) {
                this.mesh.material.color.setHex(this.firingColor);
            } else {
                this.isFiring = false;
                this.mesh.material.color.setHex(this.originalColor);
            }
        } else {
            this.mesh.material.color.setHex(this.originalColor);
        }

        // Update scale based on state
        if (!Neuron.isScrolling) {
            this.updateVisualState();
        }
    }

    updateVisualState() {
        if (this.isFiring) {
            const pulseScale = 0.1 * Math.sin(performance.now() * 0.01);
            const baseScale = this.baseScale + (this.maxScale - this.baseScale) * this.dcInput;
            const targetScale = baseScale + pulseScale;
            this.mesh.scale.setScalar(targetScale);
        } else {
            const chargeRatio = this.currentCharge / this.threshold;
            const dcScale = this.baseScale + (this.maxScale - this.baseScale) * this.dcInput;
            const targetScale = dcScale + (this.maxScale - dcScale) * chargeRatio * 0.2;
            
            if (this.currentAnimation) {
                this.currentAnimation.kill();
            }
            
            this.currentAnimation = gsap.to(this.mesh.scale, {
                x: targetScale,
                y: targetScale,
                z: targetScale,
                duration: 0.3,
                ease: "power2.out",
                onComplete: () => {
                    this.currentAnimation = null;
                }
            });
        }
    }

    fire() {
        if (this.isFiring) return;
        
        const currentTime = performance.now();
        if (currentTime - this.lastFiringTime < this.refractionPeriod) return;
    
        this.isFiring = true;
        this.lastFiringTime = currentTime;
        
        // Play firing sound if soundManager exists
        if (window.soundManager) {
            let avgWeight = 0;
            let avgSpeed = 0;
            let connectionCount = 0;
            let avgDistance = 0;
    
            this.outgoingConnections.forEach(targetIndex => {
                const targetNeuron = window.circles[targetIndex];
                if (targetNeuron) {
                    const distance = this.mesh.position.distanceTo(targetNeuron.position);
                    avgDistance += distance;
                    
                    avgWeight += this.synapticWeights.get(targetIndex) ?? 0.1;
                    avgSpeed += this.synapticSpeeds.get(targetIndex) ?? 0.5;
                    connectionCount++;
                }
            });
    
            if (connectionCount === 0) {
                if (this.dcInput > 0) {
                    avgWeight = 0.3;
                    avgSpeed = 0.9;
                    avgDistance = 0;
                } else {
                    avgWeight = 0.15;
                    avgSpeed = 0.2;
                    avgDistance = 0;
                }
            } else {
                avgWeight = avgWeight / connectionCount;
                avgSpeed = avgSpeed / connectionCount;
                avgDistance = avgDistance / connectionCount;
            }
    
            // Update envelope details
            this.currentEnvelope = {
                attack: avgWeight ? (0.45 - (avgWeight * 0.45)).toFixed(2) : 0,
                sustain: avgWeight ? (avgWeight * 0.3).toFixed(2) : "0",
                release: avgDistance < 6 ? "0" : (Math.min(avgDistance, 10) / 10 * 0.5).toFixed(2)
            };
    
            window.soundManager.playNeuronFiring(
                avgWeight, 
                avgSpeed, 
                this.id,
                connectionCount === 0,
                this.dcInput > 0,
                avgDistance
            );
        }
        
        // Calculate target scales
        const dcScale = this.baseScale + (this.maxScale - this.baseScale) * this.dcInput;
        const currentScale = this.mesh.scale.x;
        const peakScale = currentScale * 1.3;
        
        // Store color values for transitions
        const originalColorR = this.originalColor >> 16 & 255 / 255;
        const originalColorG = this.originalColor >> 8 & 255 / 255;
        const originalColorB = this.originalColor & 255 / 255;
        
        const firingColorR = this.firingColor >> 16 & 255 / 255;
        const firingColorG = this.firingColor >> 8 & 255 / 255;
        const firingColorB = this.firingColor & 255 / 255;
        
        // Kill existing animation if any
        if (this.currentAnimation) {
            this.currentAnimation.kill();
            this.currentAnimation = null;
        }
        
        // Create new animation timeline
        this.currentAnimation = gsap.timeline({
            onComplete: () => {
                this.isFiring = false;
                this.currentCharge = 0;
                this.mesh.material.color.setHex(this.originalColor);
                this.updateVisualState();
                this.currentAnimation = null;
                
                if (window.updateChargeLabel) {
                    window.updateChargeLabel(this.mesh);
                }
            },
            onInterrupt: () => {
                this.mesh.material.color.setHex(this.originalColor);
                this.mesh.scale.setScalar(dcScale);
                this.currentAnimation = null;
            }
        })
        .to(this.mesh.scale, {
            x: peakScale,
            y: peakScale,
            z: peakScale,
            duration: 0.15,
            ease: "power2.out"
        })
        .to(this.mesh.material.color, {
            r: firingColorR,
            g: firingColorG,
            b: firingColorB,
            duration: 0.15,
            ease: "none"
        }, "<")
        .to(this.mesh.scale, {
            x: dcScale,
            y: dcScale,
            z: dcScale,
            duration: 0.3,
            ease: "elastic.out(1, 0.3)"
        })
        .to(this.mesh.material.color, {
            r: originalColorR,
            g: originalColorG,
            b: originalColorB,
            duration: 0.2,
            ease: "power1.inOut"
        }, ">-0.2");
    
        // Process outgoing connections
        for (const targetIndex of this.outgoingConnections) {
            const targetNeuron = window.circles?.[targetIndex]?.neuron;
            if (!targetNeuron) continue;
            
            const weight = this.synapticWeights.get(targetIndex) ?? 0.1;
            const speed = this.synapticSpeeds.get(targetIndex) ?? 0.5;
            
            setTimeout(() => {
                if (this.isFiring) {
                    this.createAndAnimateSignalParticle(targetIndex, weight, speed, targetNeuron);
                }
            }, Math.random() * 50);
        }
        
        this.updateVisualState();
        
        if (window.updateChargeLabel) {
            window.updateChargeLabel(this.mesh);
        }
    }

    createAndAnimateSignalParticle(targetIndex, weight, speed, targetNeuron) {
        if (!this.mesh.parent || !window.circles[targetIndex]) return;
    
        // Create particle with static geometry
        const particle = new THREE.Mesh(
            Neuron.particleGeometry,
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.8
            })
        );
    
        // Set initial position and rotation
        particle.position.set(
            this.mesh.position.x,
            -10,
            this.mesh.position.z
        );
        particle.rotation.x = -Math.PI / 2;
        
        // Scale particle based on weight (0.5 to 1.5 range)
        const particleScale = 1 + (weight * 2);
        particle.scale.setScalar(particleScale);
        
        // Add to scene
        this.mesh.parent.add(particle);
    
        // Calculate path parameters
        const sourcePos = new THREE.Vector3(
            this.mesh.position.x,
            -10,
            this.mesh.position.z
        );
        const targetPos = new THREE.Vector3(
            window.circles[targetIndex].position.x,
            -10,
            window.circles[targetIndex].position.z
        );
    
        // Calculate duration based on speed
        const distance = sourcePos.distanceTo(targetPos);
        const maxDuration = 4;
        const minDuration = 0.6;
        const duration = maxDuration - ((speed - 0.1) * (maxDuration - minDuration) / 0.8);
    
        // Create curve for path
        const midPoint = new THREE.Vector3().addVectors(sourcePos, targetPos).multiplyScalar(0.5);
        midPoint.y -= 1; // Add curve
        const curve = new THREE.QuadraticBezierCurve3(sourcePos, midPoint, targetPos);
    
        // Animate
        const progress = { value: 0 };
        const animation = gsap.to(progress, {
            value: 1,
            duration: duration,
            ease: "none",
            onUpdate: () => {
                // Update positions in case neurons moved
                sourcePos.set(
                    this.mesh.position.x,
                    -10,
                    this.mesh.position.z
                );
                targetPos.set(
                    window.circles[targetIndex].position.x,
                    -10,
                    window.circles[targetIndex].position.z
                );
    
                // Update curve
                midPoint.addVectors(sourcePos, targetPos).multiplyScalar(0.5);
                midPoint.y -= 1;
                curve.v0.copy(sourcePos);
                curve.v1.copy(midPoint);
                curve.v2.copy(targetPos);
    
                // Update particle position
                const point = curve.getPoint(progress.value);
                particle.position.copy(point);
    
                // Add oscillation
                particle.position.y += Math.sin(progress.value * Math.PI * 2) * 0.1;
            },
            onComplete: () => {
                // Cleanup
                if (particle.parent) {
                    particle.parent.remove(particle);
                }
                particle.material.dispose();
                
                // Trigger target neuron
                targetNeuron.addCharge(weight);
                
                // Remove from tracking set
                this.particleAnimations.delete(animation);
            }
        });
    
        // Track animation for cleanup
        this.particleAnimations.add(animation);
    }

    setDCInput(value) {
        const previousDC = this.dcInput;
        this.dcInput = Math.max(0, Math.round(value * 100) / 100);
        
        if (this.dcInterval) {
            clearInterval(this.dcInterval);
            this.dcInterval = null;
        }
        
        // Only reset if DC was already 0 and we're trying to go lower
        if (this.dcInput <= 0 && previousDC <= 0) {
            this.forceReset();
            return;
        }
        
        this.updateVisualState();
        
        if (this.dcInput > 0) {
            this.dcInterval = setInterval(() => {
                if (!this.isFiring && !this.isInRefractoryPeriod()) {
                    this.addCharge(this.dcInput * 0.1);
                }
            }, 50);
        }
        
        if (window.updateChargeLabel) {
            window.updateChargeLabel(this.mesh);
        }
    }

    addCharge(amount) {
        if (this.isFiring || this.isInRefractoryPeriod()) return;
    
        const previousCharge = this.currentCharge;
        this.currentCharge = Math.min(this.currentCharge + amount, this.threshold);
    
        // Update scale if charge changed
        if (this.currentCharge !== previousCharge && !Neuron.isScrolling) {
            this.updateVisualState();
            
            // Update label after scale change
            if (window.updateChargeLabel) {
                window.updateChargeLabel(this.mesh);
            }
        }
    
        // Check firing threshold
        if (this.currentCharge >= this.threshold && !this.isFiring) {
            this.fire();
        }
    }

    forceReset() {
        if (this.currentAnimation) {
            this.currentAnimation.kill(null, false);
            this.currentAnimation = null;
        }
        
        this.isFiring = false;
        this.currentCharge = 0;
        this.lastFiringTime = 0;
        
        if (this.mesh) {
            this.mesh.material.color.setHex(this.originalColor);
            const baseScale = this.baseScale + (this.maxScale - this.baseScale) * this.dcInput;
            this.mesh.scale.setScalar(baseScale);
        }
        
        this.updateVisualState();
        window.updateChargeLabel?.(this.mesh);
    }

    // Utility methods
    isInRefractoryPeriod() {
        return (performance.now() - this.lastFiringTime) < this.refractionPeriod;
    }

    getNeuronState() {
        return {
            id: this.id,
            charge: this.currentCharge,
            isFiring: this.isFiring,
            isRefractory: this.isInRefractoryPeriod(),
            dcInput: this.dcInput,
            connections: Array.from(this.outgoingConnections),
            weights: Array.from(this.synapticWeights),
            speeds: Array.from(this.synapticSpeeds)
        };
    }

    // Connection management methods
    addConnection(targetIndex, initialWeight = 0.1, initialSpeed = 0.5) {
        this.outgoingConnections.add(targetIndex);
        this.synapticWeights.set(targetIndex, initialWeight);
        this.synapticSpeeds.set(targetIndex, initialSpeed);
    }

    updateConnectionWeight(targetIndex, weight) {
        if (this.outgoingConnections.has(targetIndex)) {
            this.synapticWeights.set(targetIndex, weight);
        }
    }

    updateConnectionSpeed(targetIndex, speed) {
        if (this.outgoingConnections.has(targetIndex)) {
            this.synapticSpeeds.set(targetIndex, speed);
        }
    }

    removeConnection(targetIndex) {
        this.outgoingConnections.delete(targetIndex);
        this.synapticWeights.delete(targetIndex);
        this.synapticSpeeds.delete(targetIndex);
    }

    reset() {
        this.currentCharge = 0;
        this.isFiring = false;
        this.lastFiringTime = 0;
        this.updateVisualState();
        if (window.updateChargeLabel) {
            window.updateChargeLabel(this.mesh);
        }
    }

    cleanup() {
        // Clear interval
        if (this.dcInterval) {
            clearInterval(this.dcInterval);
            this.dcInterval = null;
        }
        
        // Kill any ongoing animations
        if (this.currentAnimation) {
            this.currentAnimation.kill();
            this.currentAnimation = null;
        }
        
        // Kill all particle animations
        this.particleAnimations.forEach(animation => animation.kill());
        this.particleAnimations.clear();
        
        // Clear collections
        this.outgoingConnections.clear();
        this.synapticWeights.clear();
        this.synapticSpeeds.clear();
        
        // Remove label if it exists
        if (this.mesh.chargeLabel) {
            document.body.removeChild(this.mesh.chargeLabel);
            this.mesh.chargeLabel = null;
        }
        
        // Reset state
        this.reset();
    }
} // End of Neuron class