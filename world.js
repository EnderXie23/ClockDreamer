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
// const ratio = 130;
// const camera = new THREE.OrthographicCamera(window.innerWidth / -ratio, window.innerWidth / ratio, window.innerHeight / ratio, window.innerHeight / -ratio, 0.1, 1000);
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
const buildingGeometry = new THREE.BoxGeometry(1, 20, 1);
const buildingMaterial = new THREE.MeshBasicMaterial({color: 0x8B4513});
const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
building.position.set(0, 1, 0); // Position the building
scene.add(building);

// Fence
const fenceGeometry = new THREE.BoxGeometry(10, 3, 0.1); // Size of the fence
const fenceMaterial = new THREE.MeshBasicMaterial({color: 0x8B4513});
const fence = new THREE.Mesh(fenceGeometry, fenceMaterial);
fence.position.set(0, 1, 5); // Adjust the position
scene.add(fence);

// Player
const playerGeometry = new THREE.BoxGeometry(0.5, 1, 0.5);
const playerMaterial = new THREE.MeshBasicMaterial({color: 0xff0000});
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.set(0, 0, 0);
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

function handleMovement() {
    const direction = new THREE.Vector3();
    controls.getDirection(direction);
    const perp = new THREE.Vector3();
    perp.crossVectors(direction, controls.object.up);
    perp.normalize();

    const fencePoint = new THREE.Vector3(
        THREE.MathUtils.clamp(player.position.x, fenceBox.min.x, fenceBox.max.x),
        THREE.MathUtils.clamp(player.position.y, fenceBox.min.y, fenceBox.max.y),
        THREE.MathUtils.clamp(player.position.z, fenceBox.min.z, fenceBox.max.z)
    )
    const toFence = fencePoint.sub(controls.object.position);

    // Collision detection
    playerBox.setFromObject(player);
    let collide = playerBox.intersectsBox(fenceBox);

    const speed = 0.1; // Movement speed

    // Movement controls
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
            // console.log('direction: ', direction);
            // console.log('perp', perp);
            console.log(perp.dot(toFence));
            controls.moveRight(-speed);  // Move left
        }
    if (keys['d'])
        if ((!collide) || (collide && perp.dot(toFence) < -0.07)) {
            controls.moveRight(speed);  // Move right
        }

    // Update player position
    player.position.copy(controls.object.position);
}

function animate() {
    requestAnimationFrame(animate);

    handleMovement();

    renderer.render(scene, camera);
}

animate();