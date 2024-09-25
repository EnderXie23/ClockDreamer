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

const blueBlock2 = new THREE.Mesh(blueBlockGeometry, blockMaterialBlue);
blueBlock2.position.set(-1, 0, -8);
scene.add(blueBlock2);

// Create mirror
const mirrorHeight = 70;
const mirrorWidth =70;
// const scaleFactorWidth = 1;
// const scaleFactorHeight = 1;
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
mirrorCamera.position.set(10, 10, 10);
mirrorCamera.lookAt(1, 3, 1);

// Layer configuration
const MAIN_LAYER = 0;
const REFLECTION_LAYER = 1;

yellowBlock.layers.set(MAIN_LAYER);
redBlock.layers.set(MAIN_LAYER);
mirror.layers.set(MAIN_LAYER);
blueBlock.layers.set(REFLECTION_LAYER);
// blueBlock.layers.set(MAIN_LAYER);
mirrorCamera.layers.set(REFLECTION_LAYER);

// Global variables for animation
let animationInProgress = false;
let totalRotation = 0;
let targetRotation = 0;
let rotationDirection = 1;
let dragging = false;
let selectedObject = null;
let needs_log = true;

function adjustMirrorView() {
    const rotationAngle = 0;
    const radians = THREE.MathUtils.degToRad(rotationAngle);

    const uRepeat = scaleFactorWidth;
    const vRepeat = scaleFactorHeight;

    const uOffset = (1 - uRepeat) / 2;
    const vOffset = (1 - vRepeat) / 2;

    const rotatedOffsetX = (uOffset - 0.5) * Math.cos(radians) - (vOffset - 0.5) * Math.sin(radians);
    const rotatedOffsetY = (uOffset - 0.5) * Math.sin(radians) + (vOffset - 0.5) * Math.cos(radians);

    mirror.material.map.offset.set(rotatedOffsetX + 0.5, rotatedOffsetY + 0.5);
    mirror.material.map.repeat.set(uRepeat, vRepeat);
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
    renderer.setRenderTarget(reflectionRenderTarget);
    renderer.clear();
    renderer.render(scene, mirrorCamera);
    mirror.material = new THREE.MeshBasicMaterial({
        map: reflectionRenderTarget.texture,
        side: THREE.DoubleSide,
    });
    adjustMirrorView();
    if (needs_log) {
        console.log(reflectionRenderTarget);
        const image = reflectionRenderTarget.texture['image'];

        if (!image.complete) {
            // Show the image in console
            console.log('Texture Image:', image.src);
        } else {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Set canvas size to texture size
            canvas.width = image.width;
            canvas.height = image.height;

            // Draw the image onto the canvas
            ctx.drawImage(image, 0, 0);

            // Convert the canvas to a Data URL
            const dataURL = canvas.toDataURL();

            // Log the Data URL to the console
            console.log('Texture Image URL:', dataURL);
        }
        needs_log = false;
    }

    renderer.setRenderTarget(null);
    // renderer.render(scene, camera);
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
