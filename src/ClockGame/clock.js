import * as THREE from 'three';
import {Reflector} from "three/addons/objects/Reflector.js";
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MMDLoader} from "three/addons/loaders/MMDLoader";

// Basic three.js setup
let renderer, scene, camera;
let mirror, dragObj = [], spinObj = [];
let bgm, autoMusicTrigger = true;
const audioLoader = new THREE.AudioLoader();
const listener = new THREE.AudioListener();

// Layer configuration
const MAIN_LAYER = 0;
const NO_REF_LAYER = 1; // No reflection layer

// game data is stored here
let lights = [], model;
let gameData, loadedModels;
let goalInd = 0;
let data = {
    trail: [
        [-1, 0, 3], [-1, 0, 2], [-1, 0, 1], [-1, 0, 0],
        [-7, 0, 3],
        [2, 0, -11], [1, 0, -11], [0, 0, -11], [-1, 0, -11]
    ],
    destinations: [[2.0, 0.7, -11], [-1, 0.7, 3]],
    dragObj: [
        {
            shape: [{x: 0, y: 0, z: 0}, {x: 0, y: 0, z: 1}, {x: 0, y: 0, z: 2}, {x: 0, y: 0, z: 3}],
            position: [-7, 0, -3],
            axis: 'z',
            clip: [-6, -1],
            goalPositions: [-1, 999],
            offset: 0,
        },
    ],
    spinObj: [
        {
            shape: [{x: 0, y: 0, z: 0}, {x: 1, y: 0, z: 0}, {x: 2, y: 0, z: 0}, {x: 3, y: 0, z: 0}, {x: 4, y: 0, z: 0}, {x: 5, y: 0, z: 0}],
            position: [-1, 0, -1],
            state: 0,
            axis: "y",
            clip: [1, 1],
            goalStates: [2, 1]
        }
    ],
    mirror: {
        position: [0, 0, -6],
        clip: [-4, 3],
        goalStates: [999, -0.7],
        axis: "x",
        offset: 0.3,
    },
    lights: [
        {
            position: [-1, 1.5, 3],
            color: `rgb(255, 246, 178)`,
            show: 1,
            size: 0.1,
            amplitude: 0.1,
            frequency: 10
        },
        {
            position: [2, 1.5, -10],
            color: `rgb(255, 246, 178)`,
            show: 1,
            size: 0.1,
            amplitude: 0.1,
            frequency: 10
        }
    ],
    model: {
        position: [-5.5, 0.2, 4],
        loadPath: 'data/objects/character/plant1.glb',
        animationStages: [
            [
                {target: new THREE.Vector3(-5.5, 0.2, 1), duration: 0.5},
                {target: new THREE.Vector3(-0.5, 0.2, 1), duration: 0.5},
                {target: new THREE.Vector3(-0.5, 0.2, 4), duration: 0.5}
            ],
            [
                {target: new THREE.Vector3(-0.5, 0.2, 4), duration: 0.5},  // 阶段1
                {target: new THREE.Vector3(-0.5, 0.2, -7), duration: 0.5},  // 阶段2
                {target: new THREE.Vector3(1.7, 0.2, -7), duration: 0.5}   // 阶段3
            ]
        ]
    }
}

// Global variables for animation
let animationInProgress = false;
let totalRotation = 0, targetRotation = 0, rotationDirection = 1;
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
            this.lightBulb.layers.set(NO_REF_LAYER);
        }

        // 设置光源位置
        this.pointLight.position.set(this.x, this.y, this.z);
        this.pointLight.castShadow = true;
        scene.add(this.pointLight);
        this.pointLight.layers.set(NO_REF_LAYER);
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
    constructor(startX, startY, startZ) {
        this.startX = startX;
        this.startY = startY;
        this.startZ = startZ;
        this.model = loadedModels[0];
        this.isLoaded = false; // 模型加载标志
        this.isAnimating = false; // 动画状态标志
        this.currentStage = 0;  // 当前动画阶段
        this.animationStages = [];
        this.model.position.set(this.startX, this.startY, this.startZ);
        scene.add(this.model);
        this.model.layers.set(NO_REF_LAYER);
    }
}

function loadFromFile(path) {
    return new Promise((resolve, reject) => {
        fetch(path)
            .then(response => {
                if (!response.ok) {
                    console.error("Failed to load file");
                    reject(new Error("Failed to load file"));
                } else {
                    return response.json();
                }
            })
            .then(data => resolve(data))
            .catch(error => {
                console.error(error);
                reject(error);
            });
    });
}

function loadModel(url) {
    return new Promise((resolve, reject) => {
        let loader, res;
        if (url.includes('.pmx'))
            loader = new MMDLoader();
        else
            loader = new GLTFLoader();
        loader.load(url, (model) => {
            if (url.includes('.pmx')) {
                model.scale.setScalar(0.1);
                res = model;
            } else {
                // model.scene.children[0].scale.set(1.2, 1.2, 1.2);
                res = model.scene.children[0];
            }
            resolve(res);
        }, (xhr) => {
            document.getElementById('progressBarFill').style.width
                = `${(xhr.loaded / xhr.total) * 100}%`;
        }, (error) => {
            console.error(error);
            reject(error);
        });
    });
}

function loadGameData(key) {
    return new Promise((resolve) => {
        const gameData = JSON.parse(localStorage.getItem(key));
        if (gameData) {
            resolve(gameData);
        } else {
            console.warn('No data: ' + key + ' found in localStorage.');
            resolve(null);
        }
    });
}

function resolveGameData() {

}

function loadAllAssets() {
    bgm = new THREE.Audio(listener);
    audioLoader.load('data/sounds/Clock_bgm.m4a', function (buffer) {
        bgm.setBuffer(buffer);
        bgm.setLoop(true);
        bgm.setVolume(0.15);
    });

    const dataKeys = ['gameData'];
    const modelURLs = ['data/objects/character/plant1.glb'];

    const gameDataPromises = dataKeys.map(key => loadGameData(key));
    const modelPromises = modelURLs.map(url => loadModel(url));
    Promise.all([...gameDataPromises, ...modelPromises])
        .then((results) => {
            gameData = results.slice(0, dataKeys.length)[0];
            loadedModels = results.slice(dataKeys.length, dataKeys.length + modelURLs.length);

            console.log("Loaded game data: ", gameData);
            console.log("Loaded models: ", loadedModels);
            resolveGameData();

            const path = "data/clock/clock2.json";
            const dataPaths = [path];
            const dataPromises = dataPaths.map(path => loadFromFile(path));
            Promise.all([...dataPromises])
                .then((results2) => {
                    data = results2[0];
                    console.log("Loaded data: ", data);
                    init();

                    document.getElementById('loadingScreen').style.display = 'none';
                })
                .catch((error) => {
                    console.log("An error occurred while loading assets:", error);
                });
        })
        .catch((error) => {
            console.log("An error occurred while loading assets:", error);
        });
}

function handleWin() {
    pauseAudio();
    showMessage("Congratulations! You have completed the game!", 3000, 1);
    animationInProgress = true;

    let updateGameData = {
        level: gameData.level + 1,
        score: gameData.score + 500,
        state: "path",
    };

    localStorage.setItem('gameData', JSON.stringify(updateGameData));
    console.log("Game data updated: " + JSON.stringify(updateGameData));

    setTimeout(() => {
        window.location.href = "path.html"; // 跳转到 Path 场景
    }, 1000);
}

function moveToGoal(){
    gsap.to(model.model.position, {
        x: model.animationStages[model.currentStage].target.x,
        y: model.animationStages[model.currentStage].target.y,
        z: model.animationStages[model.currentStage].target.z,
        duration: model.animationStages[model.currentStage].duration,
        ease: "power2.inOut",
        onComplete: () => {
            model.currentStage++;
            if (model.currentStage >= model.animationStages.length) {
                lights[goalInd].show = 0;
                animationInProgress = false;
                model.currentStage = 0;
                goalInd++;
                if(goalInd === data.destinations.length){
                    handleWin();
                }
            } else {
                moveToGoal();
            }
        }
    });
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
    const mirrorWidth = data.mirror.size[0];
    const mirrorHeight = data.mirror.size[1];
    let geometry = new THREE.PlaneGeometry(mirrorWidth, mirrorHeight);
    mirror = new Reflector(geometry, {
        clipBias: 0.003,
        textureWidth: window.innerWidth * window.devicePixelRatio,
        textureHeight: window.innerHeight * window.devicePixelRatio,
        color: 0xc1cbcb
    });
    mirror.position.set(data.mirror.position[0], data.mirror.position[1], data.mirror.position[2]);
    mirror.goalStates = data.mirror.goalStates;
    mirror.offset = data.mirror.offset;
    mirror.axis = data.mirror.axis;
    mirror.clip = data.mirror.clip;
    mirror.material.transparent = true;
    mirror.material.opacity = 0.9;
    if(mirror.axis === 'z'){
        mirror.rotation.y = Math.PI / 2;
    }
    scene.add(mirror);

    // Create blocks
    // Draggable block
    data.dragObj.forEach(obj => {
        const dragGroup = new THREE.Group();
        const dragObjGeometry = new THREE.BoxGeometry(1, 1, 1);
        const blockMaterialDrag = new THREE.MeshBasicMaterial({color: 0xFFB432});
        obj.shape.forEach(shape => {
            const block = new THREE.Mesh(dragObjGeometry, blockMaterialDrag);
            block.position.set(shape.x, shape.y, shape.z);
            dragGroup.add(block);
        });
        dragGroup.position.set(obj.position[0], obj.position[1], obj.position[2]);
        dragGroup.axis = obj.axis;
        dragGroup.clip = obj.clip;
        dragGroup.offset = obj.offset;
        dragGroup.goalPositions = obj.goalPositions;
        scene.add(dragGroup);
        dragObj.push(dragGroup);
    });

    // Spinning block
    data.spinObj.forEach(obj => {
        const spinGroup = new THREE.Group();
        const spinObjGeometry = new THREE.BoxGeometry(1, 1, 1);
        const blockMaterialSpin = new THREE.MeshBasicMaterial({color: 0xFF6432});
        obj.shape.forEach(shape => {
            const block = new THREE.Mesh(spinObjGeometry, blockMaterialSpin);
            block.position.set(shape.x, shape.y, shape.z);
            spinGroup.add(block);
        });
        spinGroup.state = obj.state;
        spinGroup.clip = obj.clip;
        spinGroup.axis = obj.axis;
        spinGroup.goalStates = obj.goalStates;
        spinGroup.position.set(obj.position[0], obj.position[1], obj.position[2]);
        if(obj.axis === 'x') {
            spinGroup.rotation.x += Math.PI / 2 * obj.state;
        } else if(obj.axis === 'y') {
            spinGroup.rotation.y += Math.PI / 2 * obj.state;
        } else {
            spinGroup.rotation.z += Math.PI / 2 * obj.state
        }
        if(obj.color){
            spinGroup.children.forEach((block) => {
                block.material.color.setHex(obj.color);
            });
        }
        scene.add(spinGroup);
        spinObj.push(spinGroup);
    });
    console.log("spinObj:", spinObj);

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

    model = new Model(data.model.position[0], data.model.position[1], data.model.position[2]);

    createTrail();
    animate();
}

function animate() {
    handleGoals();
    lights.forEach(light => light.animate());
    renderer.render(scene, camera);

    requestAnimationFrame(animate);
}

function showMessage(message, duration = 1500, mode = 1) {
    const messageList = document.getElementById('messageList');

    const messageBox = document.createElement('div');
    messageBox.classList.add('message-box');
    messageBox.innerHTML = "<p class=\"message-text\">" + message + "</p>";
    messageList.appendChild(messageBox);
    messageBox.classList.add('show');
    if (mode === 2) {
        messageBox.style.backgroundColor = "rgba(255, 0, 0, 1)";
    } else {
        messageBox.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    }

    setTimeout(() => {
        messageBox.classList.remove('show');
        setTimeout(() => {
            messageList.removeChild(messageBox);
        }, 500);
    }, duration - 500);
}

function renderRotation(ind) {
    let rotationSpeed = Math.PI / 60;
    if (targetRotation < 0) {
        rotationSpeed *= -1;
    }

    // rotate till target
    if (animationInProgress) {
        if (totalRotation < Math.abs(targetRotation)) {
            switch (spinObj[ind].axis) {
                case 'x':
                    spinObj[ind].rotation.x += rotationSpeed;
                    break;
                case 'y':
                    spinObj[ind].rotation.y += rotationSpeed;
                    break;
                case 'z':
                    spinObj[ind].rotation.z += rotationSpeed;
                    break;
            }
            totalRotation += Math.abs(rotationSpeed);
        } else {
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

    data.trail.forEach((pos) => {
        const trailSegment = new THREE.Mesh(
            new THREE.BoxGeometry(trailWidth, 1, 1),
            trailMaterial
        );
        trailSegment.position.set(pos[0], pos[1], pos[2]);
        scene.add(trailSegment);
        trailSegment.layers.set(MAIN_LAYER);
    });

    const destinationMaterial = new THREE.MeshBasicMaterial({color: 0xFFD700});
    data.destinations.forEach((dest) => {
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

    let flag = true;
    dragObj.forEach((obj) => {
        if (obj.axis === 'z'){
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
        if((obj.state % 4) !== obj.goalStates[goalInd] && obj.goalStates[goalInd] !== 999) {
            flag = false;
        }
    });

    if(mirror.axis === 'z'){
        if (mirror.position.z !== mirror.goalStates[goalInd] && mirror.goalStates[goalInd] !== 999) {
            flag = false;
        }
    } else {
        if (mirror.position.x !== mirror.goalStates[goalInd] && mirror.goalStates[goalInd] !== 999) {
            flag = false;
        }
    }

    if(flag === true && !animationInProgress) {
        model.animationStages = data.model.animationStages[goalInd];
        animationInProgress = true;
        moveToGoal();
    }
}

function pauseAudio(fadeOutDuration = 1, fadeOutSteps = 60) {
    let currentGain = bgm.gain.gain.value;
    let fadeOutStep = currentGain / fadeOutDuration / fadeOutSteps;
    let stepCount = 0;

    function fadeOutAudio() {
        if (stepCount < fadeOutSteps) {
            // Decrease the volume gently
            bgm.gain.gain.value = currentGain - (fadeOutStep * stepCount);
            stepCount++;
            requestAnimationFrame(fadeOutAudio);
        } else {
            // Once the fade out is complete, you can stop the audio
            bgm.pause();
            bgm.gain.gain.value = currentGain;
        }
    }

    // Trigger the fade-out effect when you want
    fadeOutAudio();
}

loadAllAssets();

// Keyboard event listener
window.addEventListener('mousedown', onMouseDown, false);
window.addEventListener('touchstart', onMouseDown, false);
window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('touchmove', onMouseMove, false);
window.addEventListener('mouseup', onMouseUp, false);
window.addEventListener('touchend', onMouseUp, false);

// Handle mouse down event (selecting objects)
function onMouseDown(event) {
    if(autoMusicTrigger){
        bgm.play();
        autoMusicTrigger = false;
        showMessage("Playing background music!");
    }

    if(animationInProgress) {
        return;
    }

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    if (isMobile()){
        mouse.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
    } else {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

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

        if (dragObj.includes(selectedObject) || selectedObject === mirror) {
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
    if (isMobile()){
        mouse.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
    } else {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    // Update rayCaster to match the new mouse position
    raycaster.setFromCamera(mouse, camera);
    let intersectionPoint;

    if (dragObj.includes(selectedObject) || selectedObject === mirror) {
        // Create a plane for dragging along the axis
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
    }
}

// Handle mouse up event (stop dragging)
function onMouseUp() {
    dragging = false;

    if (dragObj.includes(selectedObject) || selectedObject === mirror) {
        // Snap the yellow block to the nearest grid position
        if(selectedObject.axis === 'z')
            selectedObject.position.z = Math.round(selectedObject.position.z) + selectedObject.offset;
        else if(selectedObject.axis === 'x')
            selectedObject.position.x = Math.round(selectedObject.position.x) + selectedObject.offset;
    }
    console.log("mirror position:", mirror.axis === 'z' ? mirror.position.z : mirror.position.x);
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

// Tutorial
const tutorialCanvas = document.getElementById("tutorial-canvas");
const tutorialContainer = document.getElementById("tutorial-container");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const closeBtn = document.getElementById("close-btn");
let isSwiping = false, startX = 0;

const tutorialText = document.getElementById("tutorial-text");
const tutorialImage = document.getElementById("tutorial-image");
const dotIndicator = document.getElementById("dot-indicator");

let currentPage = 0;
const totalPages = 4; // Adjust this based on the number of tutorial steps

// Tutorial Data (You can add more steps as needed)
const tutorialData = [
    {
        image: "data/tutorial/clock/intro.png",
        text: "The clock dreamer game is all about visual illusions and spatial reasoning."
    },
    {
        image: "data/tutorial/clock/blocks.png",
        text: "You can see some yellow and red blocks in the game.\n" +
            "You can drag the yellow blocks along one axis.\n" +
            "You can rotate the red blocks by clicking on them."
    },
    {
        image: "data/tutorial/clock/mirror.png",
        text: "This is a mirror, you can move it along the X-axis.\n" +
            "The mirror reflects the colored blocks, forming a path that did not exist."
    },
    {
        image: "data/tutorial/clock/goal.png",
        text: "Your final goal is to arrange the colored blocks such that they form a path to the light.\n" +
            "Be careful about the mirror! It can be tricky~"
    }
];

// Function to update the tutorial display
function updateTutorial() {
    // fade-in and fade-out animation
    const tutorialContent = document.querySelector('.tutorial-content');
    tutorialContent.style.opacity = 0;
    // Update dot indicator
    const dots = dotIndicator.getElementsByClassName("dot");
    for (let i = 0; i < dots.length; i++) {
        dots[i].classList.remove("active");
    }
    dots[currentPage].classList.add("active");

    setTimeout(() =>{
        const { image, text } = tutorialData[currentPage];
        tutorialImage.src = image;
        tutorialText.textContent = text;
        tutorialText.innerHTML = tutorialText.innerHTML.replace(/\n/g, '<br>');
        tutorialContent.style.opacity = 1;
    }, 200);
}

// Close button functionality
closeBtn.addEventListener("click", () => {
    tutorialCanvas.style.display = "none"; // Hide the tutorial
});

document.getElementById("tutorialButton").addEventListener("click", () => {
    showTutorial();
});

tutorialContainer.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    isSwiping = true;
});

// Navigation buttons functionality
prevBtn.addEventListener("click", () => {
    if (currentPage > 0) {
        currentPage--;
        updateTutorial();
    }
});

nextBtn.addEventListener("click", () => {
    if (currentPage < totalPages - 1) {
        currentPage++;
        updateTutorial();
    }
});

tutorialContainer.addEventListener('mousemove', (e) => {
    if (isSwiping) {
        const moveX = e.clientX - startX;
        if (Math.abs(moveX) > 50) {
            if (moveX > 0 && currentPage > 0) {
                currentPage--;
                updateTutorial();
            } else if (moveX < 0 && currentPage < totalPages - 1) {
                currentPage++;
                updateTutorial();
            }
            isSwiping = false;
        }
    }
});

tutorialContainer.addEventListener('mouseup', () => {
    isSwiping = false;
});

tutorialContainer.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    isSwiping = true;
});

tutorialContainer.addEventListener('touchmove', (e) => {
    if (isSwiping) {
        const moveX = e.touches[0].clientX - startX;
        if (Math.abs(moveX) > 50) {
            if (moveX > 0 && currentPage > 0) {
                currentPage--;
                updateTutorial();
            } else if (moveX < 0 && currentPage < totalPages - 1) {
                currentPage++;
                updateTutorial();
            }
            isSwiping = false;
        }
    }
});

tutorialContainer.addEventListener('touchend', () => {
    isSwiping = false;
});

// Initial tutorial setup
function showTutorial() {
    tutorialCanvas.style.display = "flex"; // Show the tutorial
    updateTutorial();
}

let isMobile = () => {
    const isMobile = ('ontouchstart' in document.documentElement || navigator.userAgent.match(/Mobi/));
    if (isMobile === true) {
        return isMobile;
    } else {
        let check = false;
        ((a) => {
            if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series([46])0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br([ev])w|bumb|bw-([nu])|c55\/|capi|ccwa|cdm-|cell|chtm|cldc|cmd-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc-s|devi|dica|dmob|do([cp])o|ds(12|-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly([-_])|g1 u|g560|gene|gf-5|g-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd-([mpt])|hei-|hi(pt|ta)|hp( i|ip)|hs-c|ht(c([- _agpst])|tp)|hu(aw|tc)|i-(20|go|ma)|i230|iac([ \-\/])|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja([tv])a|jbro|jemu|jigs|kddi|keji|kgt([ \/])|klon|kpt |kwc-|kyo([ck])|le(no|xi)|lg( g|\/([klu])|50|54|-[a-w])|libw|lynx|m1-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t([- ov])|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30([02])|n50([025])|n7(0([01])|10)|ne(([cm])-|on|tf|wf|wg|wt)|nok([6i])|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan([adt])|pdxg|pg(13|-([1-8]|c))|phil|pire|pl(ay|uc)|pn-2|po(ck|rt|se)|prox|psio|pt-g|qa-a|qc(07|12|21|32|60|-[2-7]|i-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h-|oo|p-)|sdk\/|se(c([-01])|47|mc|nd|ri)|sgh-|shar|sie([-m])|sk-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h-|v-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl-|tdg-|tel([im])|tim-|t-mo|to(pl|sh)|ts(70|m-|m3|m5)|tx-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c([- ])|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas-|your|zeto|zte-/i.test(a.substr(0, 4)))
                check = true;
        })(navigator.userAgent || navigator.vendor || window.opera);
        return check;
    }
}