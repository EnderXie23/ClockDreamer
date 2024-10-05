import * as THREE from 'three';
import {Skill, Player, Enemy} from './Character.js';

// Initializing Three.js scene
const container = document.getElementById('container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth * 0.6 / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth * 0.6, window.innerHeight);
container.appendChild(renderer.domElement);
camera.position.z = 5;

// Placeholder geometry for combatants (e.g., player and enemies)
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({color: 0x00ff00});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

animate();

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

function filterActions() {
    // Remove items in actionQ that have minus speed / index not reachable
    actionQ.elements = actionQ.elements.filter(action => action.PlayerInfo.speed > 0);
    actionQ.elements = actionQ.elements.filter(action => action.index <= action.PlayerInfo.actionVal);

    actionQ.elements.sort((a, b) => a.index - b.index);

    // Remove dead players
    allPlayers = allPlayers.filter(player => player.isAlive);
    allEnemies = allEnemies.filter(enemy => enemy.isAlive);
}

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

    // Reset the action queue
    actionQ.elements = [];

    // Reset the round
    round = 0;
    currentVal = 0;
    startRound();
}

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

function afterAction() {
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
        // Button logic
        document.getElementById('attackButton').addEventListener('click', function onClick() {
            document.getElementById('attackButton').removeEventListener('click', onClick);
            activePlayer.useSkill(0, allEnemies[0]);
            afterAction();
        });
        document.getElementById('skillButton').addEventListener('click', function onClick() {
            document.getElementById('skillButton').removeEventListener('click', onClick);
            activePlayer.useSkill(1, activePlayer);
            afterAction();
        });
        document.getElementById('hyperSkillButton').addEventListener('click', function onClick() {
            document.getElementById('hyperSkillButton').removeEventListener('click', onClick);
            speedUp(20);
            actionForward(0.45);
            updateStatusPanel();
            console.log("Speed up and forward action!");
        });
    } else {
        console.log("Enemy " + info.playerId + " is acting!");
        activePlayer = allEnemies.find(enemy => enemy.id === info.playerId);
        activePlayer.useSkill(0, allPlayers[0]);
        afterAction();
    }
}

export function speedUp(val) {
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

export function actionForward(val) {
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

