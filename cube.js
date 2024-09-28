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
camera.position.set(5, 5, 5);
camera.lookAt(0, 0, 0);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.update();
controls.maxPolarAngle = Math.PI / 2;
controls.minAzimuthAngle = -Math.PI / 8;
controls.maxAzimuthAngle = Math.PI / 2;


// Cube
let cubes = [];
let vis = [];
let cubeGeometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);
for (let x = 0; x < 3; x++) {
    vis[x] = [];
    for (let y = 0; y < 3; y++) {
        vis[x][y] = [];
        for (let z = 0; z < 3; z++) {
            vis[x][y][z] = false; // Initially, all cubes are not visible

            // Create a cube
            const cube = new THREE.Mesh(cubeGeometry, new THREE.MeshBasicMaterial({color: 0xff0000, wireframe: true}));

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

// Deal with visibility
function updateVisibility() {
    for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
            for (let z = 0; z < 3; z++) {
                cubes[x][y][z].visible = vis[x][y][z];
            }
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

// Animate
function animate() {
    requestAnimationFrame(animate);

    updateVisibility();
    controls.update();

    renderer.render(scene, camera);
}

cubes[2][0][0].material.wireframe = false;
vis[2][0][0] = true;
animate();

// Keyboard event listener
window.addEventListener('mousedown', onMouseDown, false);
// window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('mouseup', onMouseUp, false);

// Create Raycaster and mouse vector
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let intersectsVis;
let intersectsWire;


// Handle mouse down event (selecting objects)
function onMouseDown(event) {
    event.preventDefault();

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    let visibleCubes = [];
    for (let x = 0; x < 3; x++)
        for (let y = 0; y < 3; y++)
            for (let z = 0; z < 3; z++)
                if (vis[x][y][z] && !cubes[x][y][z].material.wireframe)
                    visibleCubes.push(cubes[x][y][z]);

    let wireCubes = [];
    for (let x = 0; x < 3; x++)
        for (let y = 0; y < 3; y++)
            for (let z = 0; z < 3; z++)
                if (vis[x][y][z] && cubes[x][y][z].material.wireframe)
                    wireCubes.push(cubes[x][y][z]);

    // Update the rayCaster with camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Check if we intersect with visible cubes
    intersectsVis = raycaster.intersectObjects(visibleCubes);
    intersectsWire = raycaster.intersectObjects(wireCubes);

    if (intersectsVis.length === 1) {
        // Show its adjacent cubes
        const cube = intersectsVis[0].object;
        const {x, y, z} = cube.position;
        showAdjacentCubes(x + 1, y + 1, z + 1);
    } else if (intersectsWire.length === 1) {
        // Make the adjacent cube visible
        const cube = intersectsWire[0].object;
        cube.material.wireframe = false;
        const {x, y, z} = cube.position;
        hideAdjacentCubes();
        vis[x + 1][y + 1][z + 1] = true;
    }
}

// Handle mouse move event (dragging the yellow block)
function onMouseMove(event) {

}

// Handle mouse up event (stop dragging)
function onMouseUp() {
    if (intersectsVis.length === 0 && intersectsWire.length === 0)
        hideAdjacentCubes();
}
