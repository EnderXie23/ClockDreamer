import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import {Reflector} from "three/examples/jsm/objects/Reflector.js";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const container = document.getElementById('container');
// Renderer
const renderer = new THREE.WebGLRenderer({antiAlias: true});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

// Create scene
let scene = new THREE.Scene();

// Create camera
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(1, 1, 10);

// Rotate camera
const angleY = THREE.MathUtils.degToRad(-30);
const rotationMatrixY = new THREE.Matrix4().makeRotationY(-angleY); // Apply negative angle for clockwise rotation
camera.applyMatrix4(rotationMatrixY); // Apply the rotation to the camera
const angleX = THREE.MathUtils.degToRad(40);
const rotationMatrixX = new THREE.Matrix4().makeRotationX(-angleX);
camera.applyMatrix4(rotationMatrixX);
camera.lookAt(0, 0, 0); // Point the camera at the origin

// Translate camera
const translationMatrix = new THREE.Matrix4().makeTranslation(2, 3.5, 0);
camera.applyMatrix4(translationMatrix);

// Load texture for background
scene.background = new THREE.Color(0xD2B48C);

// goalstage for each step
let goal1 = 0;
let goal2 = 0;

// Create blocks
const blockMaterialYellow = new THREE.MeshBasicMaterial({color: 0xFFB432});
const blockMaterialRed = new THREE.MeshBasicMaterial({color: 0xFF6432});

// Yellow block
const yellowBlockGeometry = new THREE.BoxGeometry(1, 1, 4);
yellowBlockGeometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, 0.5));
const yellowBlock = new THREE.Mesh(yellowBlockGeometry, blockMaterialYellow);
yellowBlock.position.set(-7, 0, -3);
scene.add(yellowBlock);

// Red block
const redBlockGeometry = new THREE.BoxGeometry(6, 1, 1);
redBlockGeometry.applyMatrix4(new THREE.Matrix4().makeTranslation(2.5, 0, 0));
const redBlock = new THREE.Mesh(redBlockGeometry, blockMaterialRed);
redBlock.position.set(-1, 0, -2);
scene.add(redBlock);

// Create mirror
const mirrorWidth = 5;
const mirrorHeight = 8;
let geometry = new THREE.PlaneGeometry( mirrorWidth, mirrorHeight );
let mirror = new Reflector(geometry, {
    clipBias: 0.003,
    textureWidth: window.innerWidth * window.devicePixelRatio,
    textureHeight: window.innerHeight * window.devicePixelRatio,
    color: 0xc1cbcb
});
mirror.position.set(0, 0, -6);
scene.add(mirror);

// Layer configuration
const MAIN_LAYER = 0;
const NO_REF_LAYER = 1; // No reflection layer

yellowBlock.layers.set(MAIN_LAYER);
redBlock.layers.set(MAIN_LAYER);
mirror.layers.set(MAIN_LAYER);
camera.layers.enable(NO_REF_LAYER);

// Global variables for animation
let animationInProgress = false;
let totalRotation = 0;
let targetRotation = 0;
let rotationDirection = 1;
let dragging = false;
let selectedObject = null;
let needs_log = true;

mirror.material.transparent = true;
mirror.material.opacity = 0.9;

function renderRotation() {
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
}


// Main scene render loop
function animate() {
    renderRotation();
    lightPoint1.animate();
    lightPoint2.animate();
    renderer.render(scene, camera);

    requestAnimationFrame(animate);
    if (needs_log) {
        // Put the log here

    }
}

function createTrail() {
    // Create a simple 3D trail using box geometries
    const trailMaterial = new THREE.MeshBasicMaterial({color: 0xC8643C});
    const trailLength = 5;
    const trailWidth = 1;
    const destinationMaterial = new THREE.MeshBasicMaterial({color: 0xFFD700});

    // Create multiple segments to represent the trail
    for (let i = 0; i < 5; i++) {
        const trailSegment = new THREE.Mesh(
            new THREE.BoxGeometry(trailWidth, 1, 1),  // Width, height, length of each trail segment
            trailMaterial
        );
        trailSegment.position.set(-1, 0, 3 - i);  // Spread segments along the Z axis
        trailSegment.layers.set(NO_REF_LAYER);
        scene.add(trailSegment);
        if (i === 0){
            const destination1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.8),destinationMaterial);
            destination1.position.set(-1, 0.7, 3 - i);
            scene.add(destination1);
            destination1.layers.set(NO_REF_LAYER);
        }
    }

    for (let i = 0; i < 2; i++) {
        const trailSegment = new THREE.Mesh(
            new THREE.BoxGeometry(trailWidth, 1, 1),  // Width, height, length of each trail segment
            trailMaterial
        );
        trailSegment.position.set(-7, 0, 3 - i);  // Spread segments along the Z axis
        scene.add(trailSegment);
        trailSegment.layers.set(NO_REF_LAYER);
    }
    const blueBlockGeometry = new THREE.BoxGeometry(4, 1, 1);
    // blueBlockGeometry.applyMatrix4(new THREE.Matrix4().makeTranslation(1.5, 0, 0));
    const blueBlock = new THREE.Mesh(blueBlockGeometry, trailMaterial);
    blueBlock.position.set(0.5, 0, -10);
    scene.add(blueBlock);
    const destination2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.8),destinationMaterial);
    destination2.position.set(2.0, 0.7, -10);
    scene.add(destination2);
    destination2.layers.set(NO_REF_LAYER);
}

class Light {
    constructor(x, y, z, color, size = 0, show = 1, amplitude = 10, frequency = 3) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.color = color;
        this.size = size;
        this.show = show;
        this.amplitude = amplitude;
        this.frequency = frequency;

        // 创建点光源
        this.pointLight = new THREE.PointLight(this.color, 4.0, 100, 2);

        // 创建一个小光球
        if (this.size !== 0) {
            let sphereGeometry = new THREE.SphereGeometry(this.size, 50, 50);
            let basicMaterial = new THREE.MeshBasicMaterial({
                color: this.color
            });
            this.lightBulb = new THREE.Mesh(sphereGeometry, basicMaterial);
            this.pointLight.add(this.lightBulb);
        }

        // 设置光源位置
        this.pointLight.position.set(this.x, this.y, this.z);
        this.pointLight.castShadow = true;

        // 添加到场景
        if (this.show) {
            scene.add(this.pointLight);
        }
    }

    // 定义光源的动画效果
    animate() {
        let time = Date.now() * 0.0005;
        // 使用 Math.sin 来控制上下摆动
        this.pointLight.position.y = this.y + Math.sin(time * this.frequency) * this.amplitude;
    }
}

// 创建一个点光源实例
let lightPoint1 = new Light(
    -1, 1.5, 3,   // 位置
    `rgb(255, 246, 178)`, // 颜色（暖黄色）
    0.1,        // 光球大小
    1,          // 显示
    0.1,          // 摆动幅度
    10           // 摆动频率
);
let lightPoint2 = new Light(
    2, 1.5, -10,   // 位置
    `rgb(255, 246, 178)`, // 颜色（暖黄色）
    0.1,        // 光球大小
    1,          // 显示
    0.1,          // 摆动幅度
    10           // 摆动频率
);

// Create a helper for displaying the coordinate axes
const axesHelper = new THREE.AxesHelper(5); // The number '5' is the size of the axes
scene.add(axesHelper);
// Objects and main character
// Load the .glb model using GLTFLoader
let model = null;
loader.load('data/objects/character/plant1.glb', function (gltf) {
    // Add the loaded model to the scene
    const model = gltf.scene;

    // Set the position of the model
    model.position.set(-5.5, 0.2, 4);
    // model.position.set(-5.5, 0.2, 0);
    // model.position.set(-0.5, 0.2, 0);
    // model.position.set(-0.5, 0.6, 4);


    scene.add(model);
    moveModel();
    // Optionally, scale or rotate the model
    // model.scale.set(1, 1, 1); // scale the model
    // model.rotation.x = Math.PI / 2; // rotate the model if needed
}, undefined, function (error) {
    console.error('Error loading model:', error);
});


createTrail();
animate();

// Keyboard event listener
window.addEventListener('mousedown', onMouseDown, false);
window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('mouseup', onMouseUp, false);

// Create Raycaster and mouse vector
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Handle mouse down event (selecting objects)
function onMouseDown(event) {
    event.preventDefault();

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    console.log(mouse.x, mouse.y);

    // Update the rayCaster with camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Check if we intersect with the yellow or red block
    const intersects = raycaster.intersectObjects([yellowBlock, redBlock, mirror]);

    if (intersects.length > 0) {
        selectedObject = intersects[0].object;

        if (selectedObject === yellowBlock || selectedObject === mirror) {
            // Start dragging the selected object
            dragging = true;
            // console.log('selected object: ', selectedObject.name);
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
    if (!dragging) return;

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update rayCaster to match the new mouse position
    raycaster.setFromCamera(mouse, camera);
    let intersectionPoint;

    if (selectedObject === yellowBlock) {
        // Create a plane for dragging along the Z-axis
        const ZPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);

        // Use rayCaster to find intersection point on the plane
        intersectionPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(ZPlane, intersectionPoint);

        // Align the yellow block to the Z-axis of the intersection point
        yellowBlock.position.z = Math.max(Math.min(intersectionPoint.z - 4, -1), -5);
    } else if (selectedObject === mirror) {
        // Create a plane for dragging along the X-axis
        const XPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

        // Use rayCaster to find intersection point on the plane
        intersectionPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(XPlane, intersectionPoint);

        // Move the mirror along the X-axis
        mirror.position.x = Math.max(Math.min(intersectionPoint.x - 3, 3), -4);
    }
}

// Handle mouse up event (stop dragging)
function onMouseUp() {
    dragging = false;

    if (selectedObject === yellowBlock) {
        // Snap the yellow block to the nearest grid position
        yellowBlock.position.z = Math.round(yellowBlock.position.z);
    } else if (selectedObject === mirror) {
        // Snap the mirror to the nearest grid position
        mirror.position.x = Math.round(mirror.position.x);
    }
    console.log("mirrorposition:", mirror.position.x);
    console.log("yellowblockposition:", yellowBlock.position.z);
    console.log("redblockposition:", redBlock.rotation.y);
    if (yellowBlock.position.z === -1 && redBlock.rotation.y > 3){
    goal1 = 1;
    }
    console.log("goal1:", goal1);
    console.log("goal2:", goal2);


    selectedObject = null;
}