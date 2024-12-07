import * as THREE from 'three';
// import
import {Skill, Player, Enemy, Buff} from './Character.js';
import {MMDLoader} from "three/addons/loaders/MMDLoader.js";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";

let scene, camera, renderer;
let loadedTextures = [], loadedSounds = [], loadedModels = [];
let gameData, playerData, bgm;
const audioLoader = new THREE.AudioLoader();
const listener = new THREE.AudioListener();

// Action sequence panel
const actionContainer = document.getElementById('action-sequence');

// Action sequence handling
class PlayerInfo {
    constructor(playerId, speed, charType = "player") {
        this.playerId = playerId;
        this.speed = speed;
        this.actionVal = 100;
        this.dist = 10000;
        this.charType = charType;
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
let allPlayers;
let initEnemies = [
    new Enemy(1, "Enemy 1", 90, 10000, 10000, 100, 100, 0.6, 2, 200, skillSet),
    new Enemy(2, "Enemy 2", 90, 10000, 10000, 150, 70, 0.7, 2, 170, skillSet),
];
let allEnemies;

// For action controls
let activePlayer;
let currentVal = 0;
let round = 0;

// For target selection
let handleClick, handleKeyDown;
let attackMethod = 1; // 1: atk 2: skill 3: hyperSkill
let currentTarget, currentTargetCube;
let selectionIndicator;
let selectorActive = false;

// Player and enemy cubes
let playerCubes = [];
let enemyCubes = [];

// For the camera animation
let animationProgress = 0;
let spinCenter, spinLookAt, cameraPos;
let spinDegree = Math.PI / 2;
let translateDir = new THREE.Vector3(0.1, 0, 0.1);

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
            }else {
                model.scene.children[0].scale.set(1.2, 1.2, 1.2);
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
    return new Promise((resolve, reject) => {
        const gameData = JSON.parse(localStorage.getItem(key));
        if (gameData) {
            resolve(gameData);
        } else {
            console.warn('No data: ' + key + ' found in localStorage.');
            // resolve({});
            reject();
        }
    });
}

function loadAllAssets() {
    const textureURLs = ['data/textures/grassy_terrain.jpg'];
    const modelURLs = ['data/models/cube_character.glb', "data/models/cube_monster.glb"];
    const dataKeys = ['gameData', 'playerData']
    const soundURLs = [
        'data/sounds/Buff.mp3',
        'data/sounds/Debuff.wav',
        'data/sounds/Attack.wav'
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
    audioLoader.load('data/sounds/Background.mp3', function (buffer) {
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
    if (gameData.state !== "in game" || gameData.gameMode !== 1){
        showMessage("Wrong game state", 2);
        setTimeout(()=>{
            window.location.href = "path.html";
        }, 1000);
        return new Error("Wrong game state");
    }

    // Set difficulty level
    const level = gameData.difficulty || 1;
    initEnemies.forEach(enemy => {
        enemy.atk += 10 * level;
        enemy.def += 10 * level;
        enemy.hp += 1000 * level;
        enemy.maxHp += 1000 * level;
        enemy.speed += 10 * level;
    });
    showMessage('Welcome to difficulty level ' + level);

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

    // Load ground texture
    const groundTexture = loadedTextures[0];
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(2, 2);

    // Create ground plane
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
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
    animate();
    initGame();
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
    initPlayers.forEach(player => {
        if(player.hp <= 0) return;
        allPlayers.push(new Player(player.id, player.name, player.lv, player.maxHp, player.hp, player.atk, player.def, player.crit_rate, player.crit_dmg, player.speed, player.skills));
    });
    allEnemies = [];
    initEnemies.forEach(enemy => {
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
        // Create a cube for each player
        // const geometry = new THREE.BoxGeometry(1, 1, 1);
        // const material = new THREE.MeshStandardMaterial({color: 0x00ff00});
        // const cube = new THREE.Mesh(geometry, material);
        const cube = loadedModels[0].clone();

        // Add the cube to the scene
        cube.position.set(player.id * 2 - 4, 0, 2);
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
        // Create a cube for each enemy
        // const geometry = new THREE.BoxGeometry(1, 1, 1);
        // const material = new THREE.MeshStandardMaterial({color: 0xff0000});
        // const cube = new THREE.Mesh(geometry, material);
        const cube = loadedModels[1].clone();
        cube.scale.set(1.7, 1.7, 1.7);

        // Add the cube to the scene
        cube.position.set(enemy.id * 2 - 4, 0, -3);
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
        hpBarBg.position.set(cube.position.x, cube.position.y + 1.25, cube.position.z);
        scene.add(hpBarBg);
        enemy.hpBarBg = hpBarBg;

        // Create an HP bar for each enemy
        const hpBarGeometry = new THREE.PlaneGeometry(1, 0.1);
        const hpBarMaterial = new THREE.MeshBasicMaterial({color: 0xff0000});
        const hpBar = new THREE.Mesh(hpBarGeometry, hpBarMaterial);

        // Create a unique identifier for each HP bar
        hpBar.name = `hpBar_enemy_${enemy.id}`;

        // Position the HP bar just above the enemy cube, slightly in front of the background
        hpBar.position.set(cube.position.x, cube.position.y + 1.25, cube.position.z + 0.01);
        scene.add(hpBar);
        enemy.hpBar = hpBar;
    });
}

// Main animation loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// Easing function for spin speed
function easeInOut(t) {
    return t < 0.5 ? 0.8 * (2 * t * t) + 0.1 * t : 0.8 * (-1 + (4 - 2 * t) * t) + 0.1 * t;
}

// Camera spin animations
function animateCameraSpin() {
    const reversed = spinDegree < 0;
    const radius = Math.sqrt(Math.pow(cameraPos.x - spinCenter.x, 2) + Math.pow(cameraPos.z - spinCenter.z, 2));
    const initProgress = Math.atan2(cameraPos.z - spinCenter.z, cameraPos.x - spinCenter.x);

    // Adjust spin speed using easing function
    const easedProgress = easeInOut(animationProgress / Math.abs(spinDegree));
    animationProgress += 0.02 * (1 - easedProgress); // Slow start and end, faster in the middle

    if (animationProgress > Math.abs(spinDegree) - 0.05) {
        // console.log("Animation complete!");
        animationProgress = 0;
        return;
    }

    // Calculate the new camera position along a circular path
    const x = radius * Math.cos(initProgress + (reversed ? -1 : 1) * animationProgress);
    const z = radius * Math.sin(initProgress + (reversed ? -1 : 1) * animationProgress);
    camera.position.set(x, spinCenter.y, z);

    // Keep looking at the center of the scene
    camera.lookAt(spinLookAt);

    // Render the scene
    renderer.render(scene, camera);
    requestAnimationFrame(animateCameraSpin);
}

// Function to animate camera translation
function animateCameraTranslation() {
    let translationProgress = 0;

    function translateCamera() {
        // Update the progress (range from 0 to 1)
        translationProgress += 0.01;
        if (translationProgress > 1) {
            translationProgress = 0;
            return;
        }

        // Adjust translation speed using easing function
        const easedProgress = easeInOut(translationProgress);

        // Lerp (linear interpolate) the camera position from start to end
        const targetPos = camera.position.clone().add(translateDir);
        camera.position.lerp(targetPos, easedProgress);

        // Keep looking at the center of the scene
        camera.lookAt(0, 0, 0);

        // Render the scene
        renderer.render(scene, camera);
        requestAnimationFrame(translateCamera);
    }

    translateCamera();
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
    const targetPosition = targetCube.position.clone();

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
                }
            }

            // Start the return animation
            animateReturn();
        }
    }

    // Start the attack animation
    animateAttackMove();
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

// Animate a hyper attack
function hyperAttack(attacker) {
    stopTargetSelector();
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => button.disabled = true);

    spinCenter = new THREE.Vector3(0, 4, 0);
    spinLookAt = new THREE.Vector3(0, 0, 0);
    cameraPos = camera.position.clone();
    const startPos = camera.position.clone();
    spinDegree = Math.PI / 8;
    animateCameraSpin();
    setTimeout(() => {
        translateDir = new THREE.Vector3(0, 0, 0.1);
        animateCameraTranslation();
        setTimeout(() => {
            animateHyperAttack(attacker);
            setTimeout(() => {
                translateDir = new THREE.Vector3(0, 0, -0.1);
                animateCameraTranslation();
                setTimeout(() => {
                    cameraPos = camera.position.clone();
                    spinDegree = -Math.PI / 8;
                    animateCameraSpin();
                    setTimeout(() => {
                        camera.position.set(startPos.x, startPos.y, startPos.z);
                        targetSelector('enemy');
                        afterAction(false);
                    }, 1200);
                }, 1900);
            }, 1600);
        }, 700);
    }, 1100);
}

function animateHyperAttack(attacker) {
    const playerCube = attacker.cube;

    // Create an animation for the player attack using GSAP
    const originalPosition = playerCube.position.clone();
    const originalScale = playerCube.scale.clone();
    const enemyPosition = allEnemies[Math.floor(allEnemies.length / 2)].cube.position.clone();

    // Animation sequence: Jump up, grow, and smash into enemies
    gsap.timeline()
        .to(playerCube.position, {y: originalPosition.y + 3, duration: 0.5, ease: "power2.out"}) // Jump up
        .to(playerCube.scale, {x: 5, y: 5, z: 5, duration: 0.3, ease: "power2.out"}) // Grow
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
                    enemy.onLoseHp(3000);
                });
                loadedSounds.forEach(sound => {
                    if (sound.name.includes("Attack.wav"))
                        sound.play();
                });
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
        actionQ.enqueue(info.dist / enemy.speed, info);
    });

    // Apply all the buffs
    applyBuffs();

    // Update status panel
    updateStatusPanel();

    // Calculate the first act in queue
    const moveVal = actionQ.elements[0].index;
    currentVal += moveVal;
    progressVal(moveVal);
    nextAction();
}

// Update the hp bars and status panel
function updateStatusPanel() {
    document.getElementById('status-panel').innerHTML = "";
    allPlayers.forEach(player => {
        const playerStatus = document.createElement('p');
        playerStatus.innerHTML = player.name + ': ' + player.hp + ' HP<br>' + 'Atk: ' + player.atk + '    Def: ' + player.def + '<br>Speed: ' + player.speed;
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

    if (handleKeyDown) {
        window.removeEventListener('keydown', handleKeyDown);
    }

    handleClick = function (event) {
        if (selectorActive) {
            handleSelectionChange(event, raycaster, mouse);
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
    window.addEventListener('keydown', handleKeyDown);

    // Set initial selection based on target type
    if (targetType === 'player' && allPlayers.length > 0) {
        currentTarget = allPlayers[0];
        currentTargetCube = allPlayers[0].cube;
        positionSelectionIndicator(currentTargetCube);
    } else if (targetType === 'enemy' && allEnemies.length > 0) {
        currentTarget = allEnemies[0];
        currentTargetCube = allEnemies[0].cube;
        positionSelectionIndicator(currentTargetCube);
    }

    function handleSelectionChange(event, raycaster, mouse) {
        const container = document.getElementById('container');
        const rect = container.getBoundingClientRect();

        // Calculate mouse position in normalized device coordinates
        if(isMobile()){
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
            positionSelectionIndicator(currentTargetCube);
            allEnemies.forEach(enemy => {
                if (enemy.cube === selectedObject) {
                    currentTarget = enemy;
                }
            });
            allPlayers.forEach(player => {
                if (player.cube === selectedObject) {
                    currentTarget = player;
                }
            });
        }
    }

    function switchToAdjacentTarget(direction) {
        console.log("Switching to adjacent target for " + targetType + "!");
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

function handleWin(){
    let updateGameData = {
        level: gameData.level,
        score: gameData.score + 500,
        state: "win",
    }
    localStorage.setItem('gameData', JSON.stringify(updateGameData));
    console.log("Game data update:" + JSON.stringify(updateGameData));

    // Store player data
    playerData.forEach(player=>{
        player.hp = getPlayerHp(player.id);
    });
    localStorage.setItem('playerData', JSON.stringify(playerData));
    console.log("Player data update:" + JSON.stringify(playerData));
    setTimeout(() => {
        window.location.href = "world.html";
    }, 1000);

    function getPlayerHp(id){
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
    // Enable the buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => button.disabled = false);

    updateStatusPanel();

    filterActions();
    if (allPlayers.length === 0) {
        stopTargetSelector();
        showMessage("You lost! Game over!");
    }
    if (allEnemies.length === 0) {
        stopTargetSelector();
        showMessage("You won! Game over!");
        handleWin();
    }

    if (!proceed) return;

    // Update action value for all players
    activePlayer = null;
    actionQ.dequeue();
    if (!actionQ.isEmpty()) {
        const moveVal = actionQ.elements[0].index;
        currentVal += moveVal;
        progressVal(moveVal);
        nextAction();
    } else {
        // Start a new round
        currentVal = 0;
        startRound();
        console.clear();
        console.log("New round started!");
    }
}

// Handle the next action in the queue
function nextAction() {
    // Get the top player in the queue
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

        // Auto select the target assuming an attack
        attackMethod = 1;
        stopTargetSelector();
        targetSelector('enemy');
    } else {
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => button.disabled = true);
        console.log("Enemy " + info.playerId + " is acting!");
        activePlayer = allEnemies.find(enemy => enemy.id === info.playerId);

        // Randomly select a player to attack
        const randomIndex = Math.floor(Math.random() * allPlayers.length);
        activePlayer.useSkill(0, allPlayers[randomIndex]);
        animateAttack(activePlayer, allPlayers[randomIndex]);
        setTimeout(afterAction, 1100);
    }
}

// Speed up all players by val
function speedUp(target, val) {
    target.speed += val;

    actionQ.elements.forEach(action => {
        if ((action.PlayerInfo.charType === "player" && target instanceof Player)
            || (action.PlayerInfo.charType === "enemy" && target instanceof Enemy)) {
            if (action.PlayerInfo.playerId === target.id) {
                action.index = action.index * action.PlayerInfo.speed / (action.PlayerInfo.speed + val);
                action.PlayerInfo.speed += val;
            }
        }
    });

    // Filter actions in case of minus speed-up
    filterActions();
}

// Forward all actions by val percentage
function actionForward(target, val) {
    // All the action dist decrease by val
    actionQ.elements.forEach(action => {
        if ((action.PlayerInfo.charType === "player" && target instanceof Player)
            || (action.PlayerInfo.charType === "enemy" && target instanceof Enemy)) {
            if (action.PlayerInfo.playerId === target.id) {
                action.index -= (action.PlayerInfo.dist * val) / action.PlayerInfo.speed;
                action.index = Math.max(action.index, 0);
            }
        }
    });

    // Filter actions in case of minus forward
    filterActions();
}

loadAllAssets();

// Handle window resizing
window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth * 0.6, window.innerHeight);
    camera.aspect = window.innerWidth * 0.6 / window.innerHeight;
    camera.updateProjectionMatrix();
});

// Button logic
document.getElementById('attackButton').addEventListener('click', function onClick() {
    if (attackMethod === 1) {
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => button.disabled = true);
        stopTargetSelector();

        activePlayer.useSkill(0, currentTarget);
        animateAttack(activePlayer, currentTarget);
        setTimeout(() => {
            afterAction();
        }, 1100);
    } else {
        stopTargetSelector();
        attackMethod = 1;
        targetSelector('enemy');
    }
});
document.getElementById('skillButton').addEventListener('click', function onClick() {
    if (attackMethod === 2) {
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => button.disabled = true);
        stopTargetSelector();

        activePlayer.useSkill(1, currentTarget);
        animateBoostEffect(currentTarget);
        setTimeout(() => {
            afterAction();
        }, 1500);
    } else {
        stopTargetSelector();
        attackMethod = 2;
        targetSelector('player');
    }
});
document.getElementById('hyperSkillButton').addEventListener('click', function onClick() {
    allPlayers.forEach(player => {
        speedUp(player, 20);
        actionForward(player, 0.45);
    });
    allPlayers.forEach(player => {
        animateBoostEffect(player);
    });
    updateStatusPanel();
    console.log("Speed up and forward action!");
    const ultraBuff = new Buff("Ultra", "incAtk", 100, 1, allPlayers);
    ultraBuff.applyEffect();
    updateStatusPanel();
});

document.getElementById('musicButton').addEventListener('click', function onClick() {
    // Check the inner html of the button
    if (document.getElementById('musicButton').innerHTML === "Play Music") {
        bgm.play();
        document.getElementById('musicButton').innerHTML = "Pause Music";
    } else {
        bgm.pause();
        document.getElementById('musicButton').innerHTML = "Play Music";
    }
});

document.getElementById('TestButton').addEventListener('click', function onClick() {
    hyperAttack(activePlayer);
    // initGame();
    // actionForward(allPlayers[0], 1);
});

let isMobile = () => {
    const isMobile = ('ontouchstart' in document.documentElement || navigator.userAgent.match(/Mobi/) || navigator.userAgentData.mobile);
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