// main.js
import * as THREE from 'three';
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import Block from './Block.nouse.js';

const container = document.getElementById('container');

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

// Create scene
const scene = new THREE.Scene();

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
    './data/img/1.png',  // Ensure the image format is correct
    function (texture) {
        scene.background = texture;
        console.log('Background texture loaded successfully');
        renderer.render(scene, camera); // Re-render after loading
    },
    undefined,
    function (error) {
        console.error('An error occurred while loading the background texture:', error);
    }
);

// Create lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Ambient light
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 1.5, 100); // Point light
pointLight.position.set(10, 10, 10);
scene.add(pointLight);

// Create mirror
const mirrorWidth = 5;
const mirrorHeight = 8;
const mirrorGeometry = new THREE.PlaneGeometry(mirrorWidth, mirrorHeight);
const mirror = new Reflector(mirrorGeometry, {
    clipBias: 0.003,
    textureWidth: window.innerWidth * window.devicePixelRatio,
    textureHeight: window.innerHeight * window.devicePixelRatio,
    color: 0xc1cbcb
});
mirror.position.set(0, 0, -6);
mirror.material.transparent = true;
mirror.material.opacity = 0.5; // Make the mirror semi-transparent
scene.add(mirror);

// Create sticks for mirror
const rodGeometry = new THREE.CylinderGeometry(0.05, 0.05, 8, 32); // Radius 0.05, height 8
const brassMaterial = new THREE.MeshBasicMaterial({ color: 0xffd700 });

// Upper rod
const upperRod = new THREE.Mesh(rodGeometry, brassMaterial);
upperRod.position.set(0, 4, -6); // Above the mirror
upperRod.rotation.z = Math.PI / 2; // Rotate 90 degrees to lay horizontally
scene.add(upperRod);

// Lower rod
const lowerRod = new THREE.Mesh(rodGeometry, brassMaterial);
lowerRod.position.set(0, -4, -6); // Below the mirror
lowerRod.rotation.z = Math.PI / 2; // Rotate 90 degrees to lay horizontally
scene.add(lowerRod);

// Layer configuration
const MAIN_LAYER = 0;
const NO_REF_LAYER = 1; // No reflection layer

mirror.layers.set(MAIN_LAYER);
camera.layers.enable(NO_REF_LAYER);

// Create helpers
const gridHelper = new THREE.GridHelper(20, 20); // Grid helper
scene.add(gridHelper);

const axesHelper = new THREE.AxesHelper(5); // Axes helper, length 5 units
scene.add(axesHelper);

const blocks = [];

// 创建红色方块
const redBlockGeometryParams = {
    width: 4,
    height: 1,
    depth: 1,
    translateX: 2, // 将几何体中心移动到一端
    translateY: 0,
    translateZ: 0
};

const redBlockPosition = new THREE.Vector3(-1, 0, -2); // 旋转中心的位置
const redBlock = new Block('red', redBlockPosition, redBlockGeometryParams);
redBlock.addToScene(scene);
blocks.push(redBlock);

// // 创建第二个红色方块（通路终点）
// const redBlock2Position = new THREE.Vector3(6, 0, -4);
// const redBlock2 = new Block('red', redBlock2Position, redBlockGeometryParams);
// redBlock2.addToScene(scene);
// blocks.push(redBlock2);

// 定义几何参数
const yellowBlockGeometryParams = {
    width: 1,
    height: 1,
    depth: 2,
    translateX: 0,    // 不需要沿 X 轴平移
    translateY: 0,    // 不需要沿 Y 轴平移
    translateZ: -1    // 将几何体中心沿 Z 轴平移 -1
};

// 初始位置
const yellowBlockPosition = new THREE.Vector3(-2, 0, 0);

// 创建黄色方块实例
const yellowBlock = new Block('yellow', yellowBlockPosition, yellowBlockGeometryParams, 'x');

yellowBlock.addToScene(scene);
blocks.push(yellowBlock);
// // 创建黄色方块
// const yellowBlockGeometryParams = {
//     width: 1,
//     height: 1,
//     depth: 4,
//     translateX: 0,
//     translateY: 0,
//     translateZ: 0 // 将几何体中心移动到一端
// };
//
// // 第一个黄色方块
// const yellowBlockPosition1 = new THREE.Vector3(-5, 0, -3);
// const yellowBlock1 = new Block('yellow', yellowBlockPosition1, yellowBlockGeometryParams);
// yellowBlock1.addToScene(scene);
// blocks.push(yellowBlock1);

// // 第二个黄色方块（通路起点）
// const yellowBlockGeometryParams2 = {
//     width: 1,
//     height: 1,
//     depth: 5,
//     translateX: 0,
//     translateY: 0,
//     translateZ: 0 // 不需要移动中心
// };
// const yellowBlockPosition2 = new THREE.Vector3(-6, 0, -4);
// const yellowBlock2 = new Block('yellow', yellowBlockPosition2, yellowBlockGeometryParams2);
// yellowBlock2.addToScene(scene);
// blocks.push(yellowBlock2);

// // 创建蓝色方块
// const blockMaterialBlue = new THREE.MeshBasicMaterial({ color: 0x0000ff });
// const blueBlockGeometry = new THREE.BoxGeometry(4, 1, 1);
// blueBlockGeometry.applyMatrix4(new THREE.Matrix4().makeTranslation(1.5, 0, 0));
// const blueBlock = new THREE.Mesh(blueBlockGeometry, blockMaterialBlue);
// blueBlock.position.set(-1, 0, -10);
// scene.add(blueBlock);
//
// // 创建黑色方块（不可移动）
// const blockMaterialBlack = new THREE.MeshBasicMaterial({ color: 0x000000 });
// const blackBlockGeometry = new THREE.BoxGeometry(2, 2, 2);
// const blackBlock = new THREE.Mesh(blackBlockGeometry, blockMaterialBlack);
// blackBlock.position.set(3, 0, -5);
// scene.add(blackBlock);


// 在 main.js 中，为每个方块的 checkCollisions 方法赋值
blocks.forEach(block => {
    return false;
    block.checkCollisions = function() {
        // 获取当前方块的边界盒
        const currentBox = block.boundingBox;

        // 检查与其他对象的碰撞
        for (let otherBlock of blocks) {
            if (otherBlock !== block) {
                if (currentBox.intersectsBox(otherBlock.boundingBox)) {
                    return true;
                }
            }
        }

        // 检查与镜子的碰撞
        const mirrorBox = new THREE.Box3().setFromObject(mirror);
        if (currentBox.intersectsBox(mirrorBox)) {
            return true;
        }

        return false;
    };
});


// // 设置图层
// yellowBlocks.forEach(block => {
//     block.layers.set(MAIN_LAYER);
// });
// redBlock.layers.set(MAIN_LAYER);
// redBlock_1.layers.set(MAIN_LAYER);
// blueBlock.layers.set(MAIN_LAYER);
// mirror.layers.set(MAIN_LAYER);
// blackBlock.layers.set(MAIN_LAYER);

// 全局变量
let animationInProgress = false;
let totalRotation = 0;
let targetRotation = 0;
let rotationDirection = 1;
// let dragging = false;
let selectedObject = null;

// 移除或定义 needs_log
// let needs_log = true; // 如果不需要，可以移除相关代码

function renderRotation() {
    let rotationSpeed = Math.PI / 60;
    if (targetRotation < 0) {
        rotationSpeed *= -1;
    }

    // rotate till target
    if (animationInProgress) {
        if (totalRotation < Math.abs(targetRotation)) {
            redBlock_1.rotation.y += rotationSpeed;
            totalRotation += Math.abs(rotationSpeed);
        } else {
            animationInProgress = false;
        }
    }
}

function animate() {
    requestAnimationFrame(animate);

    // 更新所有方块的动画
    blocks.forEach(block => {
        block.update();

        // 如果方块正在发生碰撞，改变颜色
        if (block.isColliding) {
            block.mesh.material.color.set(0xff0000); // 红色
        } else {
            block.mesh.material.color.set(block.color); // 原始颜色
        }
    });

    renderer.render(scene, camera);
}


function createTrail() {
    // Create a simple 3D trail using box geometries
    const trailMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
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

// Raycaster and mouse setup for interactions
const raycaster = new THREE.Raycaster();
const mouseVector = new THREE.Vector2();

let dragging = false;
let selectedBlock = null;

// 新增全局变量
let dragPlane = new THREE.Plane();
let intersection = new THREE.Vector3();
let offset = new THREE.Vector3();

function onMouseDown(event) {
    event.preventDefault();

    // 计算鼠标位置
    mouseVector.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouseVector.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // 更新射线
    raycaster.setFromCamera(mouseVector, camera);

    // 获取所有的交互对象
    const interactableObjects = blocks.map(block => block.group.children).flat();

    // 检测交互
    const intersects = raycaster.intersectObjects(interactableObjects);

    if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;

        // 查找被点击的方块实例
        selectedBlock = blocks.find(block => block.cubes.includes(intersectedObject));

        if (selectedBlock) {
            if (selectedBlock.type === 'red') {
                selectedBlock.startRotation();
            } else if (selectedBlock.type === 'yellow') {
                // 黄色方块的拖动逻辑
                dragging = true;
                console.log('黄色方块被选中，开始拖动');

                // 设置拖动平面
                if (selectedBlock.moveDirection === 'x') {
                    // 对于沿 X 轴移动的方块，使用 YZ 平面
                    dragPlane.setFromNormalAndCoplanarPoint(
                        new THREE.Vector3(0, 1, 0), // 平面的法向量
                        selectedBlock.pivotPoint.position // 平面经过的点
                    );
                } else if (selectedBlock.moveDirection === 'z') {
                    // 对于沿 Z 轴移动的方块，使用 XY 平面
                    dragPlane.setFromNormalAndCoplanarPoint(
                        new THREE.Vector3(0, 1, 0), // 平面的法向量
                        selectedBlock.pivotPoint.position
                    );
                }

                // 计算射线与平面的交点
                if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
                    offset.copy(intersection).sub(selectedBlock.pivotPoint.position);
                }
            }
        } else if (intersectedObject === mirror) {
            // 镜子的拖动逻辑
            dragging = true;
            selectedObject = mirror;
            console.log('镜子被选中，开始拖动');

            // 设置拖动平面（YZ 平面）
            dragPlane.setFromNormalAndCoplanarPoint(
                new THREE.Vector3(0, 0, 1),
                mirror.position
            );

            // 计算射线与平面的交点
            if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
                offset.copy(intersection).sub(mirror.position);
            }
        }
    }
}

function onMouseMove(event) {
    if (!dragging) return;

    event.preventDefault();

    // 计算鼠标位置
    mouseVector.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouseVector.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // 更新射线
    raycaster.setFromCamera(mouseVector, camera);

    if (selectedBlock && selectedBlock.type === 'yellow') {
        // 计算射线与拖动平面的交点
        if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
            // 计算新的位置
            const desiredPosition = new THREE.Vector3().copy(intersection).sub(offset);

            // 更新方块位置
            if (selectedBlock.moveDirection === 'x') {
                // 只更新 X 坐标
                selectedBlock.pivotPoint.position.x = THREE.MathUtils.clamp(desiredPosition.x, -2, 0);
            } else if (selectedBlock.moveDirection === 'z') {
                // 只更新 Z 坐标
                selectedBlock.pivotPoint.position.z = THREE.MathUtils.clamp(desiredPosition.z, -5, -1);
            }

            // 更新边界盒
            selectedBlock.boundingBox.setFromObject(selectedBlock.mesh);

            // 碰撞检测
            selectedBlock.isColliding = selectedBlock.checkCollisions();
            if (selectedBlock.isColliding) {
                // 发生碰撞，改变材质颜色
                selectedBlock.mesh.material.color.set(0xff0000); // 红色
            } else {
                // 未发生碰撞，恢复原始颜色
                selectedBlock.mesh.material.color.set(selectedBlock.color);
            }
        }
    } else if (selectedObject === mirror) {
        // 镜子的拖动逻辑

        // 计算射线与拖动平面的交点
        if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
            // 计算新的位置
            const desiredPosition = new THREE.Vector3().copy(intersection).sub(offset);

            // 更新镜子位置
            mirror.position.x = THREE.MathUtils.clamp(desiredPosition.x, -4, 4);

            // 更新边界盒
            const mirrorBox = new THREE.Box3().setFromObject(mirror);

            // 检查与所有方块的碰撞
            let collision = false;
            for (let block of blocks) {
                if (mirrorBox.intersectsBox(block.boundingBox)) {
                    collision = true;
                    break;
                }
            }

            // 处理碰撞状态
            if (collision) {
                // 发生碰撞，改变材质颜色
                mirror.material.color.set(0xff0000); // 红色
            } else {
                // 未发生碰撞，恢复原始颜色
                mirror.material.color.set(0xc1cbcb); // 原始颜色
            }
        }
    }
}


function onMouseUp() {
    if (dragging) {
        dragging = false;

        if (selectedBlock) {
            selectedBlock.isColliding = false;
            selectedBlock.mesh.material.color.set(selectedBlock.color);
            selectedBlock = null;
        }

        if (selectedObject === mirror) {
            // 重置镜子的颜色
            mirror.material.color.set(0xc1cbcb);
            selectedObject = null;
        }
    }
}


// 添加事件监听器
window.addEventListener('mousedown', onMouseDown, false);
window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('mouseup', onMouseUp, false);

// Utility function to capitalize first letter
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Optional: Handle window resize
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}
