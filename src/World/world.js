import * as THREE from 'three';
import {PointerLockControls} from "three/addons/controls/PointerLockControls.js";
import {MMDLoader} from "three/addons/loaders/MMDLoader.js";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {Water} from "three/addons/objects/Water.js";
import {Sky} from "three/addons/objects/Sky.js";
import Stats from "three/addons/libs/stats.module.js";
import {Euler} from "three";

// All global variables
// Basic setup
let camera, scene, renderer, controls, stats, zoom = 1;
let building, fences, player, target, gate, water, sky, sun, chest;
let playerBox = new THREE.Box3();
let loadedTextures = [], loadedModels = [];
let gameData, playerData, positionData, gameMode;
const audioLoader = new THREE.AudioLoader();
const listener = new THREE.AudioListener();
let bgm, autoMusicTrigger = true;

// Player upgrade
let selectedPlayerIndex = 0;
let panelOpen = false;

// Player choices
let choices = ['cube_character', 'cube_character2', 'cube_character3'];
let currentChoice = 0;
let infMode = false;

// Maximum and minimum pitch angles in radians
const maxPitch = THREE.MathUtils.degToRad(150);
const minPitch = THREE.MathUtils.degToRad(80);

// Movement controls
const keys = {};
let obstacles = []; // List of objects to check for transparency
let playerFacingOffset = Math.PI / 2;

// Mobile controls
let touchStartX = 0, touchStartY = 0;
let touchDeltaX = 0, touchDeltaY = 0;
let draggingTouch = 0;
let initialPinchDistance = null;
let joystick, joystickActive = false;

// Collision detection and response
let speed = 0.1;

// Transparency
const raycaster = new THREE.Raycaster();
let originalTransparency = {};
let transparentObjects = []; // Keep track of the objects we've modified to restore their transparency later

// Jump
let jumpHeight = 0.4;  // How high the player jumps
let velocity = 0;    // Current velocity of the jump
let gravity = -0.025;  // Gravity affecting the jump
let groundLevel = 0; // Y position of the ground
let jumpInProgress = false;

function loadTexture(url) {
    return new Promise((resolve, reject) => {
        const loader = new THREE.TextureLoader();
        loader.load(url, (texture) => {
            resolve(texture);
        }, undefined, (error) => {
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
                model.scale.set(0.1, 0.1, 0.1);
                res = model;
            } else {
                groundLevel = 0.5;
                if (url.includes('character')) {
                    res = model.scene.children[0].children[0];
                } else {
                    res = model.scene.children[0];
                }
            }
            resolve(res);
        }, (xhr) => {
            document.getElementById('loadingBar').style.width
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
            // reject();
        }
    });
}

function loadAllAssets() {
    bgm = new THREE.Audio(listener);
    audioLoader.load('data/sounds/World_bgm.m4a', function (buffer) {
        bgm.setBuffer(buffer);
        bgm.setLoop(true);
        bgm.setVolume(0.3);
    });

    const textureURLs = ['data/textures/rocky_terrain.jpg', 'data/textures/grassy_terrain.jpg',
        'data/textures/waternormals.png'];
    const modelURLs = ['data/models/cube_character.glb', 'data/models/cube_character2.glb', 'data/models/cube_character3.glb',
        'data/models/fence.glb', 'data/models/cube_monster.glb',
        'data/models/gate.glb', "data/models/gate_off.glb",
        "data/models/chest.glb", "data/models/cube.glb", "data/models/clock.glb"];
    const dataKeys = ['gameData', 'playerData', 'positionData', 'modelData', 'infMode'];

    const texturePromises = textureURLs.map(url => loadTexture(url));
    const modelPromises = modelURLs.map(url => loadModel(url));
    const gameDataPromise = dataKeys.map(key => loadGameData(key));

    Promise.all([...texturePromises, ...modelPromises, ...gameDataPromise])
        .then((results) => {
            loadedTextures = results.slice(0, texturePromises.length);
            loadedModels = results.slice(texturePromises.length, texturePromises.length + modelPromises.length);
            const loadedData = results.slice(texturePromises.length + modelPromises.length,
                texturePromises.length + modelPromises.length + gameDataPromise.length);
            gameData = loadedData[0];
            playerData = loadedData[1];
            positionData = loadedData[2];
            if (loadedData[3]) currentChoice = loadedData[3];
            if (loadedData[4]) infMode = loadedData[4];

            console.log('All assets loaded successfully');
            console.log('Loaded textures:', loadedTextures);
            console.log('Loaded models:', loadedModels);
            console.log('Loaded game data:', loadedData);

            resolveGameData();
            init();

            setTimeout(() => {
                document.getElementById('loadingBar').style.display = 'none';
                document.getElementById('loadingScreen').style.opacity = '0';
                document.getElementById('container').style.display = 'block';
                document.getElementById('container').style.opacity = '1';
                setTimeout(() => {
                    document.getElementById('loadingScreen').style.display = 'none';
                }, 1000);
            }, 1000);
        })
        .catch((error) => {
            console.log("An error occurred while loading assets:", error);
        });
}

function resolveGameData() {
    // Check if game data exists
    if (gameData === null) {
        showMessage("No game data found in localStorage!", 2);
        setTimeout(()=>{
            window.location.href = 'index.html';
        }, 2000);

        gameData = {
            level: 1,
            score: 0,
            state: "world",
        };
        // 1: battle 2: cube game 3: clock game
        gameData.gameMode = gameMode = 1;
        localStorage.setItem('gameData', JSON.stringify(gameData));
    } else {
        if (gameData.state === "in game") {
            if (gameData.gameMode === 1) {
                window.location.href = 'combat.html';
            } else if (gameData.gameMode === 2) {
                window.location.href = 'cube.html';
            } else if (gameData.gameMode === 3) {
                window.location.href = 'clock.html';
            } else {
                showMessage("Invalid game mode!", 2);
            }
        } else if (gameData.state === "path") {
            window.location.href = 'path.html';
        } else if (gameData.state === "win") {
            setTimeout(() => {
                showMessage("Welcome back! You have won the game!");
            }, 1000);
        } else if (gameData.state === "world") {
            setTimeout(() => {
                showMessage("Welcome to level " + gameData.level + "!");
            }, 1000);
        }
        if (!gameData.gameMode) {
            if(gameData.level <= 15) {
                gameData.gameMode = (gameData.level - 1) % 3 + 1;
            } else {
                gameData.gameMode = 1;
            }
            localStorage.setItem('gameData', JSON.stringify(gameData));
        }
        gameMode = gameData.gameMode;
    }
    if (playerData === null) {
        playerData = initPlayerData;
        localStorage.setItem('playerData', JSON.stringify(playerData));
    }

    addUpdatePanel();
}

function init() {
    // Create scene
    scene = new THREE.Scene();

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(10, 0, 0);
    if (positionData) {
        camera.position.set(positionData.camera[0], positionData.camera[1], positionData.camera[2]);
        camera.rotation.set(positionData.cameraRot[0], positionData.cameraRot[1], positionData.cameraRot[2]);
        camera.rotation.order = positionData.cameraRot[3];
    }
    scene.add(camera);
    // camera.lookAt(0, 0, 0); // Point the camera at the origin

    // Create renderer
    const container = document.getElementById('container');
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    stats = new Stats();
    container.appendChild(stats.dom);

    // Controls impl
    controls = new PointerLockControls(camera, renderer.domElement);
    scene.add(controls.object);
    controls.maxPolarAngle = maxPitch;
    controls.minPolarAngle = minPitch;
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enablePan = true;
    controls.screenSpacePanning = false;

    document.getElementById("operationPanel").style.display = "flex";
    if (isMobile()) {
        joystick = nipplejs.create({
            zone: document.getElementById("joyStick"),
            color: 'white',
            position: {left: '50px', bottom: '50px'},
            size: 170,
        });
        joystick.on('move', (evt, data) => {
            const angle = data.angle.degree;

            keys['w'] = angle >= 30 && angle <= 150;
            keys['s'] = angle >= 210 && angle <= 330;
            keys['a'] = angle > 120 && angle < 240;
            keys['d'] = (angle >= 0 && angle < 60) || (angle > 300 && angle <= 360);
        })
        joystick.on('end', () => {
            joystickActive = false;
            keys['w'] = keys['s'] = keys['a'] = keys['d'] = false;
        });
    } else {
        document.getElementById("panelButton").innerText = "Panel (Press E)"
        document.getElementById("tutorialButton").innerText = "Tutorial (Press T)"
        document.getElementById("jumpButton").style.display = "none";
        document.getElementById("attackButton").style.display = "none";
    }

    // Create light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
    directionalLight.position.set(0, 10, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    directionalLight.shadow.mapSize.width = 2048;  // Higher resolution
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    placeLayout();
    animate();
}

function placeLayout() {
    // Load floor texture
    const groundTexture = loadedTextures[0];
    groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;

    // Ground
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial({
        map: groundTexture, flatShading: true
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Rotate to make it horizontal
    ground.receiveShadow = true;
    scene.add(ground);

    // Water
    const waterGeometry = new THREE.PlaneGeometry(1000, 1000);
    const waterNormals = loadedTextures[2];
    waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
    water = new Water(
        waterGeometry,
        {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: waterNormals,
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffffff,
            waterColor: 0x001e0f,
            distortionScale: 3.7,
            fog: scene.fog !== undefined
        }
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.1, 0);
    scene.add(water);

    // Sky
    sun = new THREE.Vector3();
    sky = new Sky();
    sky.scale.setScalar(1000);

    const skyUniforms = sky.material.uniforms;

    skyUniforms['turbidity'].value = 10;
    skyUniforms['rayleigh'].value = 1;
    skyUniforms['mieCoefficient'].value = 0.08;
    skyUniforms['mieDirectionalG'].value = 0.5;
    sun.setFromSphericalCoords(1, Math.PI / 2, 0);
    skyUniforms['sunPosition'].value.copy(sun);
    water.material.uniforms['sunDirection'].value.copy(sun).normalize();
    scene.add(sky);

    // Building
    let randX = Math.floor(Math.random() * 40) - 20;
    let randZ = Math.floor(Math.random() * 20) - 20;
    if (gameData.state !== "win") {
        if (gameMode === 1) {
            console.log("Game mode: battle");
            building = loadedModels[4];
            building.scale.set(3, 3, 3);
            building.material.transparent = true;
            building.material.opacity = 0.7;
        } else if (gameMode === 2) {
            console.log("Game mode: cube game");
            // create a block object for building
            building = loadedModels[8].children[0].children[0].children[0].children[0];
            building.scale.set(20, 20, 20);
            building.material.transparent = true;
            building.material.opacity = 0.7;
        } else if (gameMode === 3) {
            console.log("Game mode: clock game");
            // create a clock object for building
            building = loadedModels[9].children[0].children[0].children[0];
            building.scale.set(0.03, 0.03, 0.03);
        }
        building.position.set(randX, 1, randZ);
        building.castShadow = true;
        building.receiveShadow = true;
        obstacles.push(building);
        scene.add(building);
    }

    //Chest
    if (!localStorage.getItem('chestClaimed')) {
        randX = Math.floor(Math.random() * 40) - 20;
        randZ = Math.floor(Math.random() * 20);
        chest = loadedModels[7];
        chest.scale.set(1.5, 1.5, 1.5);
        chest.position.set(randX, 0.7, randZ);
        chest.castShadow = true;
        chest.receiveShadow = true;
        obstacles.push(chest);
        scene.add(chest);
    }

    // Gate
    if (gameData.state === "win") {
        gate = loadedModels[5].children[0];
    } else {
        gate = loadedModels[6].children[0];
    }
    gate.scale.set(1.5, 1.5, 1.5);
    gate.position.set(-8, 1.5, 0);
    gate.castShadow = true;
    gate.receiveShadow = true;
    gate.rotation.z += Math.PI / 2;
    obstacles.push(gate);
    scene.add(gate);

    // Player
    player = loadedModels[currentChoice];
    player.position.set(9, groundLevel, 1);
    if (positionData) {
        player.position.set(positionData.player[0], positionData.player[1], positionData.player[2]);
        jumpInProgress = true;
    }
    player.castShadow = true;
    player.receiveShadow = true;
    scene.add(player);

    // Fence
    const types = [0, 1, 1, 1, 1, 1, 1, 1, 1,
            1, 1, 1, 1, 1, 1, 1, 1, 1,
            1, 1, 1, 1, 1, 1, 1, 1, 1,
            1, 1, 1, 1, 1, 1, 1, 1, 1];
    const positions = [[-22, 0, 25], [-18.5,0, 25], [-13, 0, 25], [-7.5, 0, 25], [-2, 0, 25], [3.5, 0, 25], [9, 0, 25], [14.5, 0, 25], [20, 0, 25],
            [25, 0, 25], [25, 0, 19.5], [25, 0, 14], [25, 0, 8.5], [25, 0, 3], [25, 0, -2.5], [25, 0, -8], [25, 0, -13.5], [25, 0, -19],
            [25, 0, -25], [19.5, 0, -25], [14, 0, -25], [8.5, 0, -25], [3, 0, -25], [-2.5, 0, -25], [-8, 0, -25], [-13.5, 0, -25], [-19, 0, -25],
            [-24, 0, -25], [-24, 0, -19.5], [-24, 0, -14], [-24, 0, -8.5], [-24, 0, -3], [-24, 0, 2.5], [-24, 0, 8], [-24, 0, 13.5], [-24, 0, 19]];
    const rotations = [0, 0, 0, 0, 0, 0, 0, 0, 0,
            Math.PI/2, Math.PI/2, Math.PI/2, Math.PI/2, Math.PI/2, Math.PI/2, Math.PI/2, Math.PI/2, Math.PI/2,
            Math.PI, Math.PI, Math.PI, Math.PI, Math.PI, Math.PI, Math.PI, Math.PI, Math.PI,
            3*Math.PI/2, 3*Math.PI/2, 3*Math.PI/2,3*Math.PI/2,3*Math.PI/2,3*Math.PI/2,3*Math.PI/2,3*Math.PI/2,3*Math.PI/2];
        addFences(types, positions, rotations);

    // Target mark
    target = new THREE.Group();
    const circleGeometry = new THREE.CircleGeometry(1, 32);  // radius 1, 32 segments
    const circleMaterial = new THREE.MeshBasicMaterial({color: 0xff0000});
    const circle = new THREE.Mesh(circleGeometry, circleMaterial);
    target.add(circle);
    const lineMaterial = new THREE.MeshBasicMaterial({color: 0xff0000});
    const horizontalLineGeometry = new THREE.PlaneGeometry(2.5, 0.1);  // width, height
    const horizontalLine = new THREE.Mesh(horizontalLineGeometry, lineMaterial);
    target.add(horizontalLine);
    const verticalLineGeometry = new THREE.PlaneGeometry(0.1, 2.5);  // width, height
    const verticalLine = new THREE.Mesh(verticalLineGeometry, lineMaterial);
    target.add(verticalLine);
    scene.add(target);
}

function addFences(types, positions, facings) {
    const fenceModel = loadedModels[3];
    fences = new THREE.Group();

    for (let i = 0; i < types.length; i++) {
        const fence = fenceModel.children[types[i]].clone();
        fence.scale.setScalar(2);
        fence.position.set(positions[i][0], positions[i][1], positions[i][2]);
        fence.rotation.y = facings[i];
        fence.children.forEach((child) => {
            child.castShadow = true;
            child.receiveShadow = true;
            obstacles.push(child);
        });
        fences.add(fence);
    }

    scene.add(fences);
}

function updatePlayerPanel(index) {
    const player = playerData[index];
    document.getElementById("player-name").innerText = `Name: ${player.name}`;
    document.getElementById("player-lv").innerText = `Level: ${player.lv}`;
    document.getElementById("player-hp").innerText = `HP: ${player.hp}/${player.maxHp}`;
    document.getElementById("player-atk").innerText = `ATK: ${player.atk}`;
    document.getElementById("player-def").innerText = `DEF: ${player.def}`;
    document.getElementById("player-crit").innerText = `Crit Rate: ${player.crit_rate * 100}%`;
    document.getElementById("player-speed").innerText = `Speed: ${player.speed}`;
    document.getElementById("money").innerText = `Money: $${gameData.score}`;
    document.getElementById("restore-hp").innerText = `Restore HP (Cost: $${Math.ceil((player.maxHp - player.hp) / 10)})`;
}

function addUpdatePanel() {
    // Initialize the player selection dropdown
    const playerSelect = document.getElementById("player-select");

    // Populate the dropdown with player names
    playerData.forEach(player => {
        const option = document.createElement("option");
        option.value = player.id;
        option.textContent = player.name;
        playerSelect.appendChild(option);
    });
    updatePlayerPanel(0);

    // Event listener for player selection dropdown
    playerSelect.addEventListener("change", function () {
        selectedPlayerIndex = playerData.findIndex(player => player.id === parseInt(playerSelect.value));
        updatePlayerPanel(selectedPlayerIndex);
    });
}

// Function to save the original transparency and opacity of an object
function saveOriginalTransparency(object) {
    if (object.material) {
        // Save the original transparency and opacity if not already saved
        originalTransparency[object.uuid] = {
            transparent: object.material.transparent, opacity: object.material.opacity
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
    const intersects = raycaster.intersectObjects(obstacles, true);

    // Make the intersected objects semi-transparent
    intersects.forEach((intersection) => {
        setObjectTransparent(intersection.object, 0.5); // 0.5 for 50% transparency
        transparentObjects.push(intersection.object); // Track the object to reset it later
    });
}

function handleMovement() {
    if (panelOpen) return;

    // The list of directions the player can move in
    let movable = {'a': [], 'w': [], 's': [], 'd': []};
    let displacement;

    // Get the direction of the camera
    const direction = new THREE.Vector3();
    controls.getDirection(direction);
    const perp = new THREE.Vector3();
    perp.crossVectors(direction, controls.object.up);
    perp.normalize();

    movable['a'].push(keys['a']);
    movable['w'].push(keys['w']);
    movable['s'].push(keys['s']);
    movable['d'].push(keys['d']);

    obstacles.forEach(obstacle => {
        const obstacleBox = new THREE.Box3().setFromObject(obstacle);

        // Get the point on the obstacle closest to the player
        const obstaclePoint = new THREE.Vector3(
            THREE.MathUtils.clamp(player.position.x, obstacleBox.min.x, obstacleBox.max.x),
            THREE.MathUtils.clamp(player.position.y, obstacleBox.min.y, obstacleBox.max.y) + groundLevel,
            THREE.MathUtils.clamp(player.position.z, obstacleBox.min.z, obstacleBox.max.z)
        );
        const toObstacle = obstaclePoint.sub(player.position);

        // Collision detection
        playerBox.setFromObject(player);
        const collide = playerBox.intersectsBox(obstacleBox);
        movable['w'].push((!collide) || (collide && direction.dot(toObstacle) < -0.07));
        movable['s'].push((!collide) || (collide && direction.dot(toObstacle) > 0.07));
        movable['a'].push((!collide) || (collide && perp.dot(toObstacle) > 0.07));
        movable['d'].push((!collide) || (collide && perp.dot(toObstacle) < -0.07));
    });

    // Movement controls
    displacement = controls.object.position.clone();
    const cameraDirection = new THREE.Vector3();
    const movingW = movable['w'].reduce((a, b) => a && b);
    const movingS = movable['s'].reduce((a, b) => a && b);
    const movingA = movable['a'].reduce((a, b) => a && b);
    const movingD = movable['d'].reduce((a, b) => a && b);
    let hasMoved = movingW || movingS || movingA || movingD;
    if (hasMoved) {
        camera.getWorldDirection(cameraDirection);
        player.rotation.y = Math.atan2(cameraDirection.x, cameraDirection.z);
        if (keys['a'] && keys['w'])
            player.rotation.y += Math.PI / 4;
        else if (keys['d'] && keys['w'])
            player.rotation.y -= Math.PI / 4;
        else if (keys['a'] && keys['s'])
            player.rotation.y += 3 * Math.PI / 4;
        else if (keys['d'] && keys['s'])
            player.rotation.y -= 3 * Math.PI / 4;
        else if (keys['a'])
            player.rotation.y += Math.PI / 2;
        else if (keys['d'])
            player.rotation.y -= Math.PI / 2;
        else if (keys['s'])
            player.rotation.y += Math.PI;
        player.rotation.y -= playerFacingOffset;
    }
    if (movingW) {
        controls.moveForward(speed);   // Move forward
    }
    if (movingS) {
        controls.moveForward(-speed);  // Move backward
    }
    if (movingA) {
        controls.moveRight(-speed);  // Move left
    }
    if (movingD) {
        controls.moveRight(speed);  // Move right
    }

    displacement = controls.object.position.clone().sub(displacement);

    // Update player position
    if (hasMoved) {
        player.position.add(displacement);
    }
}

function handleTarget() {
    let distance;
    if(!localStorage.getItem('chestClaimed')) {
        distance = player.position.distanceTo(chest.position);
        if (distance < 4) {
            showGameHint((isMobile() ? 'Attack' : 'Press F') + ' to claim!');
        }
    }

    if (gameData.state === "win") {
        target.visible = false;
        if (player.position.distanceTo(gate.position) <= 4) {
            showStageHint();
        }
        return;
    }

    distance = player.position.distanceTo(building.position);
    if (distance < 4) {
        showGameHint();
    }

    target.position.copy(building.position);
    target.lookAt(player.position.x, target.position.y, player.position.z);

    // Get distance from target to player
    distance = player.position.distanceTo(building.position);
    target.visible = distance <= 10;

    let scale = distance / 14 + 0.1;
    scale = THREE.MathUtils.clamp(scale, 0.3, 0.8);
    target.scale.set(scale, scale, scale);
}

function handleJump() {
    if (jumpInProgress) {
        speed = 0.2;
        // Apply gravity and update position
        velocity += gravity;
        player.position.y += velocity;

        // Stop the jump when player reaches ground level
        if (player.position.y <= groundLevel) {
            speed = 0.1;
            player.position.y = groundLevel;
            jumpInProgress = false;
        }
    }
}

function shakeScreen(intensity = 1, duration = 200) {
    const originalPosition = camera.position.clone();
    const startTime = performance.now();

    function animateShake() {
        const elapsedTime = performance.now() - startTime;
        if (elapsedTime < duration) {
            // Apply random shake based on intensity
            camera.position.x = originalPosition.x + (Math.random() - 0.5) * intensity;
            camera.position.y = originalPosition.y + (Math.random() - 0.5) * intensity;
            camera.position.z = originalPosition.z + (Math.random() - 0.5) * intensity;

            // Request the next frame to keep shaking
            requestAnimationFrame(animateShake);
        } else {
            // Reset the camera position once shaking is complete
            camera.position.copy(originalPosition);
        }
    }

    // Start the shake animation
    animateShake();
}

function animateAttack(attacker, target) {
    const attackerCube = attacker;
    const targetCube = target;
    const originalPosition = attackerCube.position.clone();
    const targetPosition = targetCube.position.clone();

    // Calculate the mid-point to create an arc
    const midPoint = originalPosition.clone().lerp(targetPosition, 0.5);
    midPoint.y += 3; // Raise the midpoint to create an arc effect

    // Move attacker in an arc towards target
    const attackDuration = 600;
    // const returnDuration = 300;
    const startTime = performance.now();

    function animateAttackMove() {
        const elapsedTime = performance.now() - startTime;

        if (elapsedTime < attackDuration) {
            // Move in an arc towards target
            const progress = elapsedTime / attackDuration;
            const position1 = originalPosition.clone().lerp(midPoint, progress);
            const position2 = midPoint.clone().lerp(targetPosition, progress);
            attackerCube.position.lerpVectors(position1, position2, progress);
            requestAnimationFrame(animateAttackMove);
        } else {
            // Start shaking the screen and play the attack sound
            shakeScreen(0.3, 300);
            // loadedSounds.forEach(sound => {
            //     if (sound.name.includes("Attack.wav"))
            //         sound.play();
            // });
        }
    }

    // Start the attack animation
    animateAttackMove();
}

// Function to show a message
function showMessage(message, mode = 1) {
    const messageBox = document.getElementById('messageBox');
    const messageText = document.getElementById('messageText');

    // Set the message text dynamically
    messageText.innerHTML = message;
    messageBox.classList.add('show');
    if (mode === 2) {
        messageBox.style.backgroundColor = "rgba(255, 0, 0, 1)";
    } else {
        messageBox.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    }


    // Optional: Hide the message after a delay (e.g., 3 seconds)
    setTimeout(() => {
        messageBox.classList.remove('show');
    }, 2000);  // Message disappears after 3 seconds
}

function showStageHint() {
    const hintDiv = document.getElementById('stageHint');

    // 创建提示框内容
    hintDiv.innerHTML = (isMobile() ? 'Attack' : 'F') + ': move to the next stage';

    // 设置提示框样式
    hintDiv.style.position = 'absolute';
    hintDiv.style.bottom = '40%';
    hintDiv.style.right = '20%';
    hintDiv.style.transform = 'translate(-50%, -50%)';
    hintDiv.style.padding = '20px 40px';
    hintDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    hintDiv.style.color = 'white';
    hintDiv.style.fontSize = '18px';
    hintDiv.style.borderRadius = '15px';
    hintDiv.style.textAlign = 'center';
    hintDiv.style.display = 'block';  // 显示提示框

    // 隐藏提示框，设置延迟时间（例如1秒后隐藏）
    setTimeout(() => {
        hintDiv.style.display = 'none';
    }, 1000);
}

function showGameHint(text=(isMobile() ? 'Attack' : 'Click the mouse') + ' to start') {
    const hintDiv = document.getElementById('stageHint');

    // 创建提示框内容
    hintDiv.innerHTML = text;

    // 设置提示框样式
    hintDiv.style.position = 'absolute';
    hintDiv.style.bottom = '40%';
    hintDiv.style.right = '20%';
    hintDiv.style.transform = 'translate(-50%, -50%)';
    hintDiv.style.padding = '20px 40px';
    hintDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    hintDiv.style.color = 'white';
    hintDiv.style.fontSize = '18px';
    hintDiv.style.borderRadius = '15px';
    hintDiv.style.textAlign = 'center';
    hintDiv.style.display = 'block';  // 显示提示框

    // 隐藏提示框，设置延迟时间（例如1秒后隐藏）
    setTimeout(() => {
        hintDiv.style.display = 'none';
    }, 1000);
}

function claimChest() {
    if (localStorage.getItem('chestClaimed')) {
        showMessage("OOps, you have already claimed the chest!", 2);
        scene.remove(chest);
        return;
    }
    let reward = Math.floor(Math.random() * 200) + 100;
    showMessage("You have claimed the chest and received $" + reward + "!");
    gameData.score += reward;
    localStorage.setItem('gameData', JSON.stringify(gameData));
    localStorage.setItem('chestClaimed', true);
    scene.remove(chest);
}

function tryAttack() {
    // Get the distance from player to building
    const distance = player.position.distanceTo(building.position);
    if (distance <= 4) {
        if (!isMobile()) controls.unlock();
        if (gameMode === 1) {
            showMessage('You are entering combat!');
        } else if (gameMode === 2) {
            showMessage('You are entering cube game!')
        } else if (gameMode === 3) {
            showMessage('You are entering clock game!')
        }
        const currentLevel = gameData.level || 1;
        const currentScore = gameData.score || 0;
        const updateData = {
            level: currentLevel,
            score: currentScore,
            difficulty: currentLevel,
            state: "in game",
            gameMode: gameMode,
        };
        localStorage.setItem('gameData', JSON.stringify(updateData));
        console.log("Storing game data in localStorage: ", updateData);

        const positionData = {
            player: [player.position.x, player.position.y, player.position.z],
            camera: [camera.position.x, camera.position.y, camera.position.z],
            cameraRot: [camera.rotation.x, camera.rotation.y, camera.rotation.z, camera.rotation.order],
        }
        localStorage.setItem('positionData', JSON.stringify(positionData));
        console.log("Storing position data in localStorage: ", positionData);

        pauseAudio();
        animateAttack(player, building);
        setTimeout(() => {
            if (gameMode === 1)
                window.location.href = 'combat.html';
            else if (gameMode === 2) {
                window.location.href = 'cube.html';
            } else if (gameMode === 3) {
                window.location.href = 'clock.html';
            }
        }, 1000);
    } else {
        showMessage("No enemy in sight!");
    }
}

function handlePanel() {
    if (panelOpen) {
        document.getElementById("player-panel").style.display = "none";
        if (!isMobile()) controls.lock();
        document.getElementById("container").style.opacity = '1';
        panelOpen = false;
        document.getElementById("panelButton").blur();
    } else {
        document.getElementById("player-photo").src = "data/img/char" + (currentChoice + 1) + ".png";
        document.getElementById("player-panel").style.display = "block";
        if (!isMobile()) controls.unlock();
        document.getElementById("container").style.opacity = '0.5';
        panelOpen = true;
    }
}

function handleNextStage() {
    pauseAudio();
    localStorage.removeItem('chestClaimed');
    showMessage("Entering the next stage!");

    if (!infMode) {
        gameData.state = "path";
        localStorage.setItem('gameData', JSON.stringify(gameData));
        window.location.href = 'path.html';
    } else {
        if(gameData.level === 16){
            showMessage("You have completed all levels!", 5000);
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 5000);
            return;
        }
        localStorage.removeItem('positionData');
        gameData.state = "world";
        localStorage.setItem('gameData', JSON.stringify(gameData));
        window.location.href = 'world.html';
    }
}

const desiredFPS = 70;
const frameInterval = 1000 / desiredFPS; // Time per frame in milliseconds
let lastFrameTime = 0;

function animate(currentTime) {
    requestAnimationFrame(animate);
    // Calculate elapsed time since the last frame
    const delta = currentTime - lastFrameTime;
    if(delta < frameInterval) return;
    lastFrameTime = currentTime;

    handleMovement();
    handleTarget();
    handleJump();
    handleTransparency();
    const offset = new THREE.Vector3(0, zoom, 3 * zoom).applyQuaternion(camera.quaternion);
    camera.position.lerp(player.position.clone().add(offset), 0.9);

    water.material.uniforms['time'].value += 1.0 / 120.0;
    stats.update();

    renderer.render(scene, camera);
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

// Key press event listeners
document.addEventListener('keydown', (event) => {
    keys[event.key] = true;
    if (keys['r']) {
        console.log("Reset game data.");
        const gameData = {
            level: 1,
            score: 0,
            state: "world",
        }
        localStorage.setItem('gameData', JSON.stringify(gameData));
        localStorage.setItem('playerData', JSON.stringify(initPlayerData));
        console.log("Player data stored in localStorage: ", initPlayerData);
    }
    if (keys['f']) {
        if (gameData.state === "win" && player.position.distanceTo(gate.position) <= 4) {
            handleNextStage();
        } else if (player.position.distanceTo(chest.position) <= 4) {
            claimChest();
        } else {
            showMessage("You are not at the gate!");
        }
    }
    if (keys['t']) {
        if(!panelOpen){
            if(!isMobile()) controls.unlock();
            showTutorial();
        } else {
            panelOpen = false;
            tutorialCanvas.style.display = "none";
            if(!isMobile()) controls.lock();
        }
    }
    if (keys['e']) {
        handlePanel();
    }
    if (event.code === 'Space' && !jumpInProgress && !panelOpen) {
        jumpInProgress = true;
        velocity = jumpHeight;  // Initial jump force
    }
});
document.addEventListener('keyup', (event) => {
    keys[event.key] = false;
});

// Event listeners for character selection
document.getElementById("left-button").addEventListener("click", function () {
    currentChoice = (currentChoice - 1 + choices.length) % choices.length;
    document.getElementById("player-photo").src = "data/img/char" + (currentChoice + 1) + ".png";
    scene.remove(player);
    player = loadedModels[currentChoice];
    player.position.set(9, groundLevel, 1);
    scene.add(player);
    localStorage.setItem('modelData', currentChoice);
});
document.getElementById("right-button").addEventListener("click", function () {
    currentChoice = (currentChoice + 1) % choices.length;
    document.getElementById("player-photo").src = "data/img/char" + (currentChoice + 1) + ".png";
    scene.remove(player);
    player = loadedModels[currentChoice];
    player.position.set(9, groundLevel, 1);
    scene.add(player);
    localStorage.setItem('modelData', currentChoice);
});

// Event listeners for upgrade buttons
document.getElementById("upgrade-atk").addEventListener("click", function () {
    if (gameData.score >= 10) {
        playerData[selectedPlayerIndex].atk += 10;
        playerData[selectedPlayerIndex].speed += 2;
        gameData.score -= 100;
        updatePlayerPanel(selectedPlayerIndex);
        localStorage.setItem('playerData', JSON.stringify(playerData));
        localStorage.setItem('gameData', JSON.stringify(gameData));
        showMessage("ATK upgraded 10! Cost 100.")
    } else {
        showMessage("Not enough money!", 2);
    }
});
document.getElementById("upgrade-def").addEventListener("click", function () {
    if (gameData.score >= 10) {
        playerData[selectedPlayerIndex].def += 20;
        playerData[selectedPlayerIndex].speed += 2;
        gameData.score -= 100;
        updatePlayerPanel(selectedPlayerIndex);
        localStorage.setItem('playerData', JSON.stringify(playerData));
        localStorage.setItem('gameData', JSON.stringify(gameData));
        showMessage("DEF upgraded 20! Cost 100.")
    } else {
        showMessage("Not enough money!", 2);
    }
});
document.getElementById("upgrade-hp").addEventListener("click", function () {
    if (gameData.score >= 20) {
        let percent = playerData[selectedPlayerIndex].hp / playerData[selectedPlayerIndex].maxHp;
        playerData[selectedPlayerIndex].maxHp += 200;
        playerData[selectedPlayerIndex].speed += 2;
        playerData[selectedPlayerIndex].hp = Math.floor(playerData[selectedPlayerIndex].maxHp * percent);
        gameData.score -= 100;
        updatePlayerPanel(selectedPlayerIndex);
        localStorage.setItem('playerData', JSON.stringify(playerData));
        localStorage.setItem('gameData', JSON.stringify(gameData));
        showMessage("HP upgraded 200! Cost 100.")
    } else {
        showMessage("Not enough money!", 2);
    }
});
document.getElementById("restore-hp").addEventListener("click", function () {
    if (gameData.score >= Math.ceil((playerData[selectedPlayerIndex].maxHp - playerData[selectedPlayerIndex].hp) / 10)) {
        gameData.score -= Math.ceil((playerData[selectedPlayerIndex].maxHp - playerData[selectedPlayerIndex].hp) / 10);
        localStorage.setItem('gameData', JSON.stringify(gameData));
        showMessage("HP restored! Cost " + Math.ceil((playerData[selectedPlayerIndex].maxHp - playerData[selectedPlayerIndex].hp) / 10) + ".");
        playerData[selectedPlayerIndex].hp = playerData[selectedPlayerIndex].maxHp;
        localStorage.setItem('playerData', JSON.stringify(playerData));
        updatePlayerPanel(selectedPlayerIndex);
    } else {
        showMessage("Not enough money!", 2);
    }
});

// Mouse event handling
window.addEventListener('wheel', (event) => {
    if (panelOpen) return;
    zoom = THREE.MathUtils.clamp(zoom + event.deltaY * 0.001, 0.5, 2);
}, false);
window.addEventListener('mousedown', onMouseDown, false);

function onMouseDown() {
    if (autoMusicTrigger) {
        showMessage("Music is playing!");
        bgm.play();
        autoMusicTrigger = false;
    }
    if (panelOpen || isMobile()) return;
    if (!controls.isLocked) controls.lock();
    if (gameData.state === "win") return;

    tryAttack();
}

// Button event handling
document.getElementById("panelButton").addEventListener("click", handlePanel, false);
document.getElementById("jumpButton").addEventListener("click", function () {
    if (!jumpInProgress && !panelOpen) {
        jumpInProgress = true;
        velocity = jumpHeight;  // Initial jump force
    }
}, false);
document.getElementById("attackButton").addEventListener("click", function () {
    if (panelOpen) return;
    if (gameData.state === "win") {
        if (player.position.distanceTo(gate.position) <= 4) {
            handleNextStage();
        } else {
            showMessage("You are not at the gate!");
        }
    } else if (player.position.distanceTo(chest.position) <= 4) {
        claimChest();
    } else {
        tryAttack();
    }
}, false);

// Touch event handling
document.addEventListener('touchstart', onTouchStart, false);
document.addEventListener('touchmove', onTouchMove, false);
document.addEventListener('touchend', onTouchEnd, false);

function onTouchStart(event) {
    if (autoMusicTrigger) {
        showMessage("Music is playing!");
        bgm.play();
        autoMusicTrigger = false;
    }

    // Check if the touch position is in the joystick area
    const touchX = event.touches[event.touches.length - 1].pageX;
    const touchY = event.touches[event.touches.length - 1].pageY;
    const joyStick = document.getElementById("joyStick");
    const joyStickRect = joyStick.getBoundingClientRect();
    const flag = touchX >= joyStickRect.left && touchX <= joyStickRect.right && touchY >= joyStickRect.top && touchY <= joyStickRect.bottom;
    joystickActive |= flag;
    if ((event.touches.length === 1 && !joystickActive) || (event.touches.length === 2 && !flag)) {
        touchStartX = event.touches[event.touches.length - 1].pageX;
        touchStartY = event.touches[event.touches.length - 1].pageY;
        draggingTouch = event.touches.length - 1;
    } else if (event.touches.length === 2 && !joystickActive) {
        // Pinch zoom start
        const dx = event.touches[0].pageX - event.touches[1].pageX;
        const dy = event.touches[0].pageY - event.touches[1].pageY;
        initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
    }
}

function onTouchMove(event) {
    if (panelOpen) return;
    if ((event.touches.length === 1 && !joystickActive) ||
        (event.touches.length === 2 && joystickActive)) {
        touchDeltaX = event.touches[draggingTouch].pageX - touchStartX;
        touchDeltaY = event.touches[draggingTouch].pageY - touchStartY;

        let _euler = new Euler(0, 0, 0, 'YXZ');
        _euler.setFromQuaternion(camera.quaternion);

        _euler.y -= touchDeltaX * 0.006;
        _euler.x -= touchDeltaY * 0.006;

        _euler.x = Math.max(Math.PI / 2 - maxPitch, Math.min(Math.PI / 2 - minPitch, _euler.x));

        camera.quaternion.setFromEuler(_euler);

        touchStartX = event.touches[draggingTouch].pageX;
        touchStartY = event.touches[draggingTouch].pageY;
    } else if (event.touches.length === 2 && !joystickActive) {
        // Pinch zoom move
        const dx = event.touches[0].pageX - event.touches[1].pageX;
        const dy = event.touches[0].pageY - event.touches[1].pageY;
        const currentPinchDistance = Math.sqrt(dx * dx + dy * dy);

        if (initialPinchDistance) {
            const deltaDistance = currentPinchDistance - initialPinchDistance;
            zoom -= deltaDistance * 0.02;
            zoom = THREE.MathUtils.clamp(zoom, 0.5, 2);
        }

        initialPinchDistance = currentPinchDistance;
    }
}

function onTouchEnd(event) {
    if (event.touches.length < 2) {
        initialPinchDistance = null;
    }
}

// Handle window resizing
window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

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

const initPlayerData = [
    {
        id: 1,
        name: "Player 1",
        lv: 90,
        maxHp: 10000,
        hp: 10000,
        atk: 100,
        def: 100,
        crit_rate: 0.6,
        crit_dmg: 2,
        speed: 230
    },
    {
        id: 2,
        name: "Player 2",
        lv: 90,
        maxHp: 10000,
        hp: 10000,
        atk: 100,
        def: 100,
        crit_rate: 0.6,
        crit_dmg: 2,
        speed: 210
    },
    {
        id: 3,
        name: "Player 3",
        lv: 90,
        maxHp: 10000,
        hp: 10000,
        atk: 100,
        def: 100,
        crit_rate: 0.6,
        crit_dmg: 2,
        speed: 190
    },
]


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
const totalPages = 3; // Adjust this based on the number of tutorial steps

// Tutorial Data (You can add more steps as needed)
const tutorialData = [
    {
        image: "data/tutorial/world/main.png",
        text: "The big world is a place for you to explore."
    },
    {
        image: "data/tutorial/world/panel.png",
        text: "Click on the panel button or press E to open the player panel.\n" +
            "You can upgrade your player's attributes here after a game. Each game gives you 500$ reward.\n" +
            "You can also change your character here."
    },
    {
        image: "data/tutorial/world/act.png",
        text: "When you are near an interactive object, follow the instructions to proceed."
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
    panelOpen = false;
    if(!isMobile()) controls.lock();
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
    panelOpen = true;
    tutorialCanvas.style.display = "flex"; // Show the tutorial
    updateTutorial();
}