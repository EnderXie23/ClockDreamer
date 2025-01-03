import * as THREE from 'three';
import {OrbitControls} from "three/addons/controls/OrbitControls.js";

let renderer, scene, light, camera, controls;
let gameData, data, win = false;
const audioLoader = new THREE.AudioLoader();
const listener = new THREE.AudioListener();
let bgm, autoMusicTrigger = true;

// Create Raycaster and mouse vector
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let actionCubes = [], intersects = [];
let targetCube;
let dragging = false;
let cubeLevels = [], levelInd;

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
    const dataKeys = ['gameData', 'cubeLevels']
    const gameDataPromises = dataKeys.map(key => loadGameData(key));

    bgm = new THREE.Audio(listener);
    audioLoader.load('data/sounds/Main_bgm.m4a', function (buffer) {
        bgm.setBuffer(buffer);
        bgm.setLoop(true);
        bgm.setVolume(0.3);
    });

    Promise.all([...gameDataPromises])
        .then((results) => {
            gameData = results.slice(0, dataKeys.length)[0];
            cubeLevels = results.slice(0, dataKeys.length)[1];
            console.log("Loaded game data: ", gameData);
            console.log("Loaded cube levels: ", cubeLevels);
            resolveGameData();

            // Choose a random level from the available levels
            levelInd = Math.floor(Math.random() * cubeLevels.length);
            const path = "data/cubes/cube" + cubeLevels[levelInd] + ".json";
            const dataPaths = [path];
            const dataPromises = dataPaths.map(path => loadFromFile(path));
            showMessage("Welcome to the cube game! You are now at game " + Math.ceil(gameData.level / 3) + ".");
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
    if (cubeLevels.length === 0 || gameData.state !== "in game" || gameData.gameMode !== 2) {
        showMessage("Wrong game state.", 1500, 2);
        setTimeout(() => {
            window.location.href = "world.html";
        }, 1000);
        return new Error("Wrong game state");
    }
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
    document.getElementById("cubeCnt").innerHTML = cubesLeft;
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

// Handle mouse down event (selecting objects)
function onMouseDown(event) {
    dragging = false;
    if (autoMusicTrigger) {
        showMessage("Music is playing!");
        bgm.play();
        autoMusicTrigger = false;
    }

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
        document.getElementById("cubeCnt").innerHTML = cubesLeft;
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
    pauseAudio();
    let updateGameData = {
        level: gameData.level + 1,
        score: gameData.score + 500,
        state: "win",
    }
    localStorage.setItem('gameData', JSON.stringify(updateGameData));
    console.log("Game data update:" + JSON.stringify(updateGameData));
    // Remove levelInd from cubeLevels
    cubeLevels.splice(levelInd, 1);
    localStorage.setItem('cubeLevels', JSON.stringify(cubeLevels));
    console.log("Cube levels update:" + JSON.stringify(cubeLevels));
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
        else {
            win = true;
            showMessage("You have placed all cubes, but the solution is incorrect.");
            showMessage("The game will reset in 2 seconds.", 2000, 2);
            setTimeout(() => {
                initGame();
                win = false;
                animate();
            }, 2000);
        }
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
        showMessage("Game reset.");
    }
    if (event.key === 'z') {
        if (!lastPlaceCube) {
            showMessage("No cubes to undo.", 1500, 2);
            return;
        }
        lastPlaceCube.userData.visibilityState = visibilityStates.HIDDEN;
        cubesLeft++;
        showMessage("You have " + cubesLeft + " cubes left to place.");
        document.getElementById("cubeCnt").innerHTML = cubesLeft;
        lastPlaceCube = null;
    }
    if(event.key === 't'){
        console.log(targetCube);
    }
});

// Mobile controls
document.getElementById("undoButton").addEventListener('click', () => {
    if (!lastPlaceCube) {
        showMessage("No cubes to undo.", 1500, 2);
        return;
    }
    lastPlaceCube.userData.visibilityState = visibilityStates.HIDDEN;
    cubesLeft++;
    showMessage("You have " + cubesLeft + " cubes left to place.");
    document.getElementById("cubeCnt").innerHTML = cubesLeft;
    lastPlaceCube = null;
});
document.getElementById("resetButton").addEventListener('click',() => {
    initGame();
    showMessage("Game reset.");
});

// Handle window resizing
window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// Tutorial
const tutorialCanvas = document.getElementById("tutorial-canvas");
const tutorialContainer = document.getElementById("tutorial-container");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const closeBtn = document.getElementById("close-btn");
let isSwiping = false, startX = 0;

const tutorialText = document.getElementById("tutorial-text");
const tutorialImage = document.getElementById("tutorial-image");
const dotIndicator = document.getElementById("dot-indicator");

let currentPage = 0;
const totalPages = 4; // Adjust this based on the number of tutorial steps

// Tutorial Data (You can add more steps as needed)
const tutorialData = [
    {
        image: "data/tutorial/cube/intro.png",
        text: "The cube game is designed to test your spatial reasoning skills. The basic layout is a 3*3*3 cube.\n" +
            "You can drag the scene around to view the cube from different angles."
    },
    {
        image: "data/tutorial/cube/goal.png",
        text: "The final goal is to place the cubes in such a way that the projection of the cubes on the two planes match.\n" +
            "The colored faces shall be matched, while the wireframe faces shall not be matched.\n"+
            "The green faces are already correctly placed, and the red ones indicate incorrect placement."
    },
    {
        image: "data/tutorial/cube/click.png",
        text: "Click on an existing cube, and you can see the adjacent cubes that can be placed.\n" +
            "Click on the adjacent cube to place a new cube."
    },
    {
        image: "data/tutorial/cube/buttons.png",
        text: "The total number of cubes you can place is limited.\n" +
            "You can reset the game by clicking the reset button or pressing key 'r'.\n" +
            "You can undo the last cube placement by clicking the undo button or pressing key 'z'."
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

document.getElementById("tutorialButton").addEventListener("click", () => {
    showTutorial();
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