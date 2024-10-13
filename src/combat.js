import * as THREE from 'three';
import {Skill, Player, Enemy} from './Character.js';

// Initializing Three.js scene
const container = document.getElementById('container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xadd8e6);

// Add camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth * 0.6 / window.innerHeight, 0.1, 1000);
camera.position.set(3, 4, 7);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth * 0.6, window.innerHeight);
container.appendChild(renderer.domElement);

// Add point light
const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(5, 5, 5);
scene.add(pointLight);

// Add listener
const listener = new THREE.AudioListener();
camera.add(listener);

const audioLoader = new THREE.AudioLoader();
const sounds = [];
const soundFiles = [
    'data/sounds/Buff.mp3',
    'data/sounds/Debuff.wav',
    'data/sounds/Attack.wav'
];

// Handle window resizing
window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth * 0.6, window.innerHeight);
    camera.aspect = window.innerWidth * 0.6 / window.innerHeight;
    camera.updateProjectionMatrix();
});

// Action sequence panel
const actionContainer = document.getElementById('action-sequence');

// Function to create a card element
function createCardElement(name, value) {
    const card = document.createElement('div');
    card.className = 'card';
    if (name.includes("Enemy")) {
        card.style.backgroundColor = 'rgb(209,58,58)'
    }
    card.innerHTML = `<strong>${name}:</strong> ${value}`;
    return card;
}

function addAction(prefix, playerId, index) {
    let name = prefix + playerId;

    let existingCard = Array.from(actionContainer.children).find(card => card.innerHTML.includes(name) && card.innerHTML.includes(index));
    if (!existingCard) {
        const card = createCardElement(name, index);
        actionContainer.appendChild(card);
        card.classList.add('fade-in');
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
let skillSet = [
    new Skill("Attack", "damage", 10),
    new Skill("Heal", "heal", 1000),
    new Skill("SpeedUp", "speedUp", 20)
];
let initPlayers = [
    new Player(1, "Player 1", 90, 10000, 100, 100, 0.6, 2, 230, skillSet),
    new Player(2, "Player 2", 90, 10000, 100, 100, 0.6, 2, 190, skillSet),
    new Player(3, "Player 3", 90, 10000, 100, 100, 0.6, 2, 215, skillSet)
];
let allPlayers;
let initEnemies = [
    new Enemy(1, "Enemy 1", 90, 10000, 100, 100, 0.6, 2, 200, skillSet),
    new Enemy(2, "Enemy 2", 90, 10000, 200, 70, 0.6, 2, 230, skillSet),
];
let allEnemies;
let activePlayer;
let currentVal = 0;
let round = 0;

// For target selection
let handleClick = null;
let handleKeyDown = null;

let attackMethod = 1; // 1: atk 2: skill 3: hyperSkill
let currentTarget = null;
let currentTargetCube = null;
const indicatorGeometry = new THREE.BoxGeometry(1.1, 1.1, 1.1);
const indicatorMaterial = new THREE.MeshBasicMaterial({color: 0xffffff, wireframe: true});
let selectionIndicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
selectionIndicator.visible = false;
scene.add(selectionIndicator);
let selectorActive = false;

const playerCubes = [];
const enemyCubes = [];

// Create cubes for players and enemies
function createCubes() {
    allPlayers.forEach(player => {
        // Create a cube for each player
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({color: 0x00ff00});
        const cube = new THREE.Mesh(geometry, material);

        // Add the cube to the scene
        cube.position.set(player.id * 2 - 4, 0, 2);
        scene.add(cube);
        player.cube = cube;
        playerCubes.push(cube);
    });

    allEnemies.forEach(enemy => {
        // Create a cube for each enemy
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({color: 0xff0000});
        const cube = new THREE.Mesh(geometry, material);

        // Add the cube to the scene
        cube.position.set(enemy.id * 2 - 4, 0, -3);
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

animate();

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
            sounds.forEach(sound => {
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
        sounds.forEach(sound => {
            if (sound.name.includes("Buff.mp3"))
                sound.play();
        });
    } else {
        sounds.forEach(sound => {
            if (sound.name.includes("Debuff.wav"))
                sound.play();
        });
    }
}

// Push action queue forward by moveVal
function progressVal(moveVal) {
    document.getElementById('val-indicator').textContent = 'Current action value: ' + Math.round(currentVal);
    // console.log('Current action value: ' + currentVal);

    clearActions();
    let displayQ = new PriorityQueue();
    actionQ.elements.sort((a, b) => a.index - b.index);
    actionQ.elements.forEach(action => {
        // Move the action queue forward
        action.PlayerInfo.actionVal -= moveVal;
        action.index -= moveVal;

        displayQ.enqueue(action.index, action.PlayerInfo);

        // Show two rounds in advance
        if (action.PlayerInfo.actionVal - action.index >= action.PlayerInfo.dist / action.PlayerInfo.speed)
            displayQ.elements.push({
                index: action.index + action.PlayerInfo.dist / action.PlayerInfo.speed,
                PlayerInfo: action.PlayerInfo
            });
    });

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

// Initialize the game
function initGame() {
    // Load sounds
    soundFiles.forEach((file) => {
        const sound = new THREE.Audio(listener);
        audioLoader.load(file, function (buffer) {
            sound.setBuffer(buffer);
            sound.setLoop(false);
            sound.setVolume(1);
            sound.name = file;
            sounds.push(sound);
        });
    });

    // Clone the initial players and enemies
    allPlayers = [];
    initPlayers.forEach(player => {
        allPlayers.push(new Player(player.id, player.name, player.lv, player.hp, player.atk, player.def, player.crit_rate, player.crit_dmg, player.speed, player.skills));
    });
    allEnemies = [];
    initEnemies.forEach(enemy => {
        allEnemies.push(new Enemy(enemy.id, enemy.name, enemy.lv, enemy.hp, enemy.atk, enemy.def, enemy.crit_rate, enemy.crit_dmg, enemy.speed, enemy.skills));
    });

    // Init character cubes
    createCubes();

    // Reset the action queue
    actionQ.elements = [];

    // Reset the round
    round = 0;
    currentVal = 0;
    startRound();
}

// Start a new round
function startRound() {
    round += 1;
    document.getElementById('round-indicator').textContent = 'Round ' + round;

    // Insert players and enemies into actionQ
    allPlayers.forEach(player => {
        player.speed = initPlayers.find(initPlayer => initPlayer.id === player.id).speed;
        let info = new PlayerInfo(player.id, player.speed);
        actionQ.enqueue(info.dist / player.speed, info);
    });
    allEnemies.forEach(enemy => {
        enemy.speed = initEnemies.find(initEnemy => initEnemy.id === enemy.id).speed;
        let info = new PlayerInfo(enemy.id, enemy.speed, "enemy");
        actionQ.enqueue(info.dist / enemy.speed, info);
    });

    // Update status panel
    updateStatusPanel();

    // Calculate the first act in queue
    const moveVal = actionQ.elements[0].index;
    currentVal += moveVal;
    progressVal(moveVal);
    nextAction();
}

// Update the status panel
function updateStatusPanel() {
    document.getElementById('status-panel').innerHTML = "";
    allPlayers.forEach(player => {
        const playerStatus = document.createElement('p');
        playerStatus.innerHTML = player.name + ': ' + player.hp + ' HP<br>' + 'Speed: ' + player.speed;
        document.getElementById('status-panel').appendChild(playerStatus);
    });

    allEnemies.forEach(enemy => {
        const enemyStatus = document.createElement('p');
        enemyStatus.innerHTML = enemy.name + ': ' + enemy.hp + ' HP<br>' + 'Speed: ' + enemy.speed;
        document.getElementById('status-panel').appendChild(enemyStatus);

        const maxHp = initEnemies.find(initEnemy => initEnemy.id === enemy.id).hp;
        const hpPercentage = enemy.hp / maxHp;
        enemy.hpBar.scale.set(hpPercentage, 1, 1); // Adjust the scale to represent remaining HP
        enemy.hpBar.position.x = enemy.hpBarBg.position.x - (1 - hpPercentage) / 2; // Adjust position to keep bar aligned
    });
}

initGame();

// Target Selector
function targetSelector(targetType) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    selectionIndicator.visible = false;
    selectorActive = true;

    if(handleClick){
        window.removeEventListener('click', handleClick);
    }

    if(handleKeyDown){
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
        // Calculate mouse position in normalized device coordinates
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

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

// Logic after an action is performed
function afterAction() {
    activePlayer = null;
    updateStatusPanel();

    filterActions();
    if (allPlayers.length === 0 || allEnemies.length === 0) {
        alert("Game over!");
        initGame();
    }

    // Update action value for all players
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
    if (info.dist / info.speed <= info.actionVal)
        actionQ.enqueue(info.dist / info.speed, topPlayer.PlayerInfo);

    if (info.charType === "player") {
        console.log("Player " + info.playerId + " is acting!");
        activePlayer = allPlayers.find(player => player.id === info.playerId);

        // Auto select the target assuming an attack
        attackMethod = 1;
        stopTargetSelector();
        targetSelector('enemy');
        // Enable the buttons
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => button.disabled = false);
    } else {
        console.log("Enemy " + info.playerId + " is acting!");
        activePlayer = allEnemies.find(enemy => enemy.id === info.playerId);
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
});

const bgm = new THREE.Audio(listener);
audioLoader.load('data/sounds/Background.mp3', function (buffer) {
    bgm.setBuffer(buffer);
    bgm.setLoop(true);
    bgm.setVolume(0.3);
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
    stopTargetSelector();
    targetSelector('player');
});
