import * as THREE from 'three';
import {PointerLockControls} from "three/examples/jsm/controls/PointerLockControls.js";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";

// Create scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const loader = new GLTFLoader();
loader.load('./data/models/firefly.glb', function (gltf) {
    gltf.scene.scale.set(3, 3, 3);
    gltf.scene.position.set(0, 0, 0);
    // scene.add(gltf.scene);
}, undefined, function (error) {
    console.error('Error loading GLTF model: ', error);
});

// Create camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 1);
camera.lookAt(0, 0, 0); // Point the camera at the origin

// Translate camera
const translationMatrix = new THREE.Matrix4().makeTranslation(0, 1.5, 0);
camera.applyMatrix4(translationMatrix);

// Create renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Create light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 5);
directionalLight.position.set(0, 10, 10);
directionalLight.castShadow = true;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;
directionalLight.shadow.mapSize.width = 2048;  // Higher resolution
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Load floor texture
const textureLoader = new THREE.TextureLoader();
const floorTexture = textureLoader.load('data/textures/rocky_terrain.jpg');
floorTexture.wrapS = THREE.RepeatWrapping;
floorTexture.wrapT = THREE.RepeatWrapping;
floorTexture.repeat.set(20, 20);

// Ground
const groundGeometry = new THREE.PlaneGeometry(500, 500);
const groundMaterial = new THREE.MeshStandardMaterial({
    map: floorTexture,
    flatShading: true
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2; // Rotate to make it horizontal
ground.receiveShadow = true;
scene.add(ground);

// Building
const buildingGeometry = new THREE.BoxGeometry(1, 5, 1);
const buildingMaterial = new THREE.MeshStandardMaterial({
    color: 0x8B4513,
    transparent: true,
    opacity: 0.7
});
const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
building.position.set(0, 2, -3); // Position the building
building.castShadow = true;
building.receiveShadow = true;
scene.add(building);

// Fence
const fenceGeometry = new THREE.BoxGeometry(10, 3, 0.1); // Size of the fence
const fenceMaterial = new THREE.MeshStandardMaterial({color: 0x8B4513});
const fence = new THREE.Mesh(fenceGeometry, fenceMaterial);
fence.position.set(0, 1, 5); // Adjust the position
fence.castShadow = true;
fence.receiveShadow = true;
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
const playerGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const playerMaterial = new THREE.MeshStandardMaterial({color: 0xff0000});
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.set(0, 0.25, 1);
player.castShadow = true;
player.receiveShadow = true;
scene.add(player);

// Controls impl
const controls = new PointerLockControls(camera, renderer.domElement);
document.addEventListener('click', () => {
    controls.lock();
});
scene.add(controls.object);

// All global variables
// Maximum and minimum pitch angles in radians
const maxPitch = THREE.MathUtils.degToRad(150);
const minPitch = THREE.MathUtils.degToRad(80);
controls.maxPolarAngle = maxPitch;
controls.minPolarAngle = minPitch;

// Movement controls
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

// Transparency
const raycaster = new THREE.Raycaster();
let objects = [building, fence]; // List of objects to check for transparency
let originalTransparency = {};
let transparentObjects = []; // Keep track of the objects we've modified to restore their transparency later

// Jump
let jumpHeight = 0.4;  // How high the player jumps
let velocity = 0;    // Current velocity of the jump
let gravity = -0.025;  // Gravity affecting the jump
let groundLevel = 0.25; // Y position of the ground
let jumpInProgress = false;

// Function to save the original transparency and opacity of an object
function saveOriginalTransparency(object) {
    if (object.material) {
        // Save the original transparency and opacity if not already saved
        originalTransparency[object.uuid] = {
            transparent: object.material.transparent,
            opacity: object.material.opacity
        };
    }
}

// Function to set an object to semi-transparent
function setObjectTransparent(object, opacity) {
    if (object.material) {
        // If the object doesn't have saved transparency, save it first
        if (!originalTransparency[object.uuid]) {
            saveOriginalTransparency(object);
        }

        // Set the object to semi-transparent
        object.material.transparent = true;
        object.material.opacity = opacity;
        object.material.needsUpdate = true;
    }
}

// Function to reset transparency of all affected objects
function resetTransparency() {
    for (let uuid in originalTransparency) {
        let object = scene.getObjectByProperty('uuid', uuid); // Find the object by UUID
        if (object && object.material) {
            // Restore the original transparency and opacity
            let original = originalTransparency[uuid];
            object.material.transparent = original.transparent;
            object.material.opacity = original.opacity;
            object.material.needsUpdate = true;
        }
    }
    originalTransparency = {}; // Clear the stored original values
}

// Function to check for objects between the camera and the player
function handleTransparency() {
    // Reset previous transparent objects
    resetTransparency();

    // Cast a ray from the camera to the player
    const direction = new THREE.Vector3().subVectors(player.position, camera.position);
    raycaster.ray.origin.copy(camera.position);
    raycaster.ray.direction.copy(direction).normalize();
    raycaster.far = direction.length();

    // Get the objects intersected by the ray
    const intersects = raycaster.intersectObjects(objects, true);

    // Make the intersected objects semi-transparent
    intersects.forEach((intersection) => {
        setObjectTransparent(intersection.object, 0.5); // 0.5 for 50% transparency
        transparentObjects.push(intersection.object); // Track the object to reset it later
    });
}

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
    const toFence = fencePoint.sub(player.position);

    // Collision detection
    playerBox.setFromObject(player);
    let collide = playerBox.intersectsBox(fenceBox);
    let displacement = controls.object.position.clone();

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

    displacement = controls.object.position.clone().sub(displacement);

    // Update player position
    if (hasMoved) {
        player.position.add(displacement);
    }
}

function handleTarget() {
    target.position.copy(building.position);
    target.lookAt(player.position.x, target.position.y, player.position.z);

    // Get distance from target to player
    const distance = player.position.distanceTo(building.position);
    target.visible = distance <= 10;

    let scale = distance / 14 + 0.1;
    scale = THREE.MathUtils.clamp(scale, 0.3, 0.8);
    target.scale.set(scale, scale, scale);
}

function handleJump() {
    if (jumpInProgress) {
        // Apply gravity and update position
        velocity += gravity;
        player.position.y += velocity;

        // Stop the jump when player reaches ground level
        if (player.position.y <= groundLevel) {
            player.position.y = groundLevel;
            jumpInProgress = false;
            console.log("Jump completed!")
        }
    }
}

function animate() {
    requestAnimationFrame(animate);

    handleMovement();
    handleTarget();
    handleJump();
    handleTransparency();
    const offset = new THREE.Vector3(0, 1, 3).applyQuaternion(camera.quaternion);
    camera.position.lerp(player.position.clone().add(offset), 0.3);

    renderer.render(scene, camera);
}

animate();

// Mouse event handling
window.addEventListener('mousedown', onMouseDown, false);

function onMouseDown() {
    // Get the distance from player to building
    const distance = player.position.distanceTo(building.position);

    if (distance <= 4) {
        window.location.href = 'combat.html'; // Navigate to combat.html
    }
}

// Detect spacebar press
document.addEventListener('keydown', function (event) {
    if (event.code === 'Space' && !jumpInProgress) {
        jumpInProgress = true;
        velocity = jumpHeight;  // Initial jump force
    }
});

// Handle window resizing
window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});