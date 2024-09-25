import * as THREE from 'three';
// import {OrbitControls} from 'three/addons';

// Create scene
const scene = new THREE.Scene();

// Create camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 15);

// Rotate camera
const angleY = THREE.MathUtils.degToRad(-30);
const rotationMatrixY = new THREE.Matrix4().makeRotationY(-angleY); // Apply negative angle for clockwise rotation
camera.applyMatrix4(rotationMatrixY); // Apply the rotation to the camera
const angleZ = THREE.MathUtils.degToRad(-45);
const rotationMatrixZ = new THREE.Matrix4().makeRotationZ(-angleZ);
camera.applyMatrix4(rotationMatrixZ);
camera.lookAt(0, 0, 0); // Point the camera at the origin

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
const blockMaterialBlue = new THREE.MeshBasicMaterial({color: 0x0000ff});

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

// Blue block
const blueBlockGeometry = new THREE.BoxGeometry(4, 1, 1);
blueBlockGeometry.applyMatrix4(new THREE.Matrix4().makeTranslation(1.5, 0, 0));
const blueBlock = new THREE.Mesh(blueBlockGeometry, blockMaterialBlue);
blueBlock.position.set(-1, 0, -8);
scene.add(blueBlock);

// Blue block 2 is a placeholder for the reflection
const blueBlock2 = new THREE.Mesh(blueBlockGeometry, blockMaterialBlue);
blueBlock2.position.set(-1, 0, -8);
scene.add(blueBlock2);

// Create mirror
const mirrorWidth = 70;
const mirrorHeight = 70;
const scaleFactorWidth = mirrorWidth / window.innerWidth;
const scaleFactorHeight = mirrorHeight / window.innerHeight;
const mirrorGeometry = new THREE.PlaneGeometry(mirrorWidth * scaleFactorWidth, mirrorHeight * scaleFactorHeight);
const mirrorMaterial = new THREE.MeshBasicMaterial({color: 0x000000, side: THREE.DoubleSide});
const mirror = new THREE.Mesh(mirrorGeometry, mirrorMaterial);
mirror.position.set(0, 0, -6);
scene.add(mirror);

// Add mirror camera
const reflectionRenderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
// const reflectionRenderTarget = new THREE.WebGLRenderTarget(mirrorWidth* 100, mirrorHeight*100);
const mirrorCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
// const mirrorCamera = new THREE.PerspectiveCamera(45, mirrorWidth / mirrorHeight, 0.1, 1000);
mirrorCamera.position.set(0, 0, 15);
mirrorCamera.lookAt(0, 0, 0);

// Layer configuration
const MAIN_LAYER = 0;
const REFLECTION_LAYER = 1;

yellowBlock.layers.set(MAIN_LAYER);
redBlock.layers.set(MAIN_LAYER);
mirror.layers.set(MAIN_LAYER);
blueBlock.layers.set(REFLECTION_LAYER);
mirrorCamera.layers.set(REFLECTION_LAYER);

// Global variables for animation
let animationInProgress = false;
let totalRotation = 0;
let targetRotation = 0;
let rotationDirection = 1;
let dragging = false;
let selectedObject = null;
let needs_log = true;

function renderMirrorView() {
    const ratioX = 0.00973;
    const ratioY = 0.0179;

    renderer.setRenderTarget(reflectionRenderTarget);
    renderer.clear();
    renderer.render(scene, mirrorCamera);

    reflectionRenderTarget.texture.wrapS = THREE.RepeatWrapping;
    reflectionRenderTarget.texture.wrapT = THREE.RepeatWrapping;
    mirror.material = new THREE.MeshBasicMaterial({
        map: reflectionRenderTarget.texture,
        side: THREE.DoubleSide,
    });

    const uOffset = window.innerWidth / 2;
    const vOffset = window.innerHeight / 2 - mirrorHeight / 2;

    // mirror.material.map.offset.set(uOffset / window.innerWidth, vOffset / window.innerHeight);
    // mirror.material.map.repeat.set(scaleFactorWidth*3, scaleFactorHeight*3);
    // mirror.material.map.repeat.set(ratioX, ratioY);

    renderer.setRenderTarget(null);
}

// Main scene render loop
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

    // Render the mirror scene
    renderMirrorView();
    if (needs_log) {
        // Put the log here
        const mirrorPosition = mirror.position.clone();
        mirrorPosition.project(mirrorCamera);

        const x = (mirrorPosition.x * 0.5 + 0.5) * window.innerWidth;
        const y = (mirrorPosition.y * -0.5 + 0.5) * window.innerHeight;

        console.log(`Mirror screen position: (${x}, ${y})`);

        const worldLength = 7; // Example length in world units
        const screenWidth = x; // X position calculated above
        const screenHeight = y; // Y position calculated above
        const ratioX = worldLength / screenWidth; // Ratio of world length to screen width
        const ratioY = worldLength / screenHeight; // Ratio of world length to screen height
        console.log(`scaleFactorWidth: ${scaleFactorWidth}, scaleFactorHeight: ${scaleFactorHeight}`);
        console.log(`Ratio X: ${ratioX}, Ratio Y: ${ratioY}`);
        needs_log = false;
    }
}

function createTrail() {
    // Create a simple 3D trail using box geometries
    const trailMaterial = new THREE.MeshBasicMaterial({color: 0x000000});
    const trailLength = 5;
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
    yellowBlock.position.z = Math.max(Math.min(intersectionPoint.z - 6, -1), -5);
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
