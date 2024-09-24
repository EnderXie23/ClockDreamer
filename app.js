import * as THREE from 'three';
// import {OrbitControls} from 'three/addons';

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

// Add controls
// const controls = new OrbitControls(camera, renderer.domElement);

// Create Raycaster and mouse vector
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

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

// Global variables for animation
let animationInProgress = false;
let totalRotation = 0;
let targetRotation = 0;
let rotationDirection = 1;
let dragging = false;
let selectedObject = null;

// Scene render loop
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
window.addEventListener('mousedown', onMouseDown, false);
window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('mouseup', onMouseUp, false);

// Handle mouse down event (selecting objects)
function onMouseDown(event) {
    event.preventDefault();

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    console.log(mouse.x, mouse.y);

    // Update the raycaster with camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Check if we intersect with the yellow or red block
    const intersects = raycaster.intersectObjects([yellowBlock, redBlock]);

    if (intersects.length > 0) {
        selectedObject = intersects[0].object;

        if (selectedObject === yellowBlock) {
            // Start dragging the yellow block
            dragging = true;
        } else if (selectedObject === redBlock) {
            // Check if the red block can rotate
            let rotLim = rotationDirection === 1 ? redBlock.rotation.y < Math.PI - 0.01 : redBlock.rotation.y > 0.01;
            // Perform rotation on the red block
            if (!rotLim)
                rotationDirection *= -1;
            if (!animationInProgress) {
                totalRotation = 0;
                targetRotation = rotationDirection * Math.PI / 2;
                animationInProgress = true;
            }
        }
    }
}

// Handle mouse move event (dragging the yellow block)
function onMouseMove(event) {
    if (!dragging || selectedObject !== yellowBlock) return;

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update raycaster to match the new mouse position
    raycaster.setFromCamera(mouse, camera);

    // Create a plane for dragging along the Z-axis
    const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);

    // Use raycaster to find intersection point on the plane
    const intersectionPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectionPoint);

    // Align the yellow block to the Z-axis of the intersection point
    yellowBlock.position.z = Math.max(Math.min(intersectionPoint.z - 4, -1), -5);
}

// Handle mouse up event (stop dragging)
function onMouseUp() {
    dragging = false;

    if (selectedObject === yellowBlock) {
        // Snap the yellow block to the nearest grid position
        yellowBlock.position.z = Math.round(yellowBlock.position.z);
    }

    selectedObject = null;
}
