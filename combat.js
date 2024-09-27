import * as THREE from 'three';

// Initializing Three.js scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth * 0.6 / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({canvas: document.getElementById('canvas')});
renderer.setSize(window.innerWidth * 0.6, window.innerHeight);
document.body.appendChild(renderer.domElement);

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

function addAction(text) {
    const action = document.createElement('p');
    action.textContent = text;
    actionSequence.appendChild(action);
    actionSequence.scrollTop = actionSequence.scrollHeight; // Auto scroll
}

function clearAction() {
    actionSequence.innerHTML = "";
}

// Action sequence handling
class PlayerInfo {
    constructor(playerId, speed) {
        this.playerId = playerId;
        this.speed = speed;
        this.actionVal = 100;
        this.dist = 10000;
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
let players = [
    {playerId: 1, speed: 230},
    {playerId: 2, speed: 190},
    {playerId: 3, speed: 215}
];

let currentVal = 0;
let round = 0;

function progressVal(moveVal) {
    document.getElementById('val-indicator').textContent = 'Current action value: ' + Math.round(currentVal);
    console.log('Current action value: ' + currentVal);

    clearAction();
    actionQ.elements.forEach(action => {
        action.PlayerInfo.actionVal -= moveVal;
        action.index -= moveVal;
        addAction('Player ' + action.PlayerInfo.playerId + ':\n' + Math.round(action.index));
    });
}

function filterActions(){
    // Remove items in actionQ that have minus speed / index not reachable
    actionQ.elements = actionQ.elements.filter(action => action.PlayerInfo.speed > 0);
    actionQ.elements = actionQ.elements.filter(action => action.index <= action.PlayerInfo.actionVal);

    actionQ.elements.sort((a, b) => a.index - b.index);
}

function startRound() {
    round += 1;
    document.getElementById('round-indicator').textContent = 'Round ' + round;

    // Insert players into actionQ
    players.forEach(player => {
        let info = new PlayerInfo(player.playerId, player.speed);
        actionQ.enqueue(info.dist / player.speed, info);
    });

    // Get the first player in the queue to act
    currentVal = actionQ.elements[0].index;
    progressVal(currentVal);
}

startRound();

function calcAction() {
    // Get the next player in the queue
    const activePlayer = actionQ.dequeue();
    const info = activePlayer.PlayerInfo;
    if (info.dist / info.speed <= info.actionVal) {
        // Player can perform another round
        actionQ.enqueue(info.dist / info.speed, activePlayer.PlayerInfo);
    }

    // Update action value for all players
    if (!actionQ.isEmpty()) {
        const moveVal = actionQ.elements[0].index
        currentVal += moveVal;
        progressVal(moveVal);
    } else {
        // Start a new round
        startRound();
        console.log("New round started!")
    }
}

function speedUp(val) {
    actionQ.elements.forEach(action => {
        action.index = action.index * action.PlayerInfo.speed / (action.PlayerInfo.speed + val);
        action.PlayerInfo.speed += val;
    });

    // Filter actions in case of minus speed-up
    filterActions();
    // console.log(actionQ);
}

function actionForward(val) {
    // All the action dist decrease by val
    actionQ.elements.forEach(action => {
        action.index -= (action.PlayerInfo.dist * val) / action.PlayerInfo.speed;
        action.index = Math.max(action.index, 0);
    });

    // Filter actions in case of minus forward
    filterActions();
    // console.log(actionQ);
}

// Button logic
document.getElementById('attackButton').addEventListener('click', function () {
    // addAction("Player performed an attack!");
    calcAction();
});

document.getElementById('defendButton').addEventListener('click', function () {
    // addAction("Player is defending!");
});

document.getElementById('skillButton').addEventListener('click', function () {
    // addAction("Player used a skill!");
    speedUp(20);
    progressVal(0);
});

document.getElementById('forwardButton').addEventListener('click', function () {
    // addAction("Player moved forward!");
    actionForward(0.16);
    progressVal(0);
});