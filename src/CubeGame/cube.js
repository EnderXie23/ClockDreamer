import * as THREE from 'three';
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";

let renderer, scene, light, camera, controls;
let gameData, data, win = false;

// Create Raycaster and mouse vector
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let actionCubes = [], intersects = [];
let targetCube;
let dragging = false;

// Cube
let cubeGeometry = new THREE.BoxGeometry(0.85, 0.85, 0.85);
const visibilityStates = {
    HIDDEN: 0,
    HALF_VISIBLE: 1,
    VISIBLE: 2
};
let cubes = Array(3).fill().map(() => Array(3).fill().map(() => Array(3).fill(null)));

// Load goals
let maxCubes, cubesLeft, initCubes, lastPlaceCube;
let goalCubes = [], initVis = [];

// Goal indicators
let goalZ = [], goalX = [];
let faceGeometry = new THREE.BoxGeometry(0.9, 0.9, 0.05);

// Initialize cubes with visibility state
for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
            const cube = new THREE.Mesh(
                cubeGeometry,
                new THREE.MeshBasicMaterial({color: 0x9D76D0, transparent: true})
            );
            cube.position.set(x - 1, y - 1, z - 1);
            cube.userData.visibilityState = visibilityStates.HIDDEN; // Initialize as hidden
            cubes[x][y][z] = cube;
        }
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
    // const textureURLs = ['data/textures/rocky_terrain.jpg', 'data/textures/grassy_terrain.jpg'];
    // const modelURLs = ['data/models/cube_character.glb', 'data/models/fence.glb', 'data/models/cube_monster.glb'];
    const dataKeys = ['gameData']

    // const texturePromises = textureURLs.map(url => loadTexture(url));
    // const modelPromises = modelURLs.map(url => loadModel(url));
    const gameDataPromises = dataKeys.map(key => loadGameData(key));


    Promise.all([...gameDataPromises])
        .then((results) => {
            gameData = results.slice(0, 1)[0];
            resolveGameData();
            console.log("Loaded gameData: " + results.slice(0, 1));

            const path = "data/cubes/cube" + gameData.param + ".json";
            const dataPaths = [path];
            const dataPromises = dataPaths.map(path => loadFromFile(path));
            Promise.all([...dataPromises])
                .then((results2) => {
                    data = results2[0];
                    init();
                })
                .catch((error) => {
                    console.log("An error occurred while loading assets:", error);
                });
        })
        .catch((error) => {
            console.log("An error occurred while loading assets:", error);
        });
}

function resolveGameData() {
    if (gameData.state !== "in game" || gameData.gameMode !== 2) {
        showMessage("Invalid game state.");
        console.log("Invalid game state.")
    }
    if (!gameData.param) {
        gameData.param = 1;
    }
}

function init() {
    // Renderer
    const container = document.getElementById('container');
    renderer = new THREE.WebGLRenderer({antiAlias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    for (let x = 0; x < 3; x++)
        for (let y = 0; y < 3; y++)
            for (let z = 0; z < 3; z++)
                scene.add(cubes[x][y][z]);

    // Create light
    light = new THREE.PointLight(0xffffff, 1, 100);
    light.position.set(10, 10, 10);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(4, 4, 4);
    camera.lookAt(0, 0, 0);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.update();
    controls.maxPolarAngle = 2 * Math.PI / 3;
    controls.minAzimuthAngle = -Math.PI / 4;
    controls.maxAzimuthAngle = 2 * Math.PI / 3;

    initGame();

    animate();
}

function initGame() {
    lastPlaceCube = null;
    goalCubes = data.goalCubes;
    maxCubes = data.maxCubes;
    initCubes = data.initCubes;
    initVis = data.initVis;
    cubesLeft = maxCubes - initCubes;
    showMessage("Welcome! You have " + cubesLeft + " cubes left to place.");
    addIndicator();

    // Render Initial cubes
    for (let x = 0; x < 3; x++)
        for (let y = 0; y < 3; y++)
            for (let z = 0; z < 3; z++)
                cubes[x][y][z].userData.visibilityState = visibilityStates.HIDDEN;
    initVis.forEach(loc => {
        const [x, y, z] = loc;
        cubes[x][y][z].userData.visibilityState = visibilityStates.VISIBLE;
    });
}

function addIndicator() {
    for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
            let face = new THREE.Mesh(faceGeometry, new THREE.MeshBasicMaterial({color: 0x0000ff, wireframe: true}));
            face.position.set(x - 1, y - 1, -3);
            scene.add(face);
            if (!goalZ[x]) goalZ[x] = [];
            goalZ[x][y] = face;
        }
    }
    for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
            let face = new THREE.Mesh(faceGeometry, new THREE.MeshBasicMaterial({color: 0x0000ff, wireframe: true}));
            face.position.set(-3, y - 1, z - 1);
            face.rotateY(Math.PI / 2);
            scene.add(face);
            if (!goalX[y]) goalX[y] = [];
            goalX[y][z] = face;
        }
    }
    goalCubes.forEach(loc => {
        const [x, y, z] = loc;
        goalZ[x][y].material.wireframe = false;
        goalX[y][z].material.wireframe = false;
    })
}

// Deal with visibility
function updateIndicatorVisibility() {
    for (let x = 0; x < 3; x++)
        for (let y = 0; y < 3; y++)
            for (let z = 0; z < 3; z++) {
                goalZ[x][y].material.color = new THREE.Color(0x0000ff);
                goalX[y][z].material.color = new THREE.Color(0x0000ff);
            }

    for (let x = 0; x < 3; x++)
        for (let y = 0; y < 3; y++)
            for (let z = 0; z < 3; z++) {
                if (cubes[x][y][z].userData.visibilityState === visibilityStates.VISIBLE) {
                    if (!goalZ[x][y].material.wireframe)
                        goalZ[x][y].material.color = new THREE.Color(0x00ff00);
                    else
                        goalZ[x][y].material.color = new THREE.Color(0xff0000);

                    if (!goalX[y][z].material.wireframe)
                        goalX[y][z].material.color = new THREE.Color(0x00ff00);
                    else
                        goalX[y][z].material.color = new THREE.Color(0xff0000);
                }
            }
}

function updateCubeVisibility() {
    for (let x = 0; x < 3; x++)
        for (let y = 0; y < 3; y++)
            for (let z = 0; z < 3; z++) {
                let cube = cubes[x][y][z];
                switch (cube.userData.visibilityState) {
                    case visibilityStates.HIDDEN:
                        cube.visible = false;
                        cube.material.opacity = 0.0;
                        break;
                    case visibilityStates.HALF_VISIBLE:
                        cube.visible = true;
                        cube.material.opacity = 0.6;
                        cube.material.color = new THREE.Color(0xffffff);
                        break;
                    case visibilityStates.VISIBLE:
                        cube.visible = true;
                        cube.material.opacity = 0.9;
                        cube.material.color = new THREE.Color(0x9D76D0);
                        break;
                }
            }
}

function showAdjacentCubes(x, y, z) {
    const directions = [
        [-1, 0, 0], [1, 0, 0],  // x-axis
        [0, -1, 0], [0, 1, 0],  // y-axis
        [0, 0, -1], [0, 0, 1]   // z-axis
    ];

    directions.forEach(([dx, dy, dz]) => {
        const newX = x + dx;
        const newY = y + dy;
        const newZ = z + dz;
        const posBool = newX >= 0 && newX <= 2 && newY >= 0 && newY <= 2 && newZ >= 0 && newZ <= 2;
        if (posBool) {
            const adjacentCube = cubes[newX][newY][newZ];
            if (adjacentCube.userData.visibilityState === visibilityStates.HIDDEN)
                adjacentCube.userData.visibilityState = visibilityStates.HALF_VISIBLE;
        }
    });
}

function hideAdjacentCubes() {
    for (let x = 0; x < 3; x++)
        for (let y = 0; y < 3; y++)
            for (let z = 0; z < 3; z++)
                if (cubes[x][y][z].userData.visibilityState === visibilityStates.HALF_VISIBLE)
                    cubes[x][y][z].userData.visibilityState = visibilityStates.HIDDEN;
}

// Game judge
function judge() {
    for (let x = 0; x < 3; x++)
        for (let y = 0; y < 3; y++) {
            if (!goalZ[x][y].material.wireframe && goalZ[x][y].material.color.getHex() !== 0x00ff00)
                return false;
            if (goalX[y][x].material.color.getHex() === 0xff0000)
                return false;
        }
    for (let y = 0; y < 3; y++)
        for (let z = 0; z < 3; z++) {
            if (!goalX[y][z].material.wireframe && goalX[y][z].material.color.getHex() !== 0x00ff00)
                return false;
            if (goalZ[y][z].material.color.getHex() === 0xff0000)
                return false;
        }
    return true;
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

// Handle mouse down event (selecting objects)
function onMouseDown(event) {
    event.preventDefault();
    dragging = false;

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    actionCubes = [];
    for (let x = 0; x < 3; x++)
        for (let y = 0; y < 3; y++)
            for (let z = 0; z < 3; z++)
                if (cubes[x][y][z].userData.visibilityState !== visibilityStates.HIDDEN)
                    actionCubes.push(cubes[x][y][z]);

    // Update the rayCaster with camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Check if we intersect with visible cubes
    intersects = raycaster.intersectObjects(actionCubes);
    if (intersects.length > 0)
        targetCube = intersects[0].object;
    else
        return;

    if (targetCube.userData.visibilityState === visibilityStates.HALF_VISIBLE) {
        // Make the target cube visible
        targetCube.userData.visibilityState = visibilityStates.VISIBLE;
        hideAdjacentCubes();

        // Mark the last placed cube
        lastPlaceCube = targetCube;
        if (cubesLeft > 0) cubesLeft--;
        showMessage("You have " + cubesLeft + " cubes left to place.");
    } else {
        // Show its adjacent cubes
        hideAdjacentCubes();
        const {x, y, z} = targetCube.position;
        showAdjacentCubes(x + 1, y + 1, z + 1);
    }
}

// Handle mouse move event (dragging)
function onMouseMove() {
    // Detect if mouse is down
    dragging = true;
}

// Handle mouse up event (stop dragging)
function onMouseUp() {
    if (dragging) {
        dragging = false;
        return;
    }
    if (intersects.length === 0) {
        hideAdjacentCubes();
    }
}

function handleWin() {
    win = true;
    let updateGameData = {
        level: gameData.level,
        score: gameData.score + 500,
        state: "win",
    }
    localStorage.setItem('gameData', JSON.stringify(updateGameData));
    console.log("Game data update:" + JSON.stringify(updateGameData));
    showMessage("Congratulations! You have won!");

    setTimeout(() => {
        window.location.href = "index.html";
    }, 1000);
}

// Animate
function animate() {
    if (win) return;
    requestAnimationFrame(animate);
    try {
        updateIndicatorVisibility();
        updateCubeVisibility();
    } catch (error) {
        console.warn(error);
    }
    controls.update();
    renderer.render(scene, camera);

    if (cubesLeft === 0) {
        if (judge())
            handleWin();
        else
            showMessage("You have placed all cubes, but the solution is incorrect.");
    }
}

loadAllAssets();

// Keyboard event listener
window.addEventListener('mousedown', onMouseDown, false);
window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('mouseup', onMouseUp, false);
window.addEventListener('keydown', (event) => {
    if (event.key === 'r') {
        initGame();
        showMessage("Game reset. You have " + cubesLeft + " cubes left to place.");
    }
    if (event.key === 'z') {
        if (!lastPlaceCube) return;
        lastPlaceCube.userData.visibilityState = visibilityStates.HIDDEN;
        cubesLeft++;
        lastPlaceCube = null;
    }
});

// Handle window resizing
window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});