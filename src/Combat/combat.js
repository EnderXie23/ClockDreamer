import * as THREE from 'three';
import {Skill, Player, Enemy, Buff} from './Character.js';
import {MMDLoader} from "three/addons/loaders/MMDLoader.js";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {Sky} from "three/addons/objects/Sky.js";

let scene, renderer, sun, sky;
let loadedTextures = [], loadedSounds = [], loadedModels = [];
let gameData, playerData, bgm;
const audioLoader = new THREE.AudioLoader();
const listener = new THREE.AudioListener();
let automaticMusicTrigger = true;

// Function to handle swipes (drag or touch)
let startX = 0, isSwiping = false;

// Action sequence panel
const actionContainer = document.getElementById('action-sequence');

// Action sequence handling
class PlayerInfo {
    constructor(playerId, speed, charType = "player", actionVal = 100, dist = 10000) {
        this.playerId = playerId;
        this.speed = speed;
        this.charType = charType;
        this.actionVal = actionVal;
        this.dist = dist;
    }
}

class PriorityQueue {
    constructor() {
        this.elements = [];
    }

    enqueue(index, PlayerInfo) {
        this.elements.push({index, PlayerInfo});
        this.elements.sort((a, b) => a.index - b.index);
    }

    dequeue() {
        return this.elements.shift();
    }

    isEmpty() {
        return this.elements.length === 0;
    }
}

// All the global variables
const actionQ = new PriorityQueue();

// Skill sets and buffs
let skillSet = [
    new Skill("Attack", "damage", 15),
    new Skill("Heal", "heal", 1500),
    new Skill("SpeedUp", "speedUp", 20)
];

let initBuffs = [
    new Buff("IncAtk_players", "incAtk", 50, 2),
];
let allBuffs = [];

// For player and enemy initialization
let initPlayers = [
    new Player(1, "Player 1", 90, 10000, 10000, 100, 100, 0.6, 2, 230, skillSet),
    new Player(2, "Player 2", 90, 10000, 10000, 100, 100, 0.6, 2, 190, skillSet),
    new Player(3, "Player 3", 90, 10000, 10000, 100, 100, 0.6, 2, 215, skillSet)
];
let allPlayers, allEnemies, energy;
let initEnemies = [
    new Enemy(1, "Enemy 1", 90, 10000, 10000, 100, 80, 0.6, 2, 200, skillSet),
    new Enemy(2, "Enemy 2", 90, 7000, 7000, 150, 70, 0.7, 2, 190, skillSet),
    new Enemy(3, "Enemy 3", 90, 15000, 15000, 100, 100, 0.6, 1.5, 170, skillSet),
];
let actRounds = {};
let currentChoice = 0; // The player model choice

// For action controls
let activePlayer;
let currentVal = 0, round = 0;
let skillDots = 5;

// For target selection
let handleClick, handleKeyDown, handleSwipe, handleTouchEnd;
let attackMethod = 1; // 1: atk 2: skill 3: hyperSkill
let currentTarget, currentTargetCube, selectionIndicator;
let selectorActive = false;

// Player and enemy cubes
let playerCubes = [];
let enemyCubes = [];

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
                model.scale.setScalar(0.1);
                res = model;
            } else {
                res = model.scene;
                res.scale.set(1.2, 1.2, 1.2);
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
    return new Promise((resolve, reject) => {
        const gameData = JSON.parse(localStorage.getItem(key));
        if (gameData) {
            resolve(gameData);
        } else {
            console.warn('No data: ' + key + ' found in localStorage.');
            resolve(null);
        }
    });
}

function loadAllAssets() {
    const textureURLs = ['data/textures/grassy_terrain.jpg'];
    const modelURLs = ['data/models/cube_character.glb', 'data/models/cube_character2.glb','data/models/cube_character3.glb',
        "data/models/cube_monster.glb", "data/models/cube_monster2.glb", "data/models/cube_monster3.glb"];
    const dataKeys = ['gameData', 'playerData', 'modelData']
    const soundURLs = [
        'data/sounds/Buff.mp3',
        'data/sounds/Debuff.wav',
        'data/sounds/Attack.wav',
        'data/sounds/Char1-die.ogg',
        'data/sounds/Char1-hit.ogg',
        'data/sounds/Char1-skl.ogg',
        'data/sounds/Char1-hyp.ogg',
        'data/sounds/Char2-die.ogg',
        'data/sounds/Char2-hit.ogg',
        'data/sounds/Char2-skl.ogg',
        'data/sounds/Char2-hyp.ogg',
        'data/sounds/Char3-die.ogg',
        'data/sounds/Char3-hit.ogg',
        'data/sounds/Char3-skl.ogg',
        'data/sounds/Char3-hyp.ogg'
    ];

    soundURLs.forEach(url => {
        const sound = new THREE.Audio(listener);
        audioLoader.load(url, function (buffer) {
            sound.setBuffer(buffer);
            sound.setLoop(false);
            sound.setVolume(1);
            sound.name = url;
            loadedSounds.push(sound);
        });
    });
    bgm = new THREE.Audio(listener);
    audioLoader.load('data/sounds/Combat_bgm.mp3', function (buffer) {
        bgm.setBuffer(buffer);
        bgm.setLoop(true);
        bgm.setVolume(0.3);
    });

    const texturePromises = textureURLs.map(url => loadTexture(url));
    const modelPromises = modelURLs.map(url => loadModel(url));
    const gameDataPromise = dataKeys.map(key => loadGameData(key));

    Promise.all([...texturePromises, ...modelPromises, ...gameDataPromise])
        .then((results) => {
            loadedTextures = results.slice(0, texturePromises.length);
            loadedModels = results.slice(texturePromises.length, texturePromises.length + modelPromises.length);
            const loadedData = results.slice(texturePromises.length + modelPromises.length
                , texturePromises.length + modelPromises.length + dataKeys.length);
            gameData = loadedData[0];
            playerData = loadedData[1];
            if(loadedData[2]) currentChoice = loadedData[2];

            console.log('All assets loaded successfully');
            console.log('Loaded textures:', loadedTextures);
            console.log('Loaded models:', loadedModels);
            console.log('Loaded game data:', loadedData);
            console.log('Loaded sounds:', loadedSounds);

            init();

            document.getElementById('loadingScreen').style.display = 'none';
            document.getElementById('combat-ui').style.display = 'block';
        })
        .catch((error) => {
            console.error("An error occurred while loading assets:", error);
        });
}

function resolveGameData() {
    if (gameData.state !== "in game" || gameData.gameMode !== 1) {
        showMessage("Wrong game state", 1500, 2);
        setTimeout(() => {
            window.location.href = "world.html";
        }, 1000);
        return new Error("Wrong game state");
    }

    // Set difficulty level
    const level = gameData.difficulty || 1;
    initEnemies.forEach(enemy => {
        enemy.atk += 10 * level;
        enemy.def += 15 * level;
        enemy.hp += 1000 * level;
        enemy.maxHp += 1000 * level;
        enemy.speed += 10 * level;
    });
    setTimeout(() => {
        showMessage('Welcome to difficulty level ' + level);
    }, 1000);

    initPlayers = [];
    playerData.forEach(player => {
        initPlayers.push(new Player(player.id, player.name, player.lv, player.maxHp, player.hp, player.atk, player.def,
            player.crit_rate, player.crit_dmg, player.speed, skillSet));
    });
}

function init() {
    // Initializing Three.js scene
    const container = document.getElementById('container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xadd8e6);

    // Add camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth * 0.6 / window.innerHeight, 0.1, 1000);
    camera.position.set(3, 4, 7);
    camera.lookAt(0, 0, 0);

    // Set up renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth * 0.6, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Add point light
    const pointLight = new THREE.PointLight(0xffffff, 1500);
    pointLight.position.set(-5, 15, 0);
    pointLight.castShadow = true;
    scene.add(pointLight);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Add Sky
    sun = new THREE.Vector3();
    sky = new Sky();
    sky.scale.setScalar(1000);
    const skyUniforms = sky.material.uniforms;
    skyUniforms['turbidity'].value = 10;
    skyUniforms['rayleigh'].value = 1;
    skyUniforms['mieCoefficient'].value = 0.08;
    skyUniforms['mieDirectionalG'].value = 0.5;
    sun.setFromSphericalCoords(1, Math.PI/2 - 0.1, -Math.PI / 3);
    skyUniforms['sunPosition'].value.copy(sun);
    scene.add(sky);

    // Load ground texture
    const groundTexture = loadedTextures[0];
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(10, 10);

    // Create ground plane
    const groundGeometry = new THREE.PlaneGeometry(500, 500);
    const groundMaterial = new THREE.MeshStandardMaterial({
        map: groundTexture,
        flatShading: true
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.55, 0);
    ground.receiveShadow = true;
    scene.add(ground);

    // Create selection indicator
    const indicatorGeometry = new THREE.BoxGeometry(1.1, 1.1, 1.1);
    const indicatorMaterial = new THREE.MeshBasicMaterial({color: 0xffffff, wireframe: true});
    selectionIndicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    selectionIndicator.visible = false;
    scene.add(selectionIndicator);

    // Add listener
    camera.add(listener);

    resolveGameData();
    initGame();
    animate();
}

function initGame() {
    if (allPlayers)
        allPlayers.forEach(player => {
            scene.remove(player.cube);
            scene.remove(player.hpBar);
            scene.remove(player.hpBarBg);
        });
    if (allEnemies)
        allEnemies.forEach(enemy => {
            scene.remove(enemy.cube);
            scene.remove(enemy.hpBar);
            scene.remove(enemy.hpBarBg);
        });

    // Clone the initial players and enemies
    allPlayers = [];
    energy = [50];
    initPlayers.forEach(player => {
        if (player.hp <= 0) return;
        allPlayers.push(new Player(player.id, player.name, player.lv, player.maxHp, player.hp, player.atk, player.def, player.crit_rate, player.crit_dmg, player.speed, player.skills));
        energy.push(50);
    });
    allEnemies = [];
    initEnemies.forEach(enemy => {
        actRounds[enemy.id] = 0;
        allEnemies.push(new Enemy(enemy.id, enemy.name, enemy.lv, enemy.maxHp, enemy.hp, enemy.atk, enemy.def, enemy.crit_rate, enemy.crit_dmg, enemy.speed, enemy.skills));
    });

    // Clone the initial buffs
    allBuffs = [];
    initBuffs.forEach(buff => {
        if (buff.name.includes("_players")) {
            allBuffs.push(new Buff(buff.name.split("_")[0], buff.effectType, buff.value, buff.rounds, allPlayers));
        }
        if (buff.name.includes("_enemies")) {
            allBuffs.push(new Buff(buff.name.split("_")[0], buff.effectType, buff.value, buff.rounds, allEnemies));
        }
    });

    // Init character cubes
    createCubes();

    // Reset the action queue
    actionQ.elements = [];
    selectorActive = false;
    selectionIndicator.visible = false;

    // Reset the round
    round = 0;
    currentVal = 0;
    startRound();
}

// Create cubes for players and enemies
function createCubes() {
    allPlayers.forEach(player => {
        const cube = loadedModels[currentChoice].clone();

        // Add the cube to the scene
        cube.position.set(player.id * 2 - 4, 0, 3);
        cube.rotation.y += Math.PI / 2;
        cube.castShadow = true;
        cube.receiveShadow = true;
        scene.add(cube);
        player.cube = cube;
        playerCubes.push(cube);

        // Create an HP bar background for each enemy
        const hpBarBgGeometry = new THREE.PlaneGeometry(1, 0.15);
        const hpBarBgMaterial = new THREE.MeshBasicMaterial({color: 0x000000});
        const hpBarBg = new THREE.Mesh(hpBarBgGeometry, hpBarBgMaterial);

        // Position the HP bar background just above the enemy cube
        hpBarBg.position.set(cube.position.x, cube.position.y - 0.2, cube.position.z + 1);
        scene.add(hpBarBg);
        player.hpBarBg = hpBarBg;

        // Create an HP bar for each enemy
        const hpBarGeometry = new THREE.PlaneGeometry(1, 0.1);
        const hpBarMaterial = new THREE.MeshBasicMaterial({color: 0x00ff00});
        const hpBar = new THREE.Mesh(hpBarGeometry, hpBarMaterial);

        // Create a unique identifier for each HP bar
        hpBar.name = `hpBar_player_${player.id}`;

        // Position the HP bar just above the enemy cube, slightly in front of the background
        hpBar.position.set(cube.position.x, cube.position.y - 0.2, cube.position.z + 1.01);
        scene.add(hpBar);
        player.hpBar = hpBar;
    });

    allEnemies.forEach(enemy => {
        const cube = loadedModels[enemy.id + 2].clone();
        cube.scale.set(1.7, 1.7, 1.7);
        const hpbarYOffset = (enemy.id === 1) ? 0: 0.7;

        // Add the cube to the scene
        cube.position.set(enemy.id * 2 - 4, -hpbarYOffset, -3);
        cube.rotation.y -= Math.PI / 2;
        cube.castShadow = true;
        cube.receiveShadow = true;
        scene.add(cube);
        enemy.cube = cube;
        enemyCubes.push(cube);

        // Create an HP bar background for each enemy
        const hpBarBgGeometry = new THREE.PlaneGeometry(1, 0.15);
        const hpBarBgMaterial = new THREE.MeshBasicMaterial({color: 0x000000});
        const hpBarBg = new THREE.Mesh(hpBarBgGeometry, hpBarBgMaterial);

        // Position the HP bar background just above the enemy cube
        hpBarBg.position.set(cube.position.x, cube.position.y +hpbarYOffset + 1.25, cube.position.z);
        scene.add(hpBarBg);
        enemy.hpBarBg = hpBarBg;

        // Create an HP bar for each enemy
        const hpBarGeometry = new THREE.PlaneGeometry(1, 0.1);
        const hpBarMaterial = new THREE.MeshBasicMaterial({color: 0xff0000});
        const hpBar = new THREE.Mesh(hpBarGeometry, hpBarMaterial);

        // Create a unique identifier for each HP bar
        hpBar.name = `hpBar_enemy_${enemy.id}`;

        // Position the HP bar just above the enemy cube, slightly in front of the background
        hpBar.position.set(cube.position.x, cube.position.y + hpbarYOffset + 1.25, cube.position.z + 0.01);
        scene.add(hpBar);
        enemy.hpBar = hpBar;
    });
}

// Main animation loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// Smooth camera movement
function animateCameraMove(newPosition, newLookAt, newFov = 75, duration = 1) {
    // Store the initial camera position and look-at target
    const initialPosition = camera.position.clone();
    const initialLookAt = new THREE.Vector3();
    camera.getWorldDirection(initialLookAt);
    initialLookAt.add(camera.position);

    // Animate the camera's position and look-at simultaneously using GSAP
    gsap.to(initialPosition, {
        x: newPosition.x,
        y: newPosition.y,
        z: newPosition.z,
        duration: duration,
        ease: 'power2.inOut',
        onUpdate: () => {
            camera.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
        }
    });

    gsap.to(initialLookAt, {
        x: newLookAt.x,
        y: newLookAt.y,
        z: newLookAt.z,
        duration: duration,
        ease: 'power2.inOut',
        onUpdate: () => {
            camera.lookAt(initialLookAt);
        }
    });

    gsap.to(camera, {
        fov: newFov,
        duration: duration,
        ease: 'ease.inOut',
        onUpdate: () => {
            camera.updateProjectionMatrix(); // This is necessary to update the camera's projection matrix when the FOV changes
        }
    });
}

// Function to create a card element
function createCardElement(name, value) {
    const card = document.createElement('div');
    card.className = 'card';
    if (name.includes("Enemy")) {
        card.style.backgroundColor = 'rgb(209,58,58)'
    }
    card.innerHTML = `<strong>${name}:</strong> ${value}`;
    card.setAttribute('val', value);
    return card;
}

function addAction(prefix, playerId, index) {
    let name = prefix + playerId;

    let existingCard = Array.from(actionContainer.children).find(card => card.innerHTML.includes(name) && card.innerHTML.includes(index));
    if (!existingCard) {
        const card = createCardElement(name, index);
        actionContainer.appendChild(card);
        card.classList.add('fade-in');
        // Sort all cards by index
        Array.from(actionContainer.children).sort((a, b) => a.getAttribute('val') - b.getAttribute('val'))
            .forEach(card => actionContainer.appendChild(card));
    }
}

function clearActions() {
    Array.from(actionContainer.children).forEach((card) => {
        card.classList.add('fade-out');
        if (card.parentNode) {
            actionContainer.removeChild(card);
        }
    });
}

// Function to show a message
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

// Screen shaker
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

// Animate an attack
function animateAttack(attacker, target) {
    const attackerCube = attacker.cube;
    const targetCube = target.cube;

    const originalPosition = attackerCube.position.clone();
    const originalRotation = attackerCube.rotation.clone();
    const targetPosition = targetCube.position.clone();

    // Let attackerCube face the target
    const targetPos = targetCube.position.clone();
    targetPos.y = attackerCube.position.y;
    attackerCube.lookAt(targetPos);
    if(attacker instanceof Enemy) {
        attackerCube.rotation.y -= Math.PI / 2;
    } else {
        attackerCube.rotation.y += Math.PI / 2;
    }

    // Calculate the mid-point to create an arc
    const midPoint = originalPosition.clone().lerp(targetPosition, 0.5);
    midPoint.y += 3; // Raise the midpoint to create an arc effect

    // Move attacker in an arc towards target
    const attackDuration = 600;
    const returnDuration = 300;
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
            loadedSounds.forEach(sound => {
                if (sound.name.includes("Attack.wav"))
                    sound.play();
            });

            // Move back to original position after attack
            const returnStartTime = performance.now();

            function animateReturn() {
                const returnElapsedTime = performance.now() - returnStartTime;

                if (returnElapsedTime < returnDuration) {
                    // Move back to original position
                    const returnProgress = returnElapsedTime / returnDuration;
                    attackerCube.position.lerpVectors(targetPosition, originalPosition, returnProgress);
                    requestAnimationFrame(animateReturn);
                } else {
                    // Ensure the attacker is back at the original position
                    attackerCube.position.copy(originalPosition);
                    attackerCube.rotation.copy(originalRotation);
                }
            }

            // Start the return animation
            animateReturn();
        }
    }

    // Start the attack animation
    animateAttackMove();
}

// Disable / enable buttons
function toggleButtons(enabled = true) {
    if(enabled){
        setTimeout(() => {
            document.getElementById('attackButton').disabled = false;
            document.getElementById('skillButton').disabled = !(skillDots >= 1);
            // console.log(energy[activePlayer.id])
            if(activePlayer)
                document.getElementById('hyperSkillButton').disabled = !(energy[activePlayer.id] === 100);
        }, 500);
    } else {
        document.getElementById('attackButton').disabled = true;
        document.getElementById('skillButton').disabled = true;
        document.getElementById('hyperSkillButton').disabled = true;
    }
}

// Animate a boost
function animateBoostEffect(target, boost = true) {
    const ringCount = 5;
    const rings = [];

    // Create multiple rings that will rise up from the ground
    for (let i = 0; i < ringCount; i++) {
        const boostGeometry = new THREE.RingGeometry(1.2, 1.5, 32);  // Create a ring geometry
        const boostMaterial = new THREE.MeshBasicMaterial({color: 0xffff00, side: THREE.DoubleSide});  // Yellow color
        if (!boost) boostMaterial.color.setHex(0xff0000);  // Red color (for debuff effect
        const boostEffect = new THREE.Mesh(boostGeometry, boostMaterial);

        // Position each ring at ground level initially
        if (boost)
            boostEffect.position.set(target.cube.position.x, target.cube.position.y, target.cube.position.z);
        else
            boostEffect.position.set(target.cube.position.x, target.cube.position.y + 4, target.cube.position.z);
        boostEffect.rotation.x = Math.PI / 2;  // Rotate the ring to make it horizontal

        // Add the ring to the scene
        scene.add(boostEffect);
        rings.push(boostEffect);
    }

    // Animate the rings to rise up with increasing speed
    const boostDuration = boost ? 1500 : 1000;
    const startTime = performance.now();

    function animateBoost() {
        const elapsedTime = performance.now() - startTime;
        if (elapsedTime < boostDuration) {
            const progress = elapsedTime / boostDuration;
            rings.forEach((ring, index) => {
                // Move each ring upwards with increasing speed (quadratic progression)
                let speedMultiplier = 3 + index * 5; // Increase speed for higher rings
                if (boost)
                    ring.position.y = target.cube.position.y + Math.pow(progress, 2) * 5 * speedMultiplier;
                else
                    ring.position.y = target.cube.position.y + 4 - Math.pow(progress, 2) * 5 * speedMultiplier
            });
            requestAnimationFrame(animateBoost);
        } else {
            // Remove the boost effect from the scene after the animation
            rings.forEach(ring => scene.remove(ring));
        }
    }

    // Start the boost animation
    animateBoost();
    if (boost) {
        loadedSounds.forEach(sound => {
            if (sound.name.includes("Buff.mp3"))
                sound.play();
        });
    } else {
        loadedSounds.forEach(sound => {
            if (sound.name.includes("Debuff.wav"))
                sound.play();
        });
    }
}

// Push action queue forward by moveVal
function progressVal(moveVal) {
    document.getElementById('val-indicator').textContent = 'Current action value: ' + Math.round(currentVal);

    clearActions();
    let displayQ = new PriorityQueue();
    actionQ.elements.sort((a, b) => a.index - b.index);

    for (let i = 0; i < actionQ.elements.length; i++) {
        let action = actionQ.elements[i];
        // Move the action queue forward
        action.PlayerInfo.actionVal -= moveVal;
        action.index -= moveVal;

        displayQ.enqueue(action.index, action.PlayerInfo);

        if (i === 0) continue;
        // Show two rounds in advance
        if (action.PlayerInfo.actionVal - action.index >= action.PlayerInfo.dist / action.PlayerInfo.speed)
            displayQ.enqueue(action.index + action.PlayerInfo.dist / action.PlayerInfo.speed,
                action.PlayerInfo);
    }

    displayQ.elements.sort((a, b) => a.index - b.index);
    displayQ.elements.forEach(action => {
        const prefix = action.PlayerInfo.charType === "player" ? "Player " : "Enemy ";
        addAction(prefix, action.PlayerInfo.playerId, Math.round(action.index));
    });
}

// Filter illegal actions in the queue
function filterActions() {
    // Remove dead players
    allPlayers.forEach(player => {
        if (!player.isAlive) {
            loadedSounds.forEach(sound => {
                if (sound.name.includes("Char" + player.id + "-die"))
                    sound.play();
            });
            actionQ.elements.forEach(action => {
                if (action.PlayerInfo.charType === 'player' &&
                    action.PlayerInfo.playerId === player.id) {
                    action.PlayerInfo.speed = 0;
                }
            });
            scene.remove(player.cube);
            scene.remove(player.hpBar);
            scene.remove(player.hpBarBg);
        }
    });
    allPlayers = allPlayers.filter(player => player.isAlive);

    // Remove dead enemies
    allEnemies.forEach(enemy => {
        if (!enemy.isAlive) {
            actionQ.elements.forEach(action => {
                if (action.PlayerInfo.charType === 'enemy' &&
                    action.PlayerInfo.playerId === enemy.id) {
                    action.PlayerInfo.speed = 0;
                }
            });
            scene.remove(enemy.cube);
            scene.remove(enemy.hpBar);
            scene.remove(enemy.hpBarBg);
        }
    });
    allEnemies = allEnemies.filter(enemy => enemy.isAlive);

    // Remove items in actionQ that have minus speed / index not reachable
    actionQ.elements = actionQ.elements.filter(action => action.PlayerInfo.speed > 0);
    actionQ.elements = actionQ.elements.filter(action => action.index <= action.PlayerInfo.actionVal);

    // Make actionQ.elements unique
    let uniqueActions = [];
    actionQ.elements.forEach(action => {
        if (!uniqueActions.find(uniqueAction => uniqueAction.PlayerInfo.playerId === action.PlayerInfo.playerId && uniqueAction.index === action.index))
            uniqueActions.push(action);
    });
    actionQ.elements = uniqueActions;
    actionQ.elements.sort((a, b) => a.index - b.index);
    progressVal(0);
}

// Apply all the buffs
function applyBuffs() {
    allBuffs = allBuffs.filter(buff => buff.rounds > 0);
    allBuffs.forEach(buff => {
        buff.applyEffect();
    });
}

// Start a new round
function startRound() {
    round += 1;
    document.getElementById('round-indicator').textContent = 'Round ' + round;

    // Reset the status of all players and enemies
    allPlayers.forEach(player => {
        let init_player = initPlayers.find(initPlayer => initPlayer.id === player.id);
        player.atk = init_player.atk;
        player.def = init_player.def;
        player.crit_rate = init_player.crit_rate;
        player.crit_dmg = init_player.crit_dmg;
        player.speed = init_player.speed;
        let info = new PlayerInfo(player.id, player.speed);
        actionQ.enqueue(info.dist / player.speed, info);
    });
    allEnemies.forEach(enemy => {
        let init_enemy = initEnemies.find(initEnemy => initEnemy.id === enemy.id);
        enemy.atk = init_enemy.atk;
        enemy.def = init_enemy.def;
        enemy.crit_rate = init_enemy.crit_rate;
        enemy.crit_dmg = init_enemy.crit_dmg;
        enemy.speed = init_enemy.speed;
        let info = new PlayerInfo(enemy.id, enemy.speed, "enemy");
        if(round >= 4){
            enemy.atk += 30 * (round - 3);
            enemy.def += 100 * (round - 3);
            enemy.speed += 70 * (round - 3);
            animateBoostEffect(enemy, true);
        }
        actionQ.enqueue(info.dist / enemy.speed, info);
    });

    if(round >= 4)
        showMessage("The enemies are entering a frenzy!", 1500, 2);

    // Apply all the buffs
    applyBuffs();

    // Update status panel
    updateStatusPanel();
    toggleButtons(true);

    // Calculate the first act in queue
    const moveVal = actionQ.elements[0].index;
    currentVal += moveVal;
    progressVal(moveVal);
    setTimeout(() => {
        nextAction();
    }, 500);
}

// Update the hp bars and status panel
function updateStatusPanel() {
    skillDots = Math.min(skillDots, 5);
    energy = energy.map(e => Math.min(e, 100));

    for (let i = 1; i <= 5; i++) {
        const dot = document.getElementById('skill-dot-' + i);
        if(skillDots >= i)
            dot.className = 'skill-dot active';
        else
            dot.className = 'skill-dot';
    }
    if(activePlayer && allPlayers.includes(activePlayer))
        document.getElementById('energy-fill').style.width = energy[activePlayer.id] + '%';
    else
        document.getElementById('energy-fill').style.width = '0%';

    document.getElementById('status-panel').innerHTML = "";
    allPlayers.forEach(player => {
        const playerStatus = document.createElement('p');
        playerStatus.innerHTML = player.name + ': ' + player.hp + ' HP<br>' + 'Atk: ' + player.atk + '    Def: ' + player.def
            + '<br>Speed: ' + player.speed + ' Energy: ' + energy[player.id];
        document.getElementById('status-panel').appendChild(playerStatus);

        const hpPercentage = player.hp / player.maxHp;
        player.hpBar.scale.set(hpPercentage, 1, 1); // Adjust the scale to represent remaining HP
        player.hpBar.position.x = player.hpBarBg.position.x - (1 - hpPercentage) / 2; // Adjust position to keep bar aligned
    });

    allEnemies.forEach(enemy => {
        const enemyStatus = document.createElement('p');
        enemyStatus.innerHTML = enemy.name + ': ' + enemy.hp + ' HP<br>' + 'Atk: ' + enemy.atk + '    Def: ' + enemy.def + '<br>Speed: ' + enemy.speed;
        document.getElementById('status-panel').appendChild(enemyStatus);

        const hpPercentage = enemy.hp / enemy.maxHp;
        enemy.hpBar.scale.set(hpPercentage, 1, 1); // Adjust the scale to represent remaining HP
        enemy.hpBar.position.x = enemy.hpBarBg.position.x - (1 - hpPercentage) / 2; // Adjust position to keep bar aligned
    });
}

// Target Selector
function targetSelector(targetType) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    selectionIndicator.visible = false;
    selectorActive = true;

    if (handleClick) {
        window.removeEventListener('touchstart', handleClick);
        window.removeEventListener('click', handleClick);
    }

    if (handleSwipe)
        window.removeEventListener('touchmove', handleSwipe);

    if (handleTouchEnd)
        window.removeEventListener('touchend', handleTouchEnd);

    if (handleKeyDown)
        window.removeEventListener('keydown', handleKeyDown);


    handleClick = function (event) {
        if (selectorActive) {
            handleSelectionChange(event, raycaster, mouse);
            if(isMobile()) {
                startX = event.touches[0].clientX;
                isSwiping = true;
            }
        }
    }

    handleSwipe = function(event) {
        if (selectorActive) {
            if (isSwiping) {
                const moveX = event.touches[0].clientX - startX;
                if (moveX < -50) {
                    switchToAdjacentTarget(-1);
                    isSwiping = false;
                } else if (moveX > 50) {
                    switchToAdjacentTarget(1);
                    isSwiping = false;
                }
            }
        }
    }

    handleTouchEnd = function() {
        if (selectorActive) {
            isSwiping = false;
        }
    }

    handleKeyDown = function (event) {
        if (selectorActive) {
            if (event.key === 'a') {
                switchToAdjacentTarget(-1);
            } else if (event.key === 'd') {
                switchToAdjacentTarget(1);
            }
        }
    }

    window.addEventListener('click', handleClick);
    window.addEventListener('touchstart', handleClick);
    window.addEventListener('touchmove', handleSwipe);
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('keydown', handleKeyDown);

    // Set initial selection based on target type
    if (targetType === 'player' && allPlayers.length > 0) {
        if(!allPlayers.includes(currentTarget)) {
            currentTarget = allPlayers[0];
            currentTargetCube = allPlayers[0].cube;
        }
        positionSelectionIndicator(currentTargetCube);
    } else if (targetType === 'enemy' && allEnemies.length > 0) {
        if(!allEnemies.includes(currentTarget)) {
            currentTarget = allEnemies[0];
            currentTargetCube = allEnemies[0].cube;
        }
        positionSelectionIndicator(currentTargetCube);
    }

    function handleSelectionChange(event, raycaster, mouse) {
        const container = document.getElementById('container');
        const rect = container.getBoundingClientRect();

        // Calculate mouse position in normalized device coordinates
        if (isMobile()) {
            mouse.x = ((event.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.touches[0].clientY - rect.top) / rect.height) * 2 + 1;
        } else {
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        }

        // Update the raycaster with the mouse position
        raycaster.setFromCamera(mouse, camera);

        // Create an array of objects to check for intersection based on target type
        let objectsToCheck = [];
        if (targetType === 'player') {
            objectsToCheck = playerCubes;
        } else if (targetType === 'enemy') {
            objectsToCheck = enemyCubes;
        }

        // Find intersections
        const intersects = raycaster.intersectObjects(objectsToCheck);

        if (intersects.length > 0) {
            // Get the first intersected object
            const selectedObject = intersects[0].object;

            // Deselect the previous selection if it's different from the new selection
            if (currentTargetCube && currentTargetCube !== selectedObject) {
                deselectCurrentSelection();
            }

            // Set the new selection
            currentTargetCube = selectedObject;
            while(!currentTargetCube.isGroup)
                currentTargetCube = currentTargetCube.parent;

            allEnemies.forEach(enemy => {
                if (enemy.cube === currentTargetCube) {
                    currentTarget = enemy;
                }
            });
            allPlayers.forEach(player => {
                if (player.cube === currentTargetCube) {
                    currentTarget = player;
                }
            });
            positionSelectionIndicator(currentTargetCube);
        }
    }

    function switchToAdjacentTarget(direction) {
        // console.log("Switching to adjacent target for " + targetType + "!");
        let targetArray = targetType === 'player' ? allPlayers : allEnemies;
        let currentIndex = targetArray.findIndex(target => target.cube === currentTargetCube);

        if (currentIndex !== -1) {
            let newIndex = (currentIndex + direction + targetArray.length) % targetArray.length;
            currentTarget = targetArray[newIndex];
            currentTargetCube = currentTarget.cube;
            positionSelectionIndicator(currentTargetCube);
        }
    }

    function positionSelectionIndicator(selectedObject) {
        selectionIndicator.visible = true;
        selectionIndicator.position.set(selectedObject.position.x, selectedObject.position.y, selectedObject.position.z);
        if(targetType === 'enemy' && currentTarget.id !== 1) {
            selectionIndicator.position.y += 0.7;
        }
    }

    function deselectCurrentSelection() {
        if (currentTargetCube) {
            selectionIndicator.visible = false;
            currentTargetCube = null;
        }
    }
}

function stopTargetSelector() {
    selectorActive = false;
    selectionIndicator.visible = false;
}

function handleLose() {
    stopTargetSelector();
    pauseAudio();
    showMessage("You lost! Game over!", 5000, 2);
    if(camera.position.x !== 3 || camera.position.y !== 4 || camera.position.z !== 7) {
        animateCameraMove(new THREE.Vector3(3, 4, 7), new THREE.Vector3(0, 0, 0), 75, 0.1);
    }

    // Clear game data
    setTimeout(() => {
        console.log("Reset game data.");
        localStorage.clear();
        window.location.href = "index.html";
    }, 5000);
}

function handleWin() {
    stopTargetSelector();
    pauseAudio();
    showMessage("Congratulations! You won!");
    if(camera.position.x !== 3 || camera.position.y !== 4 || camera.position.z !== 7) {
        animateCameraMove(new THREE.Vector3(3, 4, 7), new THREE.Vector3(0, 0, 0), 75, 0.1);
    }

    let updateGameData = {
        level: gameData.level + 1,
        score: gameData.score + 500,
        state: "win",
    }
    localStorage.setItem('gameData', JSON.stringify(updateGameData));
    console.log("Game data update:" + JSON.stringify(updateGameData));

    // Store player data
    playerData.forEach(player => {
        player.hp = getPlayerHp(player.id);
    });
    localStorage.setItem('playerData', JSON.stringify(playerData));
    console.log("Player data update:" + JSON.stringify(playerData));
    setTimeout(() => {
        window.location.href = "world.html";
    }, 1300);

    function getPlayerHp(id) {
        let hp = 0;
        allPlayers.forEach(player => {
            if (player.id === id) {
                hp = player.hp;
            }
        });
        return hp;
    }
}

// Logic after an action is performed
function afterAction(proceed = true) {
    // Update the status panel
    updateStatusPanel();

    filterActions();
    if (allPlayers.length === 0) {
        handleLose();
        return;
    }
    if (allEnemies.length === 0) {
        handleWin();
        return;
    }

    if (!proceed) return;

    // Update action value for all players
    activePlayer = null;
    currentTarget = null;
    actionQ.dequeue();
    if (!actionQ.isEmpty()) {
        const moveVal = actionQ.elements[0].index;
        currentVal += moveVal;
        progressVal(moveVal);
        setTimeout(() => {
            nextAction();
        }, 500);
    } else {
        // Start a new round
        currentVal = 0;
        startRound();
        // console.clear();
        console.log("New round started!");
    }
}

// Handle the next action in the queue
function nextAction() {
    console.log("Current action q: ", actionQ.elements);
    console.log("Current action value: ", currentVal);

    // Get the top player in the queue
    actionQ.elements.sort((a, b) => a.index - b.index);
    const topPlayer = actionQ.elements[0];
    const info = topPlayer.PlayerInfo;

    // Check if player can perform another round
    if (info.dist / info.speed <= info.actionVal) {
        actionQ.enqueue(info.dist / info.speed, topPlayer.PlayerInfo);
        addAction(info.charType === "player" ? "Player " : "Enemy ", info.playerId, Math.round(info.dist / info.speed));
    }

    if (info.charType === "player") {
        console.log("Player " + info.playerId + " is acting!");
        activePlayer = allPlayers.find(player => player.id === info.playerId);

        // Adjust camera pos
        const playerPos = activePlayer.cube.position.clone();
        const cameraPos = playerPos.add(new THREE.Vector3((activePlayer.id - 2)*1.5, 1, 3));
        animateCameraMove(cameraPos, new THREE.Vector3(0, 0, 0), 75, 1);

        // Auto select the target assuming an attack
        updateStatusPanel();
        toggleButtons(true);
        attackMethod = 1;
        document.getElementById('attackButton').className = 'active-button';
        stopTargetSelector();
        targetSelector('enemy');
    } else {
        toggleButtons(false);
        console.log("Enemy " + info.playerId + " is acting!");
        activePlayer = allEnemies.find(enemy => enemy.id === info.playerId);
        actRounds[info.playerId] += 1;

        // Randomly select a player to attack
        const randomIndex = Math.floor(Math.random() * allPlayers.length);
        energy[randomIndex] += 10;
        currentTarget = allPlayers[randomIndex];

        if(actRounds[activePlayer.id] % 4 === 2) {
            animateCameraMove(new THREE.Vector3(3, 4, 7), new THREE.Vector3(0, 0, 0), 75, 0.3);
            enemySkill1(activePlayer);
            setTimeout(afterAction, 1100);
        } else if (actRounds[activePlayer.id] % 4 === 0) {
            enemyHyperSkill(activePlayer);
        } else {
            animateCameraMove(new THREE.Vector3(3, 4, 7), new THREE.Vector3(0, 0, 0), 75, 0.3);
            if(actRounds[activePlayer.id] % 4 === 3){
                showMessage(activePlayer.name + " is charging energy!", 1500, 2);
            }
            activePlayer.useSkill(0, allPlayers[randomIndex]);
            animateAttack(activePlayer, allPlayers[randomIndex]);
            setTimeout(afterAction, 1100);
        }
    }
}

// Skills
function enemySkill1(attacker) {
    currentTarget.onDamage(attacker, 10);
    animateAttack(attacker, currentTarget);
    allEnemies.forEach(enemy => {
        enemy.onHeal(1500);
    });

    setTimeout(() => {
        actionForward(currentTarget, -0.2);
        loadedSounds.forEach(sound => {
            if (sound.name.includes(currentTarget.id + "-hit"))
                sound.play();
        });
        const debuff = new Buff("atk_debuff", "incAtk", -50, 1, [currentTarget]);
        debuff.applyEffect();
        animateBoostEffect(currentTarget, false);
        showMessage(currentTarget.name + "'s attack decreased, action delayed!", 1500, 2);
    }, 600);
}

function enemyHyperSkill(attacker) {
    stopTargetSelector();
    toggleButtons(false);

    animateCameraMove(new THREE.Vector3(0, 5, 12), new THREE.Vector3(0, 0, 0), 75, 1.5);
    setTimeout(() => {
        animateHyperAttack(attacker);
        setTimeout(() => {
            loadedSounds.forEach(sound => {
                if (sound.name.includes("2-hit"))
                    sound.play();
            });
            showMessage("All players have been attacked and speed decreased!", 1500, 2);
            animateCameraMove(new THREE.Vector3(3, 4, 7), new THREE.Vector3(0, 0, 0), 75, 1.5);
            setTimeout(() =>{
                afterAction(false);
                nextAction();
            }, 1500);
        }, 1600);
    }, 1300);

    function animateHyperAttack(attacker) {
        const playerCube = attacker.cube;

        // Create an animation for the player attack using GSAP
        const originalPosition = playerCube.position.clone();
        const originalScale = playerCube.scale.clone();
        const enemyPosition = allPlayers[Math.floor(allPlayers.length / 2)].cube.position.clone();

        // Animation sequence: Jump up, grow, and smash into enemies
        gsap.timeline()
            .to(playerCube.position, {y: originalPosition.y + 3, duration: 0.5, ease: "power2.out"}) // Jump up
            .to(playerCube.scale, {x: 7, y: 7, z: 7, duration: 0.3, ease: "power2.out"}) // Grow
            .to(playerCube.position, {
                x: enemyPosition.x,
                y: enemyPosition.y + 6,
                z: enemyPosition.z,
                duration: 0.5,
                ease: "bounce.out",
            })
            .to(playerCube.position, {
                x: enemyPosition.x,
                y: enemyPosition.y,
                z: enemyPosition.z,
                duration: 0.5,
                ease: "bounce.out",
                onComplete: () => { // Smash down
                    // Check for collisions with enemies
                    allPlayers.forEach(enemy => {
                        enemy.onLoseHp(20 * attacker.atk);
                        if(round >= 4) {
                            setTimeout(()=>{
                                enemy.onLoseHp((round - 4) * 10 * attacker.atk);
                            }, 300);
                        }
                        speedUp(enemy, -20);
                        animateBoostEffect(enemy, false);
                    });
                    loadedSounds.forEach(sound => {
                        if (sound.name.includes("Attack.wav"))
                            sound.play();
                    });
                    afterAction(false);
                    toggleButtons(false);
                }
            })
            .to(playerCube.scale, {
                x: originalScale.x,
                y: originalScale.y,
                z: originalScale.z,
                duration: 0.3,
                ease: "power2.in"
            }) // Reset size
            .to(playerCube.position, {
                x: originalPosition.x,
                y: originalPosition.y,
                z: originalPosition.z,
                duration: 0.3,
                ease: "power2.in"
            }); // Reset position
    }
}

function skill1(attacker) {
    currentTarget.onDamage(attacker, 10);
    animateAttack(attacker, currentTarget);
    loadedSounds.forEach(sound => {
        if (sound.name.includes("Char1-skl"))
            sound.play();
    });

    setTimeout(() => {
        speedUp(currentTarget, -70);
        const debuff = new Buff("atk_debuff", "incAtk", -50, 1, [currentTarget]);
        debuff.applyEffect();
        animateBoostEffect(currentTarget, false);
        showMessage(currentTarget.name + "'s speed and attack decreased!", 1500);
        setTimeout(() => {
            afterAction();
        }, 500);
    }, 600);
}

function skill2(attacker) {
    currentTarget.onDamage(attacker, 30);
    animateAttack(attacker, currentTarget);
    loadedSounds.forEach(sound => {
        if (sound.name.includes("Char2-skl"))
            sound.play();
    });

    setTimeout(() => {
        afterAction();
    }, 1100);
}

function skill3(attacker) {
    currentTarget.onHeal(1500 + 0.1 * currentTarget.maxHp);
    setTimeout(() =>{
        allPlayers.forEach(player => {
            player.onHeal(1500);
        });
    }, 300);
    const buff = new Buff("atk_buff", "incAtk", 50, 1, [currentTarget]);
    buff.applyEffect();
    showMessage("All players healed and " + currentTarget.name + "'s attack has been increased!", 1500);
    loadedSounds.forEach(sound => {
        if (sound.name.includes("Char3-skl"))
            sound.play();
    });

    if(currentTarget.id !== attacker.id) {
        let flag = false;
        actionQ.elements.forEach(action => {
            flag |= (action.PlayerInfo.playerId === currentTarget.id) && (action.PlayerInfo.charType === "player");
        });
        if(flag)
            actionForward(currentTarget, 1);
        else {
            const info = new PlayerInfo(currentTarget.id, currentTarget.speed, "player", 100 - currentVal, 10000);
            actionQ.elements.push({index: 0, PlayerInfo: info});
        }
    }
    animateBoostEffect(currentTarget);

    setTimeout(() => {
        afterAction();
    }, 1500);
}

// Hyper attacks
function hyperSkill1(attacker) {
    stopTargetSelector();
    toggleButtons(false);
    loadedSounds.forEach(sound => {
        if (sound.name.includes("Char1-hyp"))
            sound.play();
    });

    animateCameraMove(new THREE.Vector3(0, 5, 12), new THREE.Vector3(0, 0, 0), 75, 1.5);
    setTimeout(() => {
        animateHyperAttack(attacker);
        setTimeout(() => {
            showMessage("All enemies have been attacked and speed decreased!", 1500);
            setTimeout(() =>{
                const playerPos = activePlayer.cube.position.clone();
                const cameraPos = playerPos.add(new THREE.Vector3((activePlayer.id - 2)*1.5, 1, 3));
                animateCameraMove(cameraPos, new THREE.Vector3(0, 0, 0), 75, 1);
                toggleButtons(true);
                targetSelector('enemy');
            }, 1500);
        }, 1600);
    }, 1300);

    function animateHyperAttack(attacker) {
        const playerCube = attacker.cube;

        // Create an animation for the player attack using GSAP
        const originalPosition = playerCube.position.clone();
        const originalScale = playerCube.scale.clone();
        const enemyPosition = allEnemies[Math.floor(allEnemies.length / 2)].cube.position.clone();

        // Animation sequence: Jump up, grow, and smash into enemies
        gsap.timeline()
            .to(playerCube.position, {y: originalPosition.y + 3, duration: 0.5, ease: "power2.out"}) // Jump up
            .to(playerCube.scale, {x: 7, y: 7, z: 7, duration: 0.3, ease: "power2.out"}) // Grow
            .to(playerCube.position, {
                x: enemyPosition.x,
                y: enemyPosition.y + 6,
                z: enemyPosition.z,
                duration: 0.5,
                ease: "bounce.out",
            })
            .to(playerCube.position, {
                x: enemyPosition.x,
                y: enemyPosition.y,
                z: enemyPosition.z,
                duration: 0.5,
                ease: "bounce.out",
                onComplete: () => { // Smash down
                    // Check for collisions with enemies
                    allEnemies.forEach(enemy => {
                        enemy.onLoseHp(10 * attacker.atk);
                        speedUp(enemy, -50);
                        animateBoostEffect(enemy, false);
                    });
                    loadedSounds.forEach(sound => {
                        if (sound.name.includes("Attack.wav"))
                            sound.play();
                    });
                    afterAction(false);
                    toggleButtons(false);
                }
            })
            .to(playerCube.scale, {
                x: originalScale.x,
                y: originalScale.y,
                z: originalScale.z,
                duration: 0.3,
                ease: "power2.in"
            }) // Reset size
            .to(playerCube.position, {
                x: originalPosition.x,
                y: originalPosition.y,
                z: originalPosition.z,
                duration: 0.3,
                ease: "power2.in"
            }); // Reset position
    }
}

function hyperSkill2(attacker) {
    let ammo = 3;
    stopTargetSelector();
    const goalPos = allEnemies[Math.floor(allEnemies.length / 2)].cube.position.clone();
    animateCameraMove(attacker.cube.position.clone().add(new THREE.Vector3(0, 0, -0.5)), goalPos, 100, 1.5);
    toggleButtons(false);
    stopTargetSelector();
    toggleButtons(false);

    setTimeout(() => {
        targetSelector('enemy');
        showMessage("You have " + ammo + " ammos left!", 1000);

        document.getElementById('ActButton').style.display = 'block';
        document.getElementById('ActButton').className = 'active-button';
        document.getElementById('ActButton').addEventListener('click', onClick);
    }, 1500);

    function onClick() {
        if(ammo <= 0) return;
        ammo -= 1;
        // Create an ammo cube
        const ammoGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const ammoMaterial = new THREE.MeshBasicMaterial({color: 0xff0000});
        const ammoCube = new THREE.Mesh(ammoGeometry, ammoMaterial);
        ammoCube.position.set(attacker.cube.position.x, attacker.cube.position.y, attacker.cube.position.z);
        scene.add(ammoCube);

        // Animate the ammo cube to the target
        const goalPos = currentTarget.cube.position.clone();
        gsap.to(ammoCube.position, {
            x: goalPos.x,
            y: goalPos.y,
            z: goalPos.z,
            duration: 0.3,
            ease: 'power1.out',
            onComplete: () => {
                // Check for collisions with enemies
                currentTarget.onDamage(attacker, 12 * (3 - ammo));
                loadedSounds.forEach(sound => {
                    if (sound.name.includes("Attack.wav"))
                        sound.play();
                });
                shakeScreen(0.3, 300);
                afterAction(false);
                toggleButtons(false);
                scene.remove(ammoCube);
                if (ammo === 0) {
                    loadedSounds.forEach(sound => {
                        if (sound.name.includes("Char2-hyp"))
                            sound.play();
                    });

                    stopTargetSelector();
                    document.getElementById('ActButton').style.display = 'none';
                    document.getElementById('ActButton').removeEventListener('click', onClick);
                    animateCameraMove(new THREE.Vector3(3, 4, 7), new THREE.Vector3(0, 0, 0), 75, 1.5);
                    setTimeout(() => {
                        targetSelector('enemy');
                        toggleButtons(true);
                    }, 1500);
                } else {
                    stopTargetSelector();
                    targetSelector('enemy');
                    showMessage("You have " + ammo + " ammos left!");
                }
            }
        });
    }
}

function hyperSkill3() {
    stopTargetSelector();
    toggleButtons(false);
    camera.position.set(2, 1, -1);
    camera.lookAt(1.5, 1, 0);
    animateCameraMove(new THREE.Vector3(-2, 1, -2), new THREE.Vector3(-1, 1, 0), 100, 2.5);
    loadedSounds.forEach(sound => {
        if (sound.name.includes("Char3-hyp"))
            sound.play();
    });

    setTimeout(() => {
        allPlayers.forEach(player => {
            speedUp(player, 20);
            actionForward(player, 0.45);
            animateBoostEffect(player);
            player.onHeal(0.1 * player.maxHp);
            showMessage("All players have been speed up and healed!", 1500);
        });
        console.log("Speed up and forward action!");
        const ultraBuff = new Buff("Ultra", "incAtk", 100, 1, allPlayers);
        ultraBuff.applyEffect();
        skillDots += 2;
        updateStatusPanel();
        setTimeout(() => {
            camera.position.set(0, 3, 5);
            camera.lookAt(0, 2, 0);
            animateCameraMove(new THREE.Vector3(3, 4, 7), new THREE.Vector3(0, 0, 0), 75, 1.5);
            setTimeout(() => {
                toggleButtons(true);
                targetSelector('enemy');
            }, 1500);
        }, 1000);
    }, 2500);
}

// Speed up all players by val
function speedUp(target, val) {
    target.speed += val;
    target.speed = Math.max(target.speed, 1);

    actionQ.elements.forEach(action => {
        if ((action.PlayerInfo.charType === "player" && target instanceof Player)
            || (action.PlayerInfo.charType === "enemy" && target instanceof Enemy)) {
            if (action.PlayerInfo.playerId === target.id) {
                action.index = action.index * action.PlayerInfo.speed / Math.max(action.PlayerInfo.speed + val, 1);
                action.PlayerInfo.speed += val;
            }
        }
    });

    // Filter actions in case of minus speed-up
    filterActions();
}

// Forward all actions by val percentage
function actionForward(target, val) {
    let once = true;
    // All the action dist decrease by val
    actionQ.elements.forEach(action => {
        if ((action.PlayerInfo.charType === "player" && target instanceof Player)
            || (action.PlayerInfo.charType === "enemy" && target instanceof Enemy)) {
            if (action.PlayerInfo.playerId === target.id && once) {
                action.index -= (action.PlayerInfo.dist * val) / action.PlayerInfo.speed;
                action.index = Math.max(action.index, 0);
                once = false;
            }
        }
    });

    // Filter actions in case of minus forward
    filterActions();
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

// Handle window resizing
window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth * 0.6, window.innerHeight);
    camera.aspect = window.innerWidth * 0.6 / window.innerHeight;
    camera.updateProjectionMatrix();
});

// Automatic BGM play
document.addEventListener('click', function () {
    if (automaticMusicTrigger){
        bgm.play();
        document.getElementById('musicButton').innerHTML = "Pause Music";
        document.removeEventListener('click', this);
        automaticMusicTrigger = false;
        showMessage("Music is playing! Click the pause music button to pause it.", 3000);
    }
});

// Button logic
document.getElementById('attackButton').addEventListener('click', function onClick() {
    if (attackMethod === 1) {
        skillDots++;
        energy[activePlayer.id] += 20;
        document.getElementById('attackButton').className = 'menu-button';
        toggleButtons(false);
        stopTargetSelector();

        activePlayer.useSkill(0, currentTarget);
        animateAttack(activePlayer, currentTarget);
        setTimeout(() => {
            afterAction();
        }, 1100);
    } else {
        stopTargetSelector();
        attackMethod = 1;
        document.getElementById('attackButton').className = 'active-button';
        document.getElementById('skillButton').className = 'menu-button';
        document.getElementById('hyperSkillButton').className = 'menu-button';
        targetSelector('enemy');
        if(activePlayer.id === 3){
            const playerPos = activePlayer.cube.position.clone();
            const cameraPos = playerPos.add(new THREE.Vector3((activePlayer.id - 2)*1.5, 1, 3));
            animateCameraMove(cameraPos, new THREE.Vector3(0, 0, 0), 75, 1);
        }
    }
});
document.getElementById('skillButton').addEventListener('click', function onClick() {
    const skillTarget = (activePlayer.id === 3) ? 'player' : 'enemy';

    if (attackMethod === 2) {
        skillDots--;
        energy[activePlayer.id] += 30;
        document.getElementById('skillButton').className = 'menu-button';
        toggleButtons(false);
        stopTargetSelector();

        switch (activePlayer.id) {
            case 1:
                skill1(activePlayer);
                break;
            case 2:
                skill2(activePlayer);
                break;
            case 3:
                skill3(activePlayer);
                break;
        }
    } else {
        switch (activePlayer.id) {
            case 1:
                showMessage("Skill 1: deal damage and debuff the enemy!", 2000);
                break;
            case 2:
                showMessage("Skill 2: deal great damage to the enemy!", 2000);

                break;
            case 3:
                showMessage("Skill 3: heal target and act immediately!", 2000);
                animateCameraMove(new THREE.Vector3(3, 4, 7), new THREE.Vector3(0, 0, 0), 75, 0.5);
                break;
        }

        stopTargetSelector();
        attackMethod = 2;
        document.getElementById('attackButton').className = 'menu-button';
        document.getElementById('skillButton').className = 'active-button';
        document.getElementById('hyperSkillButton').className = 'menu-button';
        targetSelector(skillTarget);
    }
});
document.getElementById('hyperSkillButton').addEventListener('click', function onClick() {
    if (attackMethod === 3){
        document.getElementById('hyperSkillButton').className = 'menu-button';
        toggleButtons(false);
        stopTargetSelector();
        energy[activePlayer.id] = 0;

        switch (activePlayer.id) {
            case 1:
                hyperSkill1(activePlayer);
                break;
            case 2:
                hyperSkill2(activePlayer);
                break;
            case 3:
                hyperSkill3();
                break;
        }

    } else {
        attackMethod = 3;
        stopTargetSelector();
        switch (activePlayer.id) {
            case 1:
                showMessage("Hyper Skill 1: deal damage and speed down all enemies!", 2000);
                break;
            case 2:
                showMessage("Hyper Skill 2: shoot 3 ammos to target enemies!", 2000);
                break;
            case 3:
                animateCameraMove(new THREE.Vector3(3, 4, 7), new THREE.Vector3(0, 0, 0), 75, 0.5);
                showMessage("Hyper Skill 3: speed up all players and buff their attack!", 2000);
                break;
        }
        document.getElementById('attackButton').className = 'menu-button';
        document.getElementById('skillButton').className = 'menu-button';
        document.getElementById('hyperSkillButton').className = 'active-button';
    }
});

document.getElementById('musicButton').addEventListener('click', function onClick() {
    // Check the inner html of the button
    if (document.getElementById('musicButton').innerHTML === "Play Music") {
        bgm.play();
        document.getElementById('musicButton').innerHTML = "Pause Music";
    } else {
        // bgm.pause();
        pauseAudio();
        document.getElementById('musicButton').innerHTML = "Play Music";
    }
});

document.getElementById('TestButton').addEventListener('click', function onClick() {
    showTutorial();
});

// Tutorial
const tutorialCanvas = document.getElementById("tutorial-canvas");
const tutorialContainer = document.getElementById("tutorial-container");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const closeBtn = document.getElementById("close-btn");

const tutorialText = document.getElementById("tutorial-text");
const tutorialImage = document.getElementById("tutorial-image");
const dotIndicator = document.getElementById("dot-indicator");

let currentPage = 0;
const totalPages = 5; // Adjust this based on the number of tutorial steps

// Tutorial Data (You can add more steps as needed)
const tutorialData = [
    {
        image: "data/tutorial/combat/actseq.png",
        text: "The skill information: \n" +
            "Player 1: Skill: Deal damage, decrease speed of enemy by 70. Hyper Skill: Deal damage and speed down all enemies by 50.\n" +
            "Player 2: Skill: Deal great damage to the enemy. Hyper Skill: Shoot 3 ammos to target enemies, power increasing each time.\n" +
            "Player 3: Skill: Heal target and let it act immediately. Then heal all players. Hyper Skill: Heal and speed up all players, increase attack, restore 2 skill-dots.\n"
    },
    {
        image: "data/tutorial/combat/actseq.png",
        text: "The action sequence is shown on the left. The player with the lowest action value will act first.\n" +
            "The action value depends on the speed of the player. The higher the speed, the faster the player will act.\n" +
            "Each round has action value of 100. When it is used up, the next round will start.\n"
    },
    {
        image: "data/tutorial/combat/player.png",
        text: "The players and enemies stand in two rows. The players are on the left, and the enemies are on the right.\n" +
            "When it's the player's turn, you can select an enemy to attack. When it's the enemy's turn, they will attack a random player.\n" +
            "You can select a target by clicking on them or using the arrow keys / swipe gestures.\n"
    },
    {
        image: "data/tutorial/combat/actions.png",
        text: "When it's your turn, you can choose to attack or use a skill. Each player has a unique skill with unique effects.\n" +
            "You can check out the skills by clicking on the corresponding buttons.\n" +
            "You will need skill-dots to use skills. You can gain skill-dots by using normal attacks.\n" +
            "When your energy is full, use hyper skills, which are powerful abilities that do NOT cost your round.\n" +
            "Try to defeat all the enemies before they defeat you!"
    },
    {
        image: "data/tutorial/combat/status.png",
        text: "Remember to keep an eye on your player's status. If their HP drops to 0, they will be defeated.\n" +
            "Also, it's a good idea to watch out for the speed of you and your enemies. Speed can make a big difference in battle!"
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