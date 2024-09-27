import * as THREE from 'three';
import {PointerLockControls} from "three/examples/jsm/controls/PointerLockControls.js";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";

// Create scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const loader = new GLTFLoader();

loader.load('./data/models/firefly.glb', function (gltf) {
    // Enlarge the gltf model
    gltf.scene.scale.set(3, 3, 3);
    gltf.scene.position.set(0, 0, 0);
    // scene.add(gltf.scene);
}, undefined, function (error) {
    console.error('Error loading GLTF model: ', error);
});

// Create camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 1);

// Rotate camera
const angleY = THREE.MathUtils.degToRad(-30);
const rotationMatrixY = new THREE.Matrix4().makeRotationY(-angleY); // Apply negative angle for clockwise rotation
camera.applyMatrix4(rotationMatrixY); // Apply the rotation to the camera
const angleZ = THREE.MathUtils.degToRad(-45);
const rotationMatrixZ = new THREE.Matrix4().makeRotationZ(-angleZ);
camera.applyMatrix4(rotationMatrixZ);
camera.lookAt(0, 0, 0); // Point the camera at the origin

// Translate camera
const translationMatrix = new THREE.Matrix4().makeTranslation(0, 1.5, 0);
camera.applyMatrix4(translationMatrix);

// Create renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create light
const light = new THREE.PointLight(0xffffff, 1, 100);
light.position.set(10, 10, 10);
scene.add(light);

// Ground
const groundGeometry = new THREE.PlaneGeometry(500, 500);
const groundMaterial = new THREE.MeshBasicMaterial({color: 0x228B22});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2; // Rotate to make it horizontal
scene.add(ground);

// Building
const buildingGeometry = new THREE.BoxGeometry(1, 5, 1);
const buildingMaterial = new THREE.MeshBasicMaterial({
    color: 0x8B4513,
    transparent: true,
    opacity: 0.7
});
const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
building.position.set(0, 2, -3); // Position the building
scene.add(building);

// Fence
const fenceGeometry = new THREE.BoxGeometry(10, 3, 0.1); // Size of the fence
const fenceMaterial = new THREE.MeshBasicMaterial({color: 0x8B4513});
const fence = new THREE.Mesh(fenceGeometry, fenceMaterial);
fence.position.set(0, 1, 5); // Adjust the position
scene.add(fence);

// Target mark
const target = new THREE.Group();
const circleGeometry = new THREE.CircleGeometry(1, 32);  // radius 1, 32 segments
const circleMaterial = new THREE.MeshBasicMaterial({color: 0x000000});
const circle = new THREE.Mesh(circleGeometry, circleMaterial);
target.add(circle);
const lineMaterial = new THREE.MeshBasicMaterial({color: 0x000000});
const horizontalLineGeometry = new THREE.PlaneGeometry(2.5, 0.1);  // width, height
const horizontalLine = new THREE.Mesh(horizontalLineGeometry, lineMaterial);
target.add(horizontalLine);
const verticalLineGeometry = new THREE.PlaneGeometry(0.1, 2.5);  // width, height
const verticalLine = new THREE.Mesh(verticalLineGeometry, lineMaterial);
target.add(verticalLine);
scene.add(target);

// Player
const playerGeometry = new THREE.BoxGeometry(0.5, 1, 0.5);
const playerMaterial = new THREE.MeshBasicMaterial({color: 0xff0000});
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.set(0, 0, 1);
scene.add(player);

// Controls impl
const controls = new PointerLockControls(camera, document.body);
document.addEventListener('click', () => {
    controls.lock();
});
scene.add(controls.object);

// Maximum and minimum pitch angles in radians (-60 to 60 degrees)
const maxPitch = THREE.MathUtils.degToRad(120);
const minPitch = THREE.MathUtils.degToRad(60);
controls.maxPolarAngle = maxPitch;
controls.minPolarAngle = minPitch;

const keys = {};
document.addEventListener('keydown', (event) => {
    keys[event.key] = true;
});
document.addEventListener('keyup', (event) => {
    keys[event.key] = false;
});


// Collision detection and response
const fenceBox = new THREE.Box3().setFromObject(fence);
const playerBox = new THREE.Box3().setFromObject(player);
let speed = 0.1;

function handleMovement() {
    // Get the direction of the camera
    const direction = new THREE.Vector3();
    controls.getDirection(direction);
    const perp = new THREE.Vector3();
    perp.crossVectors(direction, controls.object.up);
    perp.normalize();

    // Get the point on the fence closest to the player
    const fencePoint = new THREE.Vector3(
        THREE.MathUtils.clamp(player.position.x, fenceBox.min.x, fenceBox.max.x),
        THREE.MathUtils.clamp(player.position.y, fenceBox.min.y, fenceBox.max.y),
        THREE.MathUtils.clamp(player.position.z, fenceBox.min.z, fenceBox.max.z)
    )
    const toFence = fencePoint.sub(controls.object.position);

    // Collision detection
    playerBox.setFromObject(player);
    let collide = playerBox.intersectsBox(fenceBox);

    // Movement controls
    let hasMoved = keys['w'] || keys['s'] || keys['a'] || keys['d'];
    if (keys['w'])
        if ((!collide) || (collide && direction.dot(toFence) < -0.07)) {
            controls.moveForward(speed);   // Move forward
        }
    if (keys['s'])
        if ((!collide) || (collide && direction.dot(toFence) > 0.07)) {
            controls.moveForward(-speed);  // Move backward
        }
    if (keys['a'])
        if ((!collide) || (collide && perp.dot(toFence) > 0.07)) {
            controls.moveRight(-speed);  // Move left
        }
    if (keys['d'])
        if ((!collide) || (collide && perp.dot(toFence) < -0.07)) {
            controls.moveRight(speed);  // Move right
        }

    // Update player position
    if (hasMoved) {
        player.position.copy(controls.object.position);
        handleTarget();
    }
}

function handleTarget() {
    target.position.copy(building.position);
    target.lookAt(player.position);

    // Get distance from target to player
    const distance = player.position.distanceTo(building.position);
    target.visible = distance <= 10;

    let scale = distance / 14 + 0.1;
    scale = THREE.MathUtils.clamp(scale, 0.3, 0.8);
    target.scale.set(scale, scale, scale);
}

function animate() {
    requestAnimationFrame(animate);

    handleMovement();
    handleTarget();

    renderer.render(scene, camera);
}

animate();

// Mouse event handling
window.addEventListener('mousedown', onMouseDown, false);

// window.addEventListener('mouseup', onMouseUp, false);

function onMouseDown() {
    // Get the distance from player to building
    const distance = player.position.distanceTo(building.position);

    if (distance <= 4) {
        window.location.href = 'combat.html'; // Navigate to combat.html
    }
}