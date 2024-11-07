
import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min';
import * as Tone from 'tone';

import { Neuron } from './components/neuron.js';
import { InputManager } from './components/InputManager.js';
import { ConnectionManager } from './components/ConnectionManager.js';
import { SoundManager } from './components/SoundManager.js';

// Add start button styles
const style = document.createElement('style');
style.textContent = `
    .start-button-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: rgba(0, 0, 0, 0.7);
        z-index: 1000;
    }

    .start-button {
        padding: 20px 40px;
        font-size: 24px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        transition: background-color 0.3s;
        font-family: 'Arial', sans-serif;
    }

    .start-button:hover {
        background-color: #45a049;
    }
`;
document.head.appendChild(style);

// Pre-create reusable objects
const vector3 = new THREE.Vector3();
const labelCache = new Map();
let lastFrameTime = 0;
const frameInterval = 1000 / 240; // Target 240 FPS

// Initialize basic scene setup with optimized settings
const scene = new THREE.Scene();
scene.matrixAutoUpdate = false; // Disable automatic matrix updates

// Setup orthographic camera with optimized settings
const frustumSize = 20;
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    frustumSize / -2,
    1,
    1000
);


// Label Settings as constants
const LABEL_SETTINGS = {
    baseOffset: 40,
    fontSize: '12px',
    fontFamily: 'Consolas, monospace',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    style: {
        position: 'absolute',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '5px',
        borderRadius: '3px',
        fontSize: '12px',
        fontFamily: 'Consolas, monospace',
        fontWeight: 'bold',
        pointerEvents: 'none',
        transform: 'translate(50%, -50%)',  // Center horizontally
        opacity: '0.5',
        zIndex: '1000',
        textAlign: 'left',
        whiteSpace: 'nowrap'
    }
};

// Position camera
camera.position.set(0, 10, 0);
camera.lookAt(0, 0, 0);
camera.rotation.z = 0;
camera.updateMatrix();
camera.updateMatrixWorld();

// Optimized renderer settings
const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    precision: 'mediump',
    logarithmicDepthBuffer: false
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
renderer.sortObjects = true;
renderer.setClearColor(0x000000);
document.body.appendChild(renderer.domElement);

// Initialize arrays and GUI
window.circles = [];
const gui = new GUI();
window.gui = gui;

// Initialize Stats with performance panel
const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

// Create shared geometries and materials
const circleGeometry = new THREE.CircleGeometry(1.0, 28);
circleGeometry.rotateZ(Math.PI / 4);
circleGeometry.computeBoundingSphere();

const neuronMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xff0000,
    side: THREE.FrontSide,
    transparent: false,
    depthTest: true,
    depthWrite: true,
    precision: 'lowp'
});

// Create and add the start button
const startButtonContainer = document.createElement('div');
startButtonContainer.className = 'start-button-container';

const startButton = document.createElement('button');
startButton.className = 'start-button';
startButton.textContent = 'Start Neural Network';

startButton.addEventListener('click', async () => {
    await Tone.start();
    console.log('Audio is ready');
    setupInitialNetwork();
    startButtonContainer.style.display = 'none';
});

startButtonContainer.appendChild(startButton);
document.body.appendChild(startButtonContainer);




// Basic controls object
window.settings = {
    addNeuron: (position = null) => {
        const neuron = createNewNeuron(position);
        window.circles.push(neuron);
        scene.add(neuron);
        return neuron;
    },

    volume: -12,
    selectedWeight: 0.5,
    selectedSpeed: 0.5,
    selectedConnection: null
};

// Create basic GUI without folders
gui.add(window.settings, 'addNeuron').name('Add Neuron');

// Add volume slider
gui.add(window.settings, 'volume', -48, 6, 1)
    .name('Volume (dB)')
    .onChange((value) => {
        if (window.soundManager) {
            window.soundManager.setVolume(value);
        }
    });

// Add connection controls
gui.add(window.settings, 'selectedWeight', 0, 1, 0.01)
    .name('Weight / Sustain')
    .listen()
    .onChange((value) => {
        if (connectionManager && connectionManager.selectedConnection) {
            connectionManager.updateConnectionProperties(value);
        }
    });

gui.add(window.settings, 'selectedSpeed', 0, 1, 0.01)
    .name('Speed / Attack')
    .listen()
    .onChange((value) => {
        if (connectionManager && connectionManager.selectedConnection) {
            connectionManager.updateConnectionProperties(undefined, value);
        }
    });

// Initialize managers
const connectionManager = new ConnectionManager(scene, camera, renderer);
const inputManager = new InputManager(camera, renderer, connectionManager);

// Initialize SoundManager here
window.soundManager = new SoundManager();


// Optimized neuron creation
// Optimized neuron creation
function createNewNeuron(position = null, dcInput = null) {
    const circle = new THREE.Mesh(circleGeometry, neuronMaterial.clone());
    circle.rotation.x = -Math.PI / 2;
    
    if (position) {
        circle.position.set(position.x, 0.1, position.z);
    } else {
        circle.position.set(
            (Math.random() - 0.5) * 10,
            0.1,
            (Math.random() - 0.5) * 10
        );
    }
    
    circle.scale.setScalar(0.2);
    circle.matrixAutoUpdate = true;
    
    const neuron = new Neuron(circle);
    circle.neuron = neuron;
    
    // Play an initial note when the neuron is created
    if (window.soundManager) {
        // Use a slightly different sound for initialization
        setTimeout(() => {
            window.soundManager.playNeuronFiring(
                0.5,  // medium weight
                0.7,  // faster speed
                neuron.id,
                true, // isolated
                dcInput > 0, // hasDC
                0 // no distance
            );
        }, 100);
    }
    
    if (dcInput !== null) {
        neuron.dcInput = dcInput;
        neuron.currentCharge = dcInput;
        
        if (dcInput === 1.0) {
            setTimeout(() => {
                neuron.fire();
            }, 200);
        }
    }
    
    requestAnimationFrame(() => {
        if (window.updateChargeLabel) {
            window.updateChargeLabel(circle);
        }
    });
    
    return circle;
}

function updateChargeLabel(circle) {
    if (!circle || !circle.neuron) return;

    try {
        if (!circle.chargeLabel) {
            circle.chargeLabel = document.createElement('div');
            circle.chargeLabel.className = 'neuron-label';
            Object.assign(circle.chargeLabel.style, LABEL_SETTINGS.style);
            document.body.appendChild(circle.chargeLabel);
        }

        const dcInput = circle.neuron?.dcInput ?? 0;
        const charge = circle.neuron?.currentCharge ?? 0;
        const env = circle.neuron?.currentEnvelope ?? { attack: 0, sustain: 0, release: 0 };
        
        // Remove the neuron ID from the label content
        const content = `DC: ${dcInput.toFixed(2)}<br>` +
                        `C: ${charge.toFixed(2)}<br>` +
                        `A: ${env.attack}<br>` +
                        `S: ${env.sustain}<br>` +
                        `R: ${env.release}`;
        
        if (circle.chargeLabel.innerHTML !== content) {
            circle.chargeLabel.innerHTML = content;
        }

        updateLabelPosition(circle);
    } catch (error) {
        console.warn('Error updating charge label:', error);
    }
}

window.updateChargeLabel = updateChargeLabel;

function updateLabelPosition(circle) {
    if (!circle.chargeLabel) return;

    circle.getWorldPosition(vector3);
    vector3.project(camera);

    const x = (vector3.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
    const y = (-vector3.y * 0.5 + 0.5) * renderer.domElement.clientHeight;

    const scale = circle.scale.x;
    const normalizedScale = Math.sqrt(scale / 0.2);
    const zoomFactor = frustumSize / 20;
    const adjustedOffset = LABEL_SETTINGS.baseOffset * normalizedScale / zoomFactor;

    circle.chargeLabel.style.left = `${x}px`;
    circle.chargeLabel.style.top = `${y - adjustedOffset}px`;
}

function animate(currentTime) {
    requestAnimationFrame(animate);

    const deltaTime = currentTime - lastFrameTime;
    if (deltaTime < frameInterval) return;
    
    lastFrameTime = currentTime - (deltaTime % frameInterval);

    stats.begin();

    for (let i = 0; i < window.circles.length; i++) {
        const circle = window.circles[i];
        if (circle && circle.neuron) {
            updateChargeLabel(circle);
        }
    }
    
    connectionManager.updateAllConnections();
    renderer.render(scene, camera);

    stats.end();
}

function setupInitialNetwork() {
    const initialSetup = [
        { position: { x: -3, z: -3 }, dc: 1.0 },    // Full DC
        { position: { x: 3, z: -3 }, dc: 0.5 },     // Half DC
        { position: { x: 0, z: 4 }, dc: 0.0 }       // No DC
    ];

    const connections = [
        { from: 0, to: 1, weight: 0.2, speed: 0.5 },  // Changed weights to 0.2
        { from: 1, to: 2, weight: 0.2, speed: 0.5 },
        { from: 2, to: 0, weight: 0.2, speed: 0.7 }
    ];

    initialSetup.forEach(setup => {
        const neuron = createNewNeuron(setup.position, 0); // Start with 0 DC
        window.circles.push(neuron);
        scene.add(neuron);
    });

    setTimeout(() => {
        // Set DC inputs using the proper method
        window.circles.forEach((circle, index) => {
            if (circle.neuron) {
                circle.neuron.setDCInput(initialSetup[index].dc);
            }
        });


        connections.forEach(({ from, to, weight, speed }) => {
            const connection = connectionManager.createConnection(
                window.circles[from],
                window.circles[to]
            );

            if (connection) {
                const connectionData = connectionManager.connections.get(connection);
                if (connectionData) {
                    connectionData.weight = weight;
                    connectionData.speed = speed;
                    window.circles[from].neuron.updateConnectionWeight(to, weight);
                    window.circles[from].neuron.updateConnectionSpeed(to, speed);
                }
            }
        });
    }, 100);
}

// Optimized resize handler
const resizeHandler = () => {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = frustumSize * aspect / -2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = frustumSize / -2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

// Add resize event listener
window.addEventListener('resize', resizeHandler, false);

// Exports
window.updateChargeLabel = updateChargeLabel;
window.scene = scene;
window.THREE = THREE;

// Start animation
animate();