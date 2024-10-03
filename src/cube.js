import * as THREE from 'three';
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";

const container = document.getElementById('container');
// Renderer
const renderer = new THREE.WebGLRenderer({antiAlias: true});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

// Create scene
let scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

// Create light
const light = new THREE.PointLight(0xffffff, 1, 100);
light.position.set(10, 10, 10);

// Create camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(4, 4, 4);
camera.lookAt(0, 0, 0);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.update();
controls.maxPolarAngle = 2 * Math.PI / 3;
controls.minAzimuthAngle = -Math.PI / 4;
controls.maxAzimuthAngle = 2 * Math.PI / 3;

// Cube
let cubes = [];
let vis = [];
let cubeGeometry = new THREE.BoxGeometry(0.85, 0.85, 0.85);
for (let x = 0; x < 3; x++) {
    vis[x] = [];
    for (let y = 0; y < 3; y++) {
        vis[x][y] = [];
        for (let z = 0; z < 3; z++) {
            vis[x][y][z] = false; // Initially, all cubes are not visible

            // Create a cube
            const cube = new THREE.Mesh(cubeGeometry, new THREE.MeshBasicMaterial(
                {color: 0xff0000, wireframe: true, transparent: true, opacity: 0.4}
            ));

            // Position the cube
            cube.position.set(x - 1, y - 1, z - 1);

            // Add cube to the scene and store it in the cubes array
            scene.add(cube);
            if (!cubes[x]) cubes[x] = [];
            if (!cubes[x][y]) cubes[x][y] = [];
            cubes[x][y][z] = cube;
        }
    }
}

// Load goals
let maxCubes, cubesLeft, initCubes;
let goalCubes = [];
let initVis = [];
let lastPlaceCube;

async function loadFromFile(path) {
    try {
        const response = await fetch(path);
        if (!response.ok) {
            console.error("Failed to load file");
        }
        return await response.json();
    } catch (error) {
        console.error(error);
    }
}

// Goal indicators
let goalZ = [];
let goalX = [];
let faceGeometry = new THREE.BoxGeometry(0.9, 0.9, 0.05);

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

function checkIndicatorZ(x, y) {
    return !goalZ[x][y].material.wireframe;
}

function checkIndicatorX(y, z) {
    return !goalX[y][z].material.wireframe;
}

// Deal with visibility
function updateVisibility() {
    for (let x = 0; x < 3; x++)
        for (let y = 0; y < 3; y++)
            for (let z = 0; z < 3; z++) {
                goalZ[x][y].material.color = new THREE.Color(0x0000ff);
                goalX[y][z].material.color = new THREE.Color(0x0000ff);
            }

    for (let x = 0; x < 3; x++)
        for (let y = 0; y < 3; y++)
            for (let z = 0; z < 3; z++) {
                cubes[x][y][z].visible = vis[x][y][z];
                if (vis[x][y][z] && !cubes[x][y][z].material.wireframe) {
                    if (checkIndicatorZ(x, y))
                        goalZ[x][y].material.color = new THREE.Color(0x00ff00);
                    else
                        goalZ[x][y].material.color = new THREE.Color(0xff0000);

                    if (checkIndicatorX(y, z))
                        goalX[y][z].material.color = new THREE.Color(0x00ff00);
                    else
                        goalX[y][z].material.color = new THREE.Color(0xff0000);
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
        let wireBool;
        if (posBool)
            wireBool = cubes[newX][newY][newZ].material.wireframe;

        if (posBool && wireBool)
            vis[newX][newY][newZ] = true;
    });
}

function hideAdjacentCubes() {
    for (let x = 0; x < 3; x++)
        for (let y = 0; y < 3; y++)
            for (let z = 0; z < 3; z++)
                if (cubes[x][y][z].material.wireframe === true)
                    vis[x][y][z] = false;
}

// Init
async function init() {
    // Load game from file
    loadFromFile("/data/cubes/cube5.json").then(data => {
        goalCubes = data.goalCubes;
        maxCubes = data.maxCubes;
        initCubes = data.initCubes;
        initVis = data.initVis;
        cubesLeft = maxCubes - initCubes;

        addIndicator();
        lastPlaceCube = null;

        for (let x = 0; x < 3; x++)
            for (let y = 0; y < 3; y++)
                for (let z = 0; z < 3; z++) {
                    vis[x][y][z] = false;
                    cubes[x][y][z].material.wireframe = true;
                }

        // Render Initial cubes
        initVis.forEach(loc => {
            const [x, y, z] = loc;
            vis[x][y][z] = true;
            cubes[x][y][z].material.wireframe = false;
        });
        controls.reset();
    })
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

// Animations
function showWinAnimation() {
    const winText = document.createElement('div');
    winText.innerHTML = "You Win!";
    winText.style.position = 'absolute';
    winText.style.top = '50%';
    winText.style.left = '50%';
    winText.style.fontSize = '48px';
    winText.style.color = 'green';
    winText.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(winText);

    // Automatically remove the message after 3 seconds
    setTimeout(() => {
        document.body.removeChild(winText);
    }, 3000);
}

function showLoseAnimation() {
    const loseText = document.createElement('div');
    loseText.innerHTML = "You Lose!";
    loseText.style.position = 'absolute';
    loseText.style.top = '50%';
    loseText.style.left = '50%';
    loseText.style.fontSize = '48px';
    loseText.style.color = 'red';
    loseText.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(loseText);

    // Automatically remove the message after 3 seconds
    setTimeout(() => {
        document.body.removeChild(loseText);
    }, 3000);
}

function showCubesLeftAnimation() {
    const indText = document.createElement('div');
    indText.innerHTML = "You have " + cubesLeft + " cubes left!";
    if (cubesLeft !== 0)
        indText.innerHTML += "<br>Press 'z' to undo, 'r' to restart";
    indText.style.position = 'absolute';
    indText.style.top = '80%';
    indText.style.left = '20%';
    indText.style.fontSize = '40px';
    indText.style.color = 'green';
    indText.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(indText);

    // Automatically remove the message after 1 second
    setTimeout(() => {
        document.body.removeChild(indText);
    }, 1000);
}

// Animate
function animate() {
    requestAnimationFrame(animate);
    try {
        updateVisibility();
    } catch (error) {
        console.warn(error);
    }
    controls.update();
    renderer.render(scene, camera);

    if (cubesLeft === 0) {
        if (judge())
            showWinAnimation();
        else
            showLoseAnimation();
        init();
    }
}

await init();
animate();

// Keyboard event listener
window.addEventListener('mousedown', onMouseDown, false);
window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('mouseup', onMouseUp, false);
window.addEventListener('keydown', (event) => {
    if (event.key === 'r') {
        init();
    }
    if (event.key === 'z') {
        if (!lastPlaceCube) return;
        lastPlaceCube.material.wireframe = true;
        const {x, y, z} = lastPlaceCube.position;
        vis[x + 1][y + 1][z + 1] = false;
        cubesLeft++;
        updateVisibility();
        lastPlaceCube = null;
    }
});

// Create Raycaster and mouse vector
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let actionCubes = [], intersects = [];
let targetCube;
let dragging = false;

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
                if (vis[x][y][z] && !cubes[x][y][z].material.wireframe)
                    actionCubes.push(cubes[x][y][z]);

    for (let x = 0; x < 3; x++)
        for (let y = 0; y < 3; y++)
            for (let z = 0; z < 3; z++)
                if (vis[x][y][z] && cubes[x][y][z].material.wireframe)
                    actionCubes.push(cubes[x][y][z]);

    // Update the rayCaster with camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Check if we intersect with visible cubes
    intersects = raycaster.intersectObjects(actionCubes);
    if (intersects.length > 0)
        targetCube = intersects[0].object;
    else
        return;

    if (targetCube.material.wireframe) {
        // Make the adjacent cube visible
        targetCube.material.wireframe = false;
        const {x, y, z} = targetCube.position;
        vis[x + 1][y + 1][z + 1] = true;

        // Hide adjacent cubes
        hideAdjacentCubes();

        // Mark the last placed cube
        lastPlaceCube = targetCube;
        if (cubesLeft > 0) cubesLeft--;
        showCubesLeftAnimation();
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