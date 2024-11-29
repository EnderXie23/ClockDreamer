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

const textureLoader = new THREE.TextureLoader(); // 加载纹理的加载器
const cubeTexture = textureLoader.load('data/textures/bluewood.jpg'); // 这里替换为纹理的路径

for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
            const cube = new THREE.Mesh(
                cubeGeometry,
                new THREE.MeshBasicMaterial({
                    map: cubeTexture, // 将纹理应用到材质
                    transparent: true
                })
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
    return new Promise((resolve) => {
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
            console.log("Loaded game data: ", gameData);
            resolveGameData();

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
        showMessage("Wrong game state.", 2);
        setTimeout(() => {
            window.location.href = "path.html";
        }, 1000);
        return new Error("Wrong game state");
    }
    if (!gameData.param) {
        gameData.param = 3;
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
    const loader = new THREE.TextureLoader();
    scene.background = loader.load('data/img/2.png');
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
    controls.enablePan = false;
    controls.maxDistance = 10;
    controls.minDistance = 4;

    if(isMobile()){
        document.getElementById("operationPanel").style.display = "flex";
    }

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
                // let userAdded = false;
                // if (initVis.some(loc => loc[0] === x && loc[1] === y && loc[2] === z))
                //     userAdded = true;
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
                        cube.material.color = new THREE.Color(0xEAE545);
                        break;
                }
            }
    if(targetCube) {
        // Highlight targetCube
        targetCube.material.color = new THREE.Color(0xff00ff);
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

// Handle mouse down event (selecting objects)
function onMouseDown(event) {
    dragging = false;

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    if(isMobile()){
        mouse.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
    } else {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

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
        targetCube = null;
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
        targetCube = null;
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
        window.location.href = "world.html";
    }, 1000);
}

// Animate
function animate() {
    if (win) return;
    requestAnimationFrame(animate);
    updateIndicatorVisibility();
    updateCubeVisibility();
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
window.addEventListener('touchstart', onMouseDown, false);
window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('touchmove', onMouseMove, false);
window.addEventListener('mouseup', onMouseUp, false);
window.addEventListener('touchend', onMouseUp, false);
window.addEventListener('keydown', (event) => {
    if (event.key === 'r') {
        initGame();
        showMessage("Game reset. You have " + cubesLeft + " cubes left to place.");
    }
    if (event.key === 'z') {
        if (!lastPlaceCube) {
            showMessage("No cubes to undo.", 2);
            return;
        }
        lastPlaceCube.userData.visibilityState = visibilityStates.HIDDEN;
        cubesLeft++;
        lastPlaceCube = null;
    }
    if(event.key === 't'){
        console.log(targetCube);
    }
});

// Mobile controls
document.getElementById("undoButton").addEventListener('click', () => {
    if (!lastPlaceCube) {
        showMessage("No cubes to undo.", 2);
        return;
    }
    lastPlaceCube.userData.visibilityState = visibilityStates.HIDDEN;
    cubesLeft++;
    lastPlaceCube = null;
});
document.getElementById("resetButton").addEventListener('click',() => {
    initGame();
    showMessage("Game reset. You have " + cubesLeft + " cubes left to place.");
});

// Handle window resizing
window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
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