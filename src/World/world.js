import * as THREE from 'three';
import {PointerLockControls} from "three/examples/jsm/controls/PointerLockControls.js";
import {MMDLoader} from "three/examples/jsm/loaders/MMDLoader.js";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";

// All global variables
// Basic setup
let camera, scene, renderer, controls;
let building, fence, player, target, gate;
let playerBox = new THREE.Box3();
let loadedTextures = [], loadedModels = [];
let gameData, playerData, gameMode;

// Player upgrade
let selectedPlayerIndex = 0;
let panelOpen = false;

// Maximum and minimum pitch angles in radians
const maxPitch = THREE.MathUtils.degToRad(150);
const minPitch = THREE.MathUtils.degToRad(80);

// Movement controls
const keys = {};
let obstacles = []; // List of objects to check for transparency
let playerFacingOffset = 0;

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
                groundLevel = 0.25;
                res = model.scene.children[0];
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
    return new Promise((resolve, reject) => {
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
    const textureURLs = ['data/textures/rocky_terrain.jpg', 'data/textures/grassy_terrain.jpg'];
    const modelURLs = ['data/models/cube_character.glb', 'data/models/fence.glb', 'data/models/cube_monster.glb',
        'data/models/gate.glb', "data/models/gate_off.glb"];
    const dataKeys = ['gameData', 'playerData']

    const texturePromises = textureURLs.map(url => loadTexture(url));
    const modelPromises = modelURLs.map(url => loadModel(url));
    const gameDataPromise = dataKeys.map(key => loadGameData(key));

    Promise.all([...texturePromises, ...modelPromises, ...gameDataPromise])
        .then((results) => {
            console.log(results);
            loadedTextures = results.slice(0, texturePromises.length);
            loadedModels = results.slice(texturePromises.length, texturePromises.length + modelPromises.length);
            const loadedData = results.slice(texturePromises.length + modelPromises.length,
                texturePromises.length + modelPromises.length + gameDataPromise.length);
            gameData = loadedData[0];
            playerData = loadedData[1];

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
    if(gameData === null){
        gameData = {
            level: 1,
            score: 0,
            state: "none",
        };
        showMessage("Welcome to level " + gameData.level + "!");
        // 1: battle 2: cube game
        gameMode = Math.floor(Math.random() * 2) + 1;
        gameData.gameMode = gameMode;
        localStorage.setItem('gameData', JSON.stringify(gameData));
    } else {
        if (gameData.state === "in game") {
            if (gameData.gameMode === 1) {
                window.location.href = 'combat.html';
            } else if (gameData.gameMode === 2) {
                window.location.href = 'cube.html';
            } else {
                showMessage("Invalid game mode!")
            }
        } else if (gameData.state === "win") {
            showMessage("Welcome back! You have won the game!");
        } else if (gameData.state === "none") {
            showMessage("Welcome to level " + gameData.level + "!");
        }
        if(!gameData.gameMode) {
            gameMode = Math.floor(Math.random() * 2) + 1;
            gameData.gameMode = gameMode;
            localStorage.setItem('gameData', JSON.stringify(gameData));
        }
        gameMode = gameData.gameMode;
    }
    if (playerData === null){
        playerData = [
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
                speed: 190
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
                speed: 215
            },
        ]
        localStorage.setItem('playerData', JSON.stringify(playerData));
    }

    addUpdatePanel();
}

function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 1);
    camera.lookAt(0, 0, 0); // Point the camera at the origin

    // Translate camera
    const translationMatrix = new THREE.Matrix4().makeTranslation(0, 1.5, 0);
    camera.applyMatrix4(translationMatrix);

    // Create renderer
    const container = document.getElementById('container');
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Controls impl
    controls = new PointerLockControls(camera, renderer.domElement);
    scene.add(controls.object);
    controls.maxPolarAngle = maxPitch;
    controls.minPolarAngle = minPitch;

    // Create light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
    directionalLight.position.set(0, 10, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    directionalLight.shadow.mapSize.width = 2048;  // Higher resolution
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Load floor texture
    const groundTexture = loadedTextures[0];
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(20, 20);

    // Ground
    const groundGeometry = new THREE.PlaneGeometry(500, 500);
    const groundMaterial = new THREE.MeshStandardMaterial({
        map: groundTexture, flatShading: true
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Rotate to make it horizontal
    ground.receiveShadow = true;
    scene.add(ground);

    // Building
    if (gameData.state !== "win") {
        if (gameMode === 1) {
            console.log("Game mode: battle");
            building = loadedModels[2];
            building.scale.set(3, 3, 3);
        } else if (gameMode === 2) {
            console.log("Game mode: cube game");
            // create a block object for building
            const geometry = new THREE.BoxGeometry(2, 2, 2);
            const material = new THREE.MeshStandardMaterial({color: 0x00ff00});
            building = new THREE.Mesh(geometry, material);
        }
        building.material.transparent = true;
        building.material.opacity = 0.7;
        building.position.set(2, 1, -4);
        building.castShadow = true;
        building.receiveShadow = true;
        obstacles.push(building);
        scene.add(building);
    }

    // Gate
    if (gameData.state === "win") {
        gate = loadedModels[3].children[0];
    } else {
        gate = loadedModels[4].children[0];
    }
    gate.scale.set(1.5, 1.5, 1.5);
    gate.position.set(-8, 1.5, 0);
    gate.castShadow = true;
    gate.receiveShadow = true;
    gate.rotation.z += Math.PI / 2;
    obstacles.push(gate);
    scene.add(gate);

    // Player
    player = loadedModels[0];
    player.scale.set(1.4, 1.4, 1.4);
    player.position.set(0, groundLevel, 1);
    player.castShadow = true;
    player.receiveShadow = true;
    scene.add(player);

    // Fence
    fence = loadedModels[1];
    fence.scale.set(1.5, 1.5, 1.5);
    let fence_0 = fence.children[0];
    let fence_1 = fence.children[1];
    fence_0.position.set(0, 0, 5);
    fence_1.position.set(-1.3, 0, 4.65);
    fence_1.rotation.y += Math.PI / 2;
    fence_0.children.forEach((child) => {
        child.castShadow = true;
        child.receiveShadow = true;
        obstacles.push(child);
    });
    fence_1.children.forEach((child) => {
        child.castShadow = true;
        child.receiveShadow = true;
        obstacles.push(child);
    });
    scene.add(fence);

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

    animate();
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
    if (gameData.state === "win") {
        target.visible = false;
        return;
    }

    target.position.copy(building.position);
    target.lookAt(player.position.x, target.position.y, player.position.z);

    // Get distance from target to player
    const distance = player.position.distanceTo(building.position);
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
function showMessage(message) {
    const messageBox = document.getElementById('messageBox');
    const messageText = document.getElementById('messageText');

    // Set the message text dynamically
    messageText.innerHTML = message;

    // Add the 'show' class to make it visible
    messageBox.classList.add('show');

    // Optional: Hide the message after a delay (e.g., 3 seconds)
    setTimeout(() => {
        messageBox.classList.remove('show');
    }, 3000);  // Message disappears after 3 seconds
}

function animate() {
    requestAnimationFrame(animate);

    handleMovement();
    handleTarget();
    handleJump();
    handleTransparency();
    const offset = new THREE.Vector3(0, 1, 3).applyQuaternion(camera.quaternion);
    camera.position.lerp(player.position.clone().add(offset), 0.3);

    renderer.render(scene, camera);
}

loadAllAssets();

// Key press event listeners
document.addEventListener('keydown', (event) => {
    keys[event.key] = true;
    if (event.key === 'r') {
        console.log("Reset game data.");
        localStorage.removeItem('gameData');
        const playerData = [
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
                speed: 190
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
                speed: 215
            },
        ]
        localStorage.setItem('playerData', JSON.stringify(playerData));
        console.log("Player data stored in localStorage: ", playerData);
    }
    if (event.key === 'f' && gameData.state === "win") {
        if (player.position.distanceTo(gate.position) <= 4){
            gameData.level += 1;
            gameData.state = "none";
            localStorage.setItem('gameData', JSON.stringify(gameData));
            window.location.reload();
        } else {
            showMessage("You are not at the gate!");
        }
    }
    if (event.key === 't') {
        console.log(player.rotation.clone())
    }
    if (event.key === 'e') {
        if (panelOpen) {
            document.getElementById("player-panel").style.display = "none";
            controls.lock();
            document.getElementById("container").style.opacity = '1';
            panelOpen = false;
        } else {
            document.getElementById("player-panel").style.display = "block";
            controls.unlock();
            document.getElementById("container").style.opacity = '0.5';
            panelOpen = true;
        }
    }
    if (event.code === 'Space' && !jumpInProgress) {
        jumpInProgress = true;
        velocity = jumpHeight;  // Initial jump force
    }
});
document.addEventListener('keyup', (event) => {
    keys[event.key] = false;
});

// Event listeners for upgrade buttons
document.getElementById("upgrade-atk").addEventListener("click", function () {
    if (gameData.score >= 10) {
        playerData[selectedPlayerIndex].atk += 10;
        gameData.score -= 10;
        updatePlayerPanel(selectedPlayerIndex);
        localStorage.setItem('playerData', JSON.stringify(playerData));
        localStorage.setItem('gameData', JSON.stringify(gameData));
        showMessage("ATK upgraded 10! Cost 10.")
    } else {
        showMessage("Not enough money!");
    }
});

document.getElementById("upgrade-def").addEventListener("click", function () {
    if (gameData.score >= 10) {
        playerData[selectedPlayerIndex].def += 20;
        gameData.score -= 10;
        updatePlayerPanel(selectedPlayerIndex);
        localStorage.setItem('playerData', JSON.stringify(playerData));
        localStorage.setItem('gameData', JSON.stringify(gameData));
        showMessage("DEF upgraded 20! Cost 10.")
    } else {
        showMessage("Not enough money!");
    }
});

document.getElementById("upgrade-hp").addEventListener("click", function () {
    if (gameData.score >= 20) {
        let percent = playerData[selectedPlayerIndex].hp / playerData[selectedPlayerIndex].maxHp;
        playerData[selectedPlayerIndex].maxHp += 100;
        playerData[selectedPlayerIndex].hp = playerData[selectedPlayerIndex].maxHp * percent;
        gameData.score -= 20;
        updatePlayerPanel(selectedPlayerIndex);
        localStorage.setItem('playerData', JSON.stringify(playerData));
        localStorage.setItem('gameData', JSON.stringify(gameData));
        showMessage("HP upgraded 100! Cost 20.")
    } else {
        showMessage("Not enough money!");
    }
});

// Mouse event handling
window.addEventListener('mousedown', onMouseDown, false);

function onMouseDown() {
    if (panelOpen) return;
    let flag = controls.isLocked;
    controls.lock();
    if (gameData.state === "win") return;

    // Get the distance from player to building
    const distance = player.position.distanceTo(building.position);

    if (distance <= 4) {
        controls.unlock();
        showMessage('You are entering combat!');
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

        animateAttack(player, building);
        setTimeout(() => {
            if(gameMode === 1)
                window.location.href = 'combat.html';
            else if (gameMode === 2) {
                gameData.param = Math.floor(Math.random() * 5) + 1;
                localStorage.setItem('gameData', JSON.stringify(gameData));
                window.location.href = 'cube.html';
            }
        }, 1000);
    } else if (flag) {
        showMessage("No enemy in sight!");
    }
}

// Handle window resizing
window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});