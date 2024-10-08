import * as THREE from 'three';
import {Skill, Player, Enemy} from './Character.js';

// Initializing Three.js scene
const container = document.getElementById('container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xadd8e6);

// Add camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth * 0.6 / window.innerHeight, 0.1, 1000);
camera.position.set(4, 6, 6);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth * 0.6, window.innerHeight);
container.appendChild(renderer.domElement);

// Add point light
const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(5, 5, 5);
scene.add(pointLight);

// Handle window resizing
window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth * 0.6, window.innerHeight);
    camera.aspect = window.innerWidth * 0.6 / window.innerHeight;
    camera.updateProjectionMatrix();
});

// Action sequence and button handling
const actionSequence = document.getElementById('action-sequence');

function addAction(content) {
    const action = document.createElement('p');
    action.innerHTML = content;
    actionSequence.appendChild(action);
    actionSequence.scrollTop = actionSequence.scrollHeight; // Auto scroll
}

function clearActions() {
    actionSequence.innerHTML = "";
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
];
let allEnemies;
let activePlayer;
let currentVal = 0;
let round = 0;

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
    });
}

// Main animation loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

animate();

// Screen shaker
function shakeScreen(intensity = 0.1, duration = 500) {
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
            // Start shaking the screen after reaching the target
            shakeScreen(0.2, 200);

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
function animateBoostEffect(player) {
    const ringCount = 5;
    const rings = [];

    // Create multiple rings that will rise up from the ground
    for (let i = 0; i < ringCount; i++) {
        const boostGeometry = new THREE.RingGeometry(1.2, 1.5, 32);  // Create a ring geometry
        const boostMaterial = new THREE.MeshBasicMaterial({color: 0xffff00, side: THREE.DoubleSide});  // Yellow color
        const boostEffect = new THREE.Mesh(boostGeometry, boostMaterial);

        // Position each ring at ground level initially
        boostEffect.position.set(player.cube.position.x, player.cube.position.y, player.cube.position.z);
        boostEffect.rotation.x = Math.PI / 2;  // Rotate the ring to make it horizontal

        // Add the ring to the scene
        scene.add(boostEffect);
        rings.push(boostEffect);
    }

    // Animate the rings to rise up with increasing speed
    const boostDuration = 1500; // Effect lasts for 2 seconds
    const startTime = performance.now();

    function animateBoost() {
        const elapsedTime = performance.now() - startTime;
        if (elapsedTime < boostDuration) {
            const progress = elapsedTime / boostDuration;
            rings.forEach((ring, index) => {
                // Move each ring upwards with increasing speed (quadratic progression)
                const speedMultiplier = 3 + index * 5; // Increase speed for higher rings
                ring.position.y = player.cube.position.y + Math.pow(progress, 2) * 5 * speedMultiplier;
            });
            requestAnimationFrame(animateBoost);
        } else {
            // Remove the boost effect from the scene after the animation
            rings.forEach(ring => scene.remove(ring));
        }
    }

    // Start the boost animation
    animateBoost();
}

document.getElementById('TestButton').addEventListener('click', function onClick() {
    animateBoostEffect(allPlayers[0]);
    animateBoostEffect(allPlayers[1]);
});

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
        addAction(prefix + action.PlayerInfo.playerId + ':<br>' + Math.round(action.index));
    });
}

// Filter illegal actions in the queue
function filterActions() {
    // Remove items in actionQ that have minus speed / index not reachable
    actionQ.elements = actionQ.elements.filter(action => action.PlayerInfo.speed > 0);
    actionQ.elements = actionQ.elements.filter(action => action.index <= action.PlayerInfo.actionVal);

    actionQ.elements.sort((a, b) => a.index - b.index);

    // Remove dead players
    allPlayers = allPlayers.filter(player => player.isAlive);
    allEnemies = allEnemies.filter(enemy => enemy.isAlive);
}

// Initialize the game
function initGame() {
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
        }
    );
}

initGame();

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

        // Enable the buttons
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => button.disabled = false);
    } else {
        console.log("Enemy " + info.playerId + " is acting!");
        activePlayer = allEnemies.find(enemy => enemy.id === info.playerId);
        activePlayer.useSkill(0, allPlayers[0]);
        animateAttack(activePlayer, allPlayers[0]);
        setTimeout(afterAction, 1100);
    }
}

// Button logic
document.getElementById('attackButton').addEventListener('click', function onClick() {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => button.disabled = true);

    activePlayer.useSkill(0, allEnemies[0]);
    animateAttack(activePlayer, allEnemies[0]);
    setTimeout(afterAction, 1100);
});
document.getElementById('skillButton').addEventListener('click', function onClick() {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => button.disabled = true);

    activePlayer.useSkill(1, activePlayer);
    animateBoostEffect(activePlayer);
    setTimeout(afterAction, 1500);
});
document.getElementById('hyperSkillButton').addEventListener('click', function onClick() {
    speedUp(20);
    actionForward(0.45);
    allPlayers.forEach(player => {
        animateBoostEffect(player);
    });
    updateStatusPanel();
    console.log("Speed up and forward action!");
});

// Speed up all players by val
function speedUp(val) {
    actionQ.elements.forEach(action => {
        if (action.PlayerInfo.charType === "player") {
            action.index = action.index * action.PlayerInfo.speed / (action.PlayerInfo.speed + val);
            action.PlayerInfo.speed += val;
            allPlayers.find(player => player.id === action.PlayerInfo.playerId).speed += val;
        }
    });

    // Update action queue
    progressVal(0);
    // Filter actions in case of minus speed-up
    filterActions();
}

// Forward all actions by val percentage
function actionForward(val) {
    // All the action dist decrease by val
    actionQ.elements.forEach(action => {
        if (action.PlayerInfo.charType === "player") {
            action.index -= (action.PlayerInfo.dist * val) / action.PlayerInfo.speed;
            action.index = Math.max(action.index, 0);
        }
    });

    // Update action queue
    progressVal(0);
    // Filter actions in case of minus forward
    filterActions();
}

