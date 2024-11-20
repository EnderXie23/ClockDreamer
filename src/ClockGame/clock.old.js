import * as THREE from 'three';
import { gsap } from "gsap";
import {Reflector} from "three/examples/jsm/objects/Reflector.js";

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
camera.position.set(0, 0, 10);

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
const loader = new THREE.TextureLoader();
loader.load(
    './data/img/1.png',  // 确保使用正确格式的图片
    function (texture) {
        scene.background = texture;
        console.log('Background texture loaded successfully');
        renderer.render(scene, camera); // 加载后重新渲染
    },
    undefined,
    function (error) {
        console.error('An error occurred while loading the background texture:', error);
    }
);


// Create light
const light = new THREE.PointLight(0xffffff, 1, 100);
light.position.set(10, 10, 10);
scene.add(light);

// Create blocks
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
blueBlock.position.set(-1, 0, -10);
scene.add(blueBlock);

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
mirror.material.transparent = true;
mirror.material.opacity = 0.5; // 使镜子变得半透明

scene.add(mirror);

// Create stick for mirror
// 创建杆子的几何和黄铜材质
const rodGeometry = new THREE.CylinderGeometry(0.05, 0.05, 8, 32); // 半径为0.05，高度为8

const brassMaterial = new THREE.MeshBasicMaterial({color: 0xffd700});

// 创建上杆子
const upperRod = new THREE.Mesh(rodGeometry, brassMaterial);
upperRod.position.set(0, 4, -6); // 放在镜子上方
upperRod.rotation.z = Math.PI / 2; // 旋转90度，使其水平放置
scene.add(upperRod);

// 创建下杆子
const lowerRod = new THREE.Mesh(rodGeometry, brassMaterial);
lowerRod.position.set(0, -4, -6); // 放在镜子下方
lowerRod.rotation.z = Math.PI / 2; // 旋转90度，使其水平放置
scene.add(lowerRod);

// 增加光照
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // 环境光，增强整体亮度
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 1.5, 100); // 点光源，增强金属的反光效果
pointLight.position.set(10, 10, 10);
scene.add(pointLight);


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

const gridHelper = new THREE.GridHelper(20, 20); // 网格帮助工具
scene.add(gridHelper);

const axesHelper = new THREE.AxesHelper(5); // 坐标轴帮助工具，长度为5单位
scene.add(axesHelper);

// 定义路径起点和终点
const startPoint = new THREE.Vector3(-1, 0.75, 3); // 人物当前位置
const endPoint = new THREE.Vector3(-5, 0, -2); // 目标位置

// Main scene render loop
function animate() {
    renderRotation();

    renderer.render(scene, camera);

    requestAnimationFrame(animate);

    if (needs_log) {
        // Put the log here

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
        trailSegment.layers.set(NO_REF_LAYER);
        scene.add(trailSegment);
        if (i === 0) {
            // 创建小人（圆柱体）
            const personGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 32); // 半径0.3，高度1.5
            const personMaterial = new THREE.MeshBasicMaterial({color: 0xffffff}); // 绿色材质
            const person = new THREE.Mesh(personGeometry, personMaterial);

            // 设置小人位置，使其底部与轨迹对齐
            // 轨迹段的中心在Y轴为0，小人高度为1.5，因此Y位置为0.75
            person.position.set(-1, 0.75, 3); // 与第一个轨迹段对齐
            scene.add(person);
        }
    }

    for (let i = 0; i < 2; i++) {
        const trailSegment = new THREE.Mesh(
            new THREE.BoxGeometry(trailWidth, 1, 1),  // Width, height, length of each trail segment
            trailMaterial
        );
        trailSegment.position.set(-5, 0, 3 - i);  // Spread segments along the Z axis
        scene.add(trailSegment);
        trailSegment.layers.set(NO_REF_LAYER);
    }
}

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
    } else if (selectedObject === mirror){
        // Snap the mirror to the nearest grid position
        mirror.position.x = Math.round(mirror.position.x);
    }

    selectedObject = null;
}