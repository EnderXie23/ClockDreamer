import * as THREE from './node_modules/three/build/three.module.js';

// Create scene
const scene = new THREE.Scene();

// Create camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(10, 10, 10);

// Rotate camera
const angle = THREE.MathUtils.degToRad(0);
const rotationMatrix = new THREE.Matrix4().makeRotationY(-angle); // Apply negative angle for clockwise rotation
camera.applyMatrix4(rotationMatrix); // Apply the rotation to the camera
camera.lookAt(1, 3, 0); // Point the camera at the origin

// Create renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Load texture for background
const loader = new THREE.TextureLoader();
loader.load('./data/img/starry.webp', function (texture) {
    scene.background = texture;
});

// Create light
const light = new THREE.PointLight(0xffffff, 1, 100);
light.position.set(10, 10, 10);
scene.add(light);

const blockMaterialYellow = new THREE.MeshBasicMaterial({color: 0xffcc00});
const blockMaterialRed = new THREE.MeshBasicMaterial({color: 0xff3300});

// Yellow block
const yellowBlockGeometry = new THREE.BoxGeometry(1, 1, 4);
yellowBlockGeometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, 0.5));
const yellowBlock = new THREE.Mesh(yellowBlockGeometry, blockMaterialYellow);
yellowBlock.position.set(-5, 0, -3);
scene.add(yellowBlock);

// Red block
const redBlockGeometry = new THREE.BoxGeometry(4, 1, 1);
redBlockGeometry.applyMatrix4(new THREE.Matrix4().makeTranslation(1.5, 0, 0));
const redBlock = new THREE.Mesh(redBlockGeometry, blockMaterialRed);
redBlock.position.set(-1, 0, -2);
scene.add(redBlock);

// Add a basic ground
// const groundGeometry = new THREE.PlaneGeometry(20, 20);
// const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
// const ground = new THREE.Mesh(groundGeometry, groundMaterial);
// ground.rotation.x = Math.PI / 2;
// scene.add(ground);

// Scene render loop
let animationInProgress = false;
let totalRotation = 0;
let targetRotation = 0;

function animate() {
    let rotationSpeed = Math.PI / 60;
    if (targetRotation < 0) {
        rotationSpeed *= -1;
    }

    // rotate till target
    if (animationInProgress) {
        if (totalRotation < Math.abs(targetRotation)) {
            redBlock.rotation.y += rotationSpeed;
            totalRotation += Math.abs(rotationSpeed);
        } else {
            animationInProgress = false;
        }
    }

    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

function createTrail() {
    // Create a simple 3D trail using box geometries
    const trailMaterial = new THREE.MeshBasicMaterial({color: 0x000000});
    const trailLength = 10;
    const trailWidth = 1;

    // Create multiple segments to represent the trail
    for (let i = 0; i < 5; i++) {
        const trailSegment = new THREE.Mesh(
            new THREE.BoxGeometry(trailWidth, 1, 1),  // Width, height, length of each trail segment
            trailMaterial
        );
        trailSegment.position.set(-1, 0, 3 - i);  // Spread segments along the Z axis
        scene.add(trailSegment);
    }

    for (let i = 0; i < 2; i++) {
        const trailSegment = new THREE.Mesh(
            new THREE.BoxGeometry(trailWidth, 1, 1),  // Width, height, length of each trail segment
            trailMaterial
        );
        trailSegment.position.set(-5, 0, 3 - i);  // Spread segments along the Z axis
        scene.add(trailSegment);
    }
}

createTrail();
animate();

// Keyboard event listener
document.addEventListener('keydown', (event) => {
    const key = event.key;

    // Move yellow block left
    if (key === 'a') {
        if (yellowBlock.position.z > -5)
            yellowBlock.position.z -= 1;
    }
    // Move yellow block right
    if (key === 'd') {
        if (yellowBlock.position.z < -1)
            yellowBlock.position.z += 1;
    }

    // Move red block left
    if (key === 'j') {
        if (!animationInProgress && redBlock.rotation.y < Math.PI - 0.01) {
            totalRotation = 0;
            targetRotation = Math.PI / 2;
            animationInProgress = true;
        }
    }
    // Move red block right
    if (key === 'l') {
        if (!animationInProgress && redBlock.rotation.y > 0.01) {
            totalRotation = 0;
            targetRotation = -Math.PI / 2;
            animationInProgress = true;
        }
    }
});
