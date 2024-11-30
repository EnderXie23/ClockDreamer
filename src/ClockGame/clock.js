import * as THREE from 'three';
import {Reflector} from "three/examples/jsm/objects/Reflector.js";
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

let renderer, scene, camera;
let destinations = [[2.0, 0.7, -10], [-1, 0.7, 3]];
let mirror, dragObj = [], spinObj = [];

// Layer configuration
const MAIN_LAYER = 0;
const NO_REF_LAYER = 1; // No reflection layer

// goalstage for each step
let goals = [0, 0];
let lights = [], model;

let data = {
    dragObj: [
        {
            shape: [{x: 0, y: 0, z: 0}, {x: 0, y: 0, z: 1}, {x: 0, y: 0, z: 2}, {x: 0, y: 0, z: 3}],
            position: [-7, 0, -3],
            axis: 'z',
            clip: [-6, -2],
            goalPositions: [-2, 999]
        },
    ],
    spinObj: [
        {
            shape: [{x: 0, y: 0, z: 0}, {x: 1, y: 0, z: 0}, {x: 2, y: 0, z: 0}, {x: 3, y: 0, z: 0}, {x: 4, y: 0, z: 0}, {x: 5, y: 0, z: 0}],
            position: [-1, 0, -2],
            state: 0,
            clip: [1, 1],
            goalStates: [2, 1]
        }
    ],
    mirror: {
        position: [0, 0, -6],
        clip: [-4, 3],
        goalStates: [999, -1],
    },
    lights: [
        {
            position: [-1, 1.5, 3],
            color: `rgb(255, 246, 178)`,
            show: 0,
            size: 0.1,
            amplitude: 0.1,
            frequency: 10
        },
        {
            position: [2, 1.5, -10],
            color: `rgb(255, 246, 178)`,
            show: 0,
            size: 0.1,
            amplitude: 0.1,
            frequency: 10
        }
    ],
    model: {
        position: [-5.5, 0.2, 4],
        loadPath: 'data/objects/character/plant1.glb'
    }
}

// Global variables for animation
let animationInProgress = false;
let totalRotation = 0;
let targetRotation = 0;
let rotationDirection = 1;
let dragging = false;
let selectedObject = null;

// Create Raycaster and mouse vector
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let originalIntersection = new THREE.Vector3();
let originalPos;

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
        scene.add(this.pointLight);
    }

    // 定义光源的动画效果
    animate() {
        this.pointLight.visible = !!this.show;
        let time = Date.now() * 0.0005;
        // 使用 Math.sin 来控制上下摆动
        this.pointLight.position.y = this.y + Math.sin(time * this.frequency) * this.amplitude;
    }
}

class Model {
    constructor(startX, startY, startZ, loadpath, scene) {
        this.startX = startX;
        this.startY = startY;
        this.startZ = startZ;
        this.loadPath = loadpath;  // 模型加载路径
        this.model = null;  // 用于存储加载的模型
        this.isLoaded = false; // 模型加载标志
        this.isAnimating = false; // 动画状态标志
        this.animationStartTime = 0; // 动画开始时间
        this.animationDuration = 0.5; // 增加动画持续时间，使动画更慢
        this.scene = scene;
        this.animationStages = [
            {target: new THREE.Vector3(-5.5, 0.2, 0), duration: 0.5},  // 阶段1，增加时间
            {target: new THREE.Vector3(-0.5, 0.2, 0), duration: 0.5},  // 阶段2，增加时间
            {target: new THREE.Vector3(-0.5, 0.6, 4), duration: 0.5}   // 阶段3，增加时间
        ];
        this.currentStage = 0; // 当前阶段
        this.stageStartTime = 0; // 当前阶段开始时间


        // 使用GLTFLoader加载模型
        loader.load(this.loadPath, (gltf) => {
            this.model = gltf.scene;  // 获取加载后的模型
            this.model.position.set(this.startX, this.startY, this.startZ);  // 设置模型的初始位置
            this.scene.add(this.model);  // 将模型添加到场景中
            this.isLoaded = true;  // 标记模型已加载
        }, undefined, (error) => {
            console.error("加载模型时出错", error);
        });
    }

    // 动画方法
    animate() {
        // 第一个动画 (goal1 == 1)
        if (goals[0] === 1 && !this.isAnimating && this.isLoaded) {
            animationInProgress = true;
            this.isAnimating = true;  // 标记动画开始
            this.stageStartTime = Date.now();  // 记录动画开始时间
        }

        // 如果正在进行动画
        if (this.isAnimating && goals[0] === 1) {
            const elapsedTime = (Date.now() - this.stageStartTime) / 1000;  // 计算经过的时间（秒）
            const currentStage = this.animationStages[this.currentStage];
            const progress = Math.min(elapsedTime / currentStage.duration, 1);  // 计算进度

            // 线性插值，平滑过渡
            this.model.position.lerpVectors(
                this.model.position,  // 当前的位置
                currentStage.target,   // 目标位置
                progress               // 进度
            );

            // 如果当前阶段的动画完成，切换到下一个阶段
            if (progress === 1) {
                this.currentStage++;  // 进入下一个阶段
                if (this.currentStage >= this.animationStages.length) {
                    this.isAnimating = false;  // 所有阶段完成
                    goals[0] = 2;
                    lights[0].show = 1;
                    animationInProgress = false;
                } else {
                    // 更新动画开始时间，继续下一个阶段
                    this.stageStartTime = Date.now();
                }
            }
        }

        // 第二个动画 (goal2 == 1)
        if (goals[1] === 1 && !this.isAnimating) {
            animationInProgress = true;
            this.isAnimating = true;  // 标记动画开始
            this.stageStartTime = Date.now();  // 记录动画开始时间
            this.animationStages = [ // 重置动画阶段为goal2的动画
                {target: new THREE.Vector3(-0.5, 0.6, 4), duration: 0.5},  // 阶段1
                {target: new THREE.Vector3(-0.5, 0.2, -6), duration: 0.5},  // 阶段2
                {target: new THREE.Vector3(1.7, 0.6, -6), duration: 0.5}   // 阶段3
            ];
            this.currentStage = 0; // 重置为第一个阶段
        }

        // 如果正在进行动画
        if (this.isAnimating && goals[1] === 1) {
            const elapsedTime = (Date.now() - this.stageStartTime) / 1000;  // 计算经过的时间（秒）
            const currentStage = this.animationStages[this.currentStage];
            const progress = Math.min(elapsedTime / currentStage.duration, 1);  // 计算进度

            // 线性插值，平滑过渡
            this.model.position.lerpVectors(
                this.model.position,  // 当前的位置
                currentStage.target,   // 目标位置
                progress               // 进度
            );

            // 如果当前阶段的动画完成，切换到下一个阶段
            if (progress === 1) {
                this.currentStage++;  // 进入下一个阶段
                if (this.currentStage >= this.animationStages.length) {
                    this.isAnimating = false;  // 所有阶段完成
                    goals[1] = 2;
                    lights[1].show = 1;
                    animationInProgress = false;
                } else {
                    // 更新动画开始时间，继续下一个阶段
                    this.stageStartTime = Date.now();
                }
            }
        }
    }
}

function init(){
    const container = document.getElementById('container');
    // Renderer
    renderer = new THREE.WebGLRenderer({antiAlias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Create scene
    scene = new THREE.Scene();
    // Load texture for background
    scene.background = new THREE.Color(0xD2B48C);

    // Create camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
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

    // Create mirror
    const mirrorWidth = 5;
    const mirrorHeight = 8;
    let geometry = new THREE.PlaneGeometry(mirrorWidth, mirrorHeight);
    mirror = new Reflector(geometry, {
        clipBias: 0.003,
        textureWidth: window.innerWidth * window.devicePixelRatio,
        textureHeight: window.innerHeight * window.devicePixelRatio,
        color: 0xc1cbcb
    });
    mirror.position.set(data.mirror.position[0], data.mirror.position[1], data.mirror.position[2]);
    mirror.goalStates = data.mirror.goalStates;
    mirror.material.transparent = true;
    mirror.material.opacity = 0.9;
    scene.add(mirror);

    // Create blocks
    const blockMaterialDrag = new THREE.MeshBasicMaterial({color: 0xFFB432});
    const blockMaterialSpin = new THREE.MeshBasicMaterial({color: 0xFF6432});

    // Draggable block
    data.dragObj.forEach(obj => {
        const dragGroup = new THREE.Group();
        const dragObjGeometry = new THREE.BoxGeometry(1, 1, 1);
        obj.shape.forEach(shape => {
            const block = new THREE.Mesh(dragObjGeometry, blockMaterialDrag);
            block.position.set(shape.x, shape.y, shape.z);
            dragGroup.add(block);
        });
        dragGroup.position.set(obj.position[0], obj.position[1], obj.position[2]);
        dragGroup.axis = obj.axis;
        dragGroup.clip = obj.clip;
        dragGroup.goalPositions = obj.goalPositions;
        scene.add(dragGroup);
        dragObj.push(dragGroup);
    });

    // Spinning block
    data.spinObj.forEach(obj => {
        const spinGroup = new THREE.Group();
        const spinObjGeometry = new THREE.BoxGeometry(1, 1, 1);
        obj.shape.forEach(shape => {
            const block = new THREE.Mesh(spinObjGeometry, blockMaterialSpin);
            block.position.set(shape.x, shape.y, shape.z);
            spinGroup.add(block);
        });
        spinGroup.state = obj.state;
        spinGroup.clip = obj.clip;
        spinGroup.goalStates = obj.goalStates;
        spinGroup.position.set(obj.position[0], obj.position[1], obj.position[2]);
        scene.add(spinGroup);
        spinObj.push(spinGroup);
    });

    dragObj.forEach(obj => obj.layers.set(MAIN_LAYER));
    spinObj.forEach(obj => obj.layers.set(MAIN_LAYER));
    mirror.layers.set(MAIN_LAYER);
    camera.layers.enable(NO_REF_LAYER);

    data.lights.forEach(light => {
        let lightPoint = new Light(
            light.position[0], light.position[1], light.position[2],   // 位置
            light.color, // 颜色（暖黄色）
            light.size,        // 光球大小
            light.show,          // 显示
            light.amplitude,          // 摆动幅度
            light.frequency           // 摆动频率
        );
        lights.push(lightPoint);
    })

    model = new Model(data.model.position[0], data.model.position[1], data.model.position[2], data.model.loadPath, scene);
}

function animate() {
    handleGoals();
    lights.forEach(light => light.animate());
    model.animate();
    renderer.render(scene, camera);

    requestAnimationFrame(animate);
}

function renderRotation(ind) {
    let rotationSpeed = Math.PI / 60;
    if (targetRotation < 0) {
        rotationSpeed *= -1;
    }

    // rotate till target
    if (animationInProgress) {
        if (totalRotation < Math.abs(targetRotation)) {
            spinObj[ind].rotation.y += rotationSpeed;
            totalRotation += Math.abs(rotationSpeed);
        } else if (!model.isAnimating) {
            animationInProgress = false;
            return;
        }
    }

    requestAnimationFrame(renderRotation.bind(this, ind));
}

function createTrail() {
    // Create a simple 3D trail using box geometries
    const trailMaterial = new THREE.MeshBasicMaterial({color: 0xC8643C});
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
        trailSegment.position.set(-7, 0, 3 - i);  // Spread segments along the Z axis
        scene.add(trailSegment);
        trailSegment.layers.set(NO_REF_LAYER);
    }

    for (let i = 0; i < 4; i++) {
        const trailSegment = new THREE.Mesh(
            new THREE.BoxGeometry(trailWidth, 1, 1),  // Width, height, length of each trail segment
            trailMaterial
        );
        trailSegment.position.set(2 - i, 0, -10);  // Spread segments along the Z axis
        scene.add(trailSegment);
        trailSegment.layers.set(NO_REF_LAYER);
    }

    const destinationMaterial = new THREE.MeshBasicMaterial({color: 0xFFD700});
    destinations.forEach((dest) => {
        const destination = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 0.1, 0.8),
            destinationMaterial
        );
        destination.position.set(dest[0], dest[1], dest[2]);
        scene.add(destination);
        destination.layers.set(NO_REF_LAYER);
    });
}

function handleGoals() {
    if(animationInProgress || dragging) return;
    let goalInd = 0;
    while(goals[goalInd] === 2) {
        goalInd++;
        if(goalInd === goals.length) return;
    }

    let flag = true;
    dragObj.forEach((obj) => {
        if (obj.axis === 'z'){
            // console.log(obj.position.z, obj.goalPositions[goalInd]);
            if(obj.position.z !== obj.goalPositions[goalInd] && obj.goalPositions[goalInd] !== 999) {
                flag = false;
            }
        } else if (obj.axis === 'x') {
            if(obj.position.x !== obj.goalPositions[goalInd] && obj.goalPositions[goalInd] !== 999) {
                flag = false;
            }
        }
    });

    spinObj.forEach((obj) => {
        if(obj.state !== obj.goalStates[goalInd]) {
            flag = false;
        }
    });

    if (mirror.position.x !== mirror.goalStates[goalInd] && mirror.goalStates[goalInd] !== 999) {
        flag = false;
    }

    goals[goalInd] = flag ? 1 : 0;
}

init();
createTrail();
animate();

// Keyboard event listener
window.addEventListener('mousedown', onMouseDown, false);
window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('mouseup', onMouseUp, false);

// Handle mouse down event (selecting objects)
function onMouseDown(event) {
    if(animationInProgress) return;

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the rayCaster with camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Check if we intersect with the yellow or red block
    const intersects = raycaster.intersectObjects([...spinObj, ...dragObj, mirror]);

    if (intersects.length > 0) {
        // Check if the selected object has a parent
        if (intersects[0].object.parent.isGroup)
            selectedObject = intersects[0].object.parent;
        else
            selectedObject = intersects[0].object;

        if (dragObj.includes(selectedObject)) {
            // Start dragging the selected object
            dragging = true;
            raycaster.setFromCamera(mouse, camera);
            let Plane = new THREE.Plane();
            if (selectedObject.axis === 'z') {
                Plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
                originalPos = selectedObject.position.z;
            } else if (selectedObject.axis === 'x') {
                Plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
                originalPos = selectedObject.position.x;
            }
            raycaster.ray.intersectPlane(Plane, originalIntersection);
        } else if (selectedObject === mirror) {
            dragging = true;
            raycaster.setFromCamera(mouse, camera);
            const XPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
            raycaster.ray.intersectPlane(XPlane, originalIntersection);
            originalPos = mirror.position.x;
        } else if (spinObj.includes(selectedObject)) {
            // Check if the red block can rotate
            let rotLim = rotationDirection === 1 ? selectedObject.state <= selectedObject.clip[0]
                : selectedObject.state >= selectedObject.clip[1];
            // Perform rotation on the red block
            if (!rotLim)
                rotationDirection *= -1;
            totalRotation = 0;
            targetRotation = rotationDirection * Math.PI / 2;
            animationInProgress = true;
            selectedObject.state += rotationDirection;
            renderRotation(spinObj.indexOf(selectedObject));
        }
    }
}

// Handle mouse move event (dragging the yellow block)
function onMouseMove(event) {
    if (!dragging || animationInProgress) return;

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update rayCaster to match the new mouse position
    raycaster.setFromCamera(mouse, camera);
    let intersectionPoint;

    if (dragObj.includes(selectedObject)) {
        // Create a plane for dragging along the Z-axis
        let Plane = new THREE.Plane();
        if (selectedObject.axis === 'z')
            Plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
         else if (selectedObject.axis === 'x')
            Plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

        // Use rayCaster to find intersection point on the plane
        intersectionPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(Plane, intersectionPoint);
        let delta;
        if (selectedObject.axis === 'z') {
            delta = intersectionPoint.z - originalIntersection.z;
            selectedObject.position.z = Math.max(Math.min(originalPos + delta, selectedObject.clip[1]), selectedObject.clip[0]);
        } else if (selectedObject.axis === 'x') {
            delta = intersectionPoint.x - originalIntersection.x;
            selectedObject.position.x = Math.max(Math.min(originalPos + delta, selectedObject.clip[1]), selectedObject.clip[0]);
        }
    } else if (selectedObject === mirror) {
        // Create a plane for dragging along the X-axis
        const XPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

        // Use rayCaster to find intersection point on the plane
        intersectionPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(XPlane, intersectionPoint);
        const deltaX = intersectionPoint.x - originalIntersection.x;

        // Move the mirror along the X-axis
        mirror.position.x = Math.max(Math.min(originalPos + deltaX, data.mirror.clip[1]), data.mirror.clip[0]);
    }
}

// Handle mouse up event (stop dragging)
function onMouseUp() {
    dragging = false;

    if (dragObj.includes(selectedObject)) {
        // Snap the yellow block to the nearest grid position
        if(selectedObject.axis === 'z')
            selectedObject.position.z = Math.round(selectedObject.position.z);
        else if(selectedObject.axis === 'x')
            selectedObject.position.x = Math.round(selectedObject.position.x);
    } else if (selectedObject === mirror) {
        // Snap the mirror to the nearest grid position
        mirror.position.x = Math.round(mirror.position.x);
    }
    console.log("mirror position:", mirror.position.x);
    dragObj.forEach(obj => {
        if (obj.axis === 'z')
            console.log("Drag obj position:", obj.position.z);
        else if (obj.axis === 'x')
            console.log("Drag obj position:", obj.position.x);
    });
    spinObj.forEach(obj => {
        console.log("Spin obj state:", obj.state);
    });

    selectedObject = null;
}

// Handle window resizing
window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});