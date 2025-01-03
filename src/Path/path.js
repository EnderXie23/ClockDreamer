import {data} from './data.js';
import {MTLLoader} from 'three/addons/loaders/MTLLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {OrbitControls} from "three/addons/controls/OrbitControls.js";

let scene, renderer, controls, camera, ambient;
let floorplan, settings, grid, light;
let monumentSquareSize, monumentHeight;
let litLightNum = 1, gameData;
let progress = [];
let pointLights = [];
let pointLightsZ = [];
let isBonus = false;
let dragging = false;
let selectedObject = null;
let bgm, autoMusicTrigger = true;
const audioLoader = new THREE.AudioLoader();
const listener = new THREE.AudioListener();

const width = window.innerWidth;
const height = window.innerHeight;
const aspectRatio = width / height;
const fieldOfView = 25, nearView = 1, farView = 10000;
const assetPath = 'data/objects/cell';
const blockSize = 20;

const TYPE_PLATFORM = 'platform';
const CELL_BLANK = 0;
const CELL_BLOCK = 1;
const CELL_TAIL = 2;
const CELL_STAIRS = 3;
const CELL_LIGHT = 4;
const CELL_PILLAR = 5;
const CELL_MOVABLE = 6;

const initGame = async () => {
    // grid setup
    grid = floorplan[0][0].length;
    monumentSquareSize = blockSize * grid;
    monumentHeight = blockSize * floorplan.length;

    // env
    scene = new THREE.Scene();

    renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.setClearColor(0xD2B48C);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // scene.add(new THREE.AxesHelper(1000));

    // camera
    camera = new THREE.PerspectiveCamera(fieldOfView, aspectRatio, nearView, farView)
    camera.position.set(700, -700, 700);
    camera.up = new THREE.Vector3(0, 0, 1)

    // light
    light = new THREE.PointLight(`rgb(${settings.globalLight})`, 5, 1100);
    light.position.set(600, -200, 250 + monumentHeight);
    light.castShadow = true;
    ambient = new THREE.AmbientLight(`rgb(${settings.ambientLight})`);
    scene.add(light, ambient);

    // orbit control
    controls = new OrbitControls(camera, renderer.domElement);
    controls.minPolarAngle = Math.PI / 2 - 0.5;
    controls.maxPolarAngle = Math.PI / 2 - 0.5;
    controls.zoomSpeed = 0.3;
    controls.minDistance = 500;
    controls.maxDistance = 2000;
    controls.enableDamping = true;
    controls.dampingFactor = 0.2;
    controls.enableRotate = false;
    controls.autoRotate = false;

    document.body.appendChild(renderer.domElement);


    const gameData = loadGameData();

    // 根据游戏数据点亮灯光
    if (gameData.state === "path") {
        pointLights.forEach((light, index) => {
            if (index < gameData.level) {
                scene.add(light); // 将灯光添加到场景中
                console.log(`Light ${index + 1} is lit.`);
            }
        });
    }
    floorplanRenderer();
    resizeListener();
    mouseListener();
}

function floorplanRenderer() {
    let platform = Math.floor(data.floorplan.length / 2);
    let zPos = -monumentSquareSize - settings.offsetY
    let yPos = 0;
    let xPos = 0;
    for (let z = 0; z < floorplan.length; z++) {
        let reversedZ = floorplan.length - (z + 1);
        zPos += blockSize;
        xPos = monumentSquareSize / 2;
        for (let x = 0; x < floorplan[reversedZ].length; x++) {
            let reversedX = floorplan[reversedZ].length - (x + 1);
            xPos -= blockSize;
            yPos = monumentSquareSize / 2;
            for (let y = 0; y < floorplan[reversedZ][reversedX].length; y++) {
                let reversedY = floorplan[reversedZ][reversedX].length - (y + 1);
                let cell = floorplan[reversedZ][reversedX][reversedY];
                let upperCell = reversedZ - 1 >= 0 && reversedZ - 1 <= floorplan.length ? floorplan[reversedZ - 1][reversedX][reversedY] : 0;
                let isPlatform =
                    (cell === CELL_BLOCK) &&
                    (upperCell === CELL_BLANK || upperCell === CELL_PILLAR || upperCell === CELL_TAIL);

                let shape = null;
                yPos -= blockSize;
                switch (cell) {
                    case CELL_BLOCK:
                        if ((reversedZ >= platform - 3 && reversedZ <= platform + 3) ||
                            isBonus === true) {
                            shape = new Cube(
                                xPos, yPos, zPos,
                                `rgb(${settings.cellColor})`,
                                blockSize,
                                isPlatform
                            );
                        } else {
                            shape = new Cube(
                                xPos, yPos, zPos,
                                `rgb(${settings.cellColor})`,
                                blockSize,
                                0,
                                new THREE.Vector3(Math.random(), Math.random(), Math.random())
                            );
                        }
                        break;
                    case CELL_TAIL:
                        shape = new Shape(
                            xPos, yPos, zPos,
                            `rgb(${settings.tail})`,
                            `${assetPath}/tail.json`,
                            1
                        );
                        break;
                    case CELL_STAIRS:
                        shape = new Shape(
                            xPos, yPos, zPos,
                            `rgb(${settings.cellColor})`,
                            `${assetPath}/stairs.json`,
                            1,
                            7.855
                        );
                        break;
                    case CELL_LIGHT:
                        if (reversedZ >= platform - 5 && reversedZ <= platform) {
                            shape = new Light(
                                xPos, yPos, zPos,
                                `rgb(${settings.pointLight})`,
                                settings.pointLightScale,
                                0
                            );
                        } else {
                            shape = new Light(
                                xPos, yPos, zPos,
                                `rgb(${settings.pointLight})`,
                                settings.pointLightScale,
                                1
                            );
                        }
                        break;
                    case CELL_PILLAR:
                        shape = new Shape(
                            xPos, yPos, zPos,
                            `rgb(${settings.cellColor})`,
                            `${assetPath}/pillar.json`,
                        );
                        break;
                    case CELL_MOVABLE:
                        shape = new MovableCube(
                            xPos, yPos, zPos,
                            `rgb(${settings.cellColor})`,
                            blockSize
                        );
                        break;

                }
                if (shape !== null) {
                    shape.render();
                }
            }
        }
    }
}

class Cube {
    constructor(x, y, z, color, size, isPlatform = false, rotate = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.color = color;
        this.size = size;
        this.rotate = rotate ? rotate : undefined;
        this.isPlatform = isPlatform;
    }

    render() {
        let boxGeometry = new THREE.BoxGeometry(this.size, this.size, this.size);
        let lambertMaterial = new THREE.MeshLambertMaterial({
            color: this.color
        });

        let mesh = new THREE.Mesh(boxGeometry, lambertMaterial);
        if (this.isPlatform) {
            mesh.type = TYPE_PLATFORM;
        }

        mesh.position.x = this.x;
        mesh.position.y = this.y;
        mesh.position.z = this.z;

        if (this.rotate) {
            mesh.rotation.x = this.rotate.x;
            mesh.rotation.y = this.rotate.y;
            mesh.rotation.z = this.rotate.z;
        }

        scene.add(mesh);
    }
}

class MovableCube {
    constructor(x, y, z, color, size, isPlatform = false, rotate = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.color = color;
        this.size = size;
        this.rotate = rotate ? rotate : undefined;
        this.isPlatform = isPlatform;
    }

    render() {
        let boxGeometry = new THREE.BoxGeometry(this.size, this.size, this.size);
        let lambertMaterial = new THREE.MeshLambertMaterial({
            color: this.color
        });

        let mesh = new THREE.Mesh(boxGeometry, lambertMaterial);
        if (this.isPlatform) {
            mesh.type = TYPE_PLATFORM;
        }
        mesh.draggable = true;

        mesh.position.x = this.x;
        mesh.position.y = this.y;
        mesh.position.z = this.z;

        if (this.rotate) {
            mesh.rotation.x = this.rotate.x;
            mesh.rotation.y = this.rotate.y;
            mesh.rotation.z = this.rotate.z;
        }

        scene.add(mesh);
    }
}

class Shape {
    constructor(x, y, z, color, source, scale = 1, rotate = 0, isPlatform = false) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.color = color;
        this.source = source;
        this.scale = scale;
        this.rotate = rotate;
        this.isPlatform = isPlatform;
    }

    render() {
        let loader = new THREE.LegacyJSONLoader();
        loader.load(this.source, geometry => {
            let mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({
                color: this.color
            }));
            if (this.isPlatform) {
                mesh.type = TYPE_PLATFORM;
            }
            mesh.position.x = this.x;
            mesh.position.y = this.y;
            mesh.position.z = this.z;

            mesh.rotation.x = Math.PI / 2;
            mesh.rotation.y = this.rotate;
            mesh.scale.set(this.scale, this.scale, this.scale);

            scene.add(mesh);
        });
    }
}

class Light {
    constructor(x, y, z, color, size = 0, show = 1) {
        this.x = x;
        this.y = y;
        this.z = z - 7;
        this.color = color;
        this.size = size;
        this.show = show;
    }

    render() {
        let pointLight = new THREE.PointLight(this.color, 4.0, 100, 2);

        if (this.size !== 0) {
            let sphereGeometry = new THREE.SphereGeometry(this.size, 50, 50);
            let basicMaterial = new THREE.MeshBasicMaterial({
                color: this.color
            });
            let lightBulb = new THREE.Mesh(sphereGeometry, basicMaterial);
            pointLight.add(lightBulb);
        }

        let time = Date.now() * 0.0005;
        pointLight.position.set(this.x, this.y, this.z + Math.sin(time * 3) * 10);
        pointLight.castShadow = true;

        pointLights.push(pointLight);
        if (this.show) {
            scene.add(pointLight);
        } else {
            progress.push(pointLight);
        }
    }
}

// 获取游戏数据
function loadGameData() {
    const gameData = JSON.parse(localStorage.getItem('gameData'));
    if (gameData) {
        console.log("Loaded game data: ", gameData);
        return gameData;
    } else {
        console.warn("No game data found.");
        return { level: 1, score: 0, state: "path" }; // 默认数据
    }
}

// ======misc=====
const mouse = new THREE.Vector2();
const mousePointer = new THREE.Raycaster();
const gravityRay = new THREE.Raycaster();
const GRAVITY = 1.0;
const MOVEMENT = 2.5;
// actual coordinates of floorplan[0][0][0]
let defaultMapGeometry = new THREE.Vector3(0, 0, 0);
let win = false;

// =====Event Triggers======
const DEST_BLACKLIST = [{z: 10, x: 9, y: 2}, {z: 10, x: 8, y: 8}, {z: 10, x: 4, y: 6}, {z: 10, x: 2, y: 10}]
const DEST = [{z: 10, x: 10, y: 2}, {z: 10, x: 9, y: 8}, {z: 10, x: 3, y: 6}, {z: 10, x: 2, y: 9}];
const initPos = [{z: 10, x: 6, y: 0}, {z: 10, x: 11, y: 2}, {z: 10, x: 10, y: 8}, {z: 10, x: 3, y: 5}];

// =====variables=====
let character;
let MOUSE_POINTED;
let fpsInterval, startTime, now, then, elapsed;

let isMoving = false;
let path = [];

let blockOnCursor;
let upDown = true;

// ========== RESIZE ==========
function resizeListener() {
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }, false);
}

function loadData(key) {
    // Load data from localStroage
    return new Promise((resolve) => {
        let data = JSON.parse(localStorage.getItem(key));
        if (data) {
            console.log("Data found in localStorage: ", data);
            resolve(data);
        } else {
            console.log('No data found in localStorage. Return null.')
            resolve(null);
        }
    });
}

function resolveGameData() {
    if(!localStorage.getItem('gameData'))
        localStorage.setItem('gameData', JSON.stringify(gameData));
    if (gameData.state !== "path") {
        showMessage("Wrong game state.", 1500, 2);
        setTimeout(() => {
            window.location.href = "world.html";
        }, 1500);
        return new Error("Wrong game state");
    }
}

// ========== ON LOAD ==========
async function loadGame() {
    window.addEventListener('load', async () => {
        settings = data.settings;
        document.body.style.background = `rgb(${settings.background})`;
        floorplan = data.floorplan;
        await initGame()
            .then(() => {
                bgm = new THREE.Audio(listener);
                audioLoader.load('data/sounds/Path_bgm.m4a', function (buffer) {
                    bgm.setBuffer(buffer);
                    bgm.setLoop(true);
                    bgm.setVolume(0.15);
                });

                const keys = ['gameData'];
                const dataPromises = keys.map((key) => loadData(key));

                Promise.all(dataPromises).then((values) => {
                    gameData = values[0] ? values[0] : {level: 1, score: 0, state: "path"};
                    resolveGameData();

                    litLightNum = Math.min(gameData.level, 4);

                    for(let i = 0; i < litLightNum; i++)
                        scene.add(progress.shift());
                })
            })
            .then(await loadCharacter(scene).then(() => {
                // limit frame rate based on the settings
                fpsInterval = 1000 / settings.frameRate;
                then = Date.now();
                startTime = then;
            }))
            .then(() => {
                animate();
                // let loadingDiv = document.getElementById('loading');
                // loadingDiv.parentNode.removeChild(loadingDiv);
            });
    });

    defaultMapGeometry = new THREE.Vector3(
        -(Math.floor(data.floorplan[0].length / 2) * blockSize),
        -(Math.floor(data.floorplan[0].length / 2) * blockSize),
        (Math.ceil(data.floorplan.length / 2) * blockSize)
    );
}

function animate() {
    if(win) return;
    requestAnimationFrame(animate);
    now = Date.now();
    elapsed = now - then;
    if (elapsed > fpsInterval) {
        then = now - (elapsed % fpsInterval);

        // gravity action
        applyGravity();
        // character behaviour
        applyMovement();

        // render
        // if (controls) controls.update();
        renderer.render(scene, camera);

        pointLights.forEach((each) => {
            pointLightsZ.push(each.position.z);
        });

        for (let i = 0; i < pointLights.length; i++) {
            if (pointLights[i].position.z >= pointLightsZ[i] + 4) {
                upDown = false;
            } else if (pointLights[i].position.z <= pointLightsZ[i] - 4) {
                upDown = true;
            }

            if (upDown) {
                pointLights[i].position.lerp(new THREE.Vector3(pointLights[i].position.x, pointLights[i].position.y, pointLightsZ[i] + 15), 0.02);
            } else {
                pointLights[i].position.lerp(new THREE.Vector3(pointLights[i].position.x, pointLights[i].position.y, pointLightsZ[i] - 15), 0.02);
            }
        }
    }
}

async function loadBonus() {
    isBonus = true;
    window.addEventListener('load', async () => {
        settings = data.settings;
        document.body.style.background = `rgb(${settings.background})`;
        floorplan = data.bonusStage;
        await initGame()
            .then(scene.add(progress.shift()))
            .then(await loadCharacter(scene)
                .then(() => {
                    // limit frame rate based on the settings
                    fpsInterval = 1000 / settings.frameRate;
                    then = Date.now();
                    startTime = then;
                    animate();
                })
            );
    });

    defaultMapGeometry = new THREE.Vector3(
        -(Math.floor(data.floorplan[0].length / 2) * blockSize),
        -(Math.floor(data.floorplan[0].length / 2) * blockSize),
        (Math.ceil(data.floorplan.length / 2) * blockSize)
    );
}

async function loadCharacter(scene) {
    const objLoader = new OBJLoader();
    const mtlLoader = new MTLLoader();

    // set asset paths
    objLoader.setPath('data/objects/character/');
    mtlLoader.setPath('data/objects/character/');

    // load objects
    await mtlLoader.load('character.mtl', (materials) => {
        materials.preload();
        objLoader.setMaterials(materials);
        objLoader.load('character.obj', (object) => {
            // place character to the starting pos
            let pos = getActualPosition({
                x: initPos[litLightNum - 1].x,
                y: initPos[litLightNum - 1].y,
                z: initPos[litLightNum - 1].z
            });
            if (isBonus) {
                object.position.set(
                    Math.ceil(data.bonusStage[0].length / 2),
                    0,
                    Math.floor(data.bonusStage.length / 2)
                );
            } else {
                object.position.set(
                    pos.x,
                    pos.y,
                    pos.z
                );
            }
            object.rotation.set(0, Math.PI / 2, Math.PI / 2);
            object.scale.set(0.2, 0.2, 0.2);

            scene.add(object);
            character = object;
        });
    });
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

// ========== MOVEMNET + EVENT ==========
let applyGravity = () => {
    if (!isMoving) {
        gravityRay.set(character.position, new THREE.Vector3(0, 0, -1));
        // gravitty visualization for debugging
        // scene.add(new THREE.ArrowHelper(gravityRay.ray.direction, gravityRay.ray.origin, 300, 0xff0000, 0, 0));
        const standingPlatforms = gravityRay.intersectObjects(scene.children);
        if (standingPlatforms.length > 0) {
            let firstEncounter = standingPlatforms[0];
            if (firstEncounter.distance > 0) {
                character.position.set(character.position.x, character.position.y, character.position.z - GRAVITY);
            } else if (firstEncounter.distance < 0) {
                character.position.set(character.position.x, character.position.y, character.position.z + GRAVITY);
            }
        }
    }
}

let applyMovement = async () => {
    let currentPos = getMapLocation(character.position);

    // 保留进度触发逻辑
    for (let i = 0; i < DEST.length; i++) {
        if (currentPos.x === DEST[i].x && currentPos.y === DEST[i].y) {
            if(litLightNum === i + 1) {
                if(i === 3) { // Game end
                    showMessage("Congratulations! You have completed the game!", 5000);
                    setTimeout(() => {
                        localStorage.clear();
                        window.location.href = "index.html";
                    }, 5000);
                } else { // Enter new level
                    enterLight();
                }
            } else if (litLightNum > i + 1) {
                showMessage("You have already visited this place!");
            } else {
                showMessage("You have not yet unlocked this place!");
            }
        }
    }

    if (isMoving) {
        if (path.length === 0) {
            isMoving = false;
            MOUSE_POINTED.material.color.set(`rgb(${data.settings.cellColor})`);
        } else {
            let next = getActualPosition(path[0]);
            if (character.position.x > next.x) {
                character.rotation.set(Math.PI / 2, -Math.PI / 2, 0);
                character.position.set(character.position.x - MOVEMENT, character.position.y, character.position.z);
            } else if (character.position.x < next.x) {
                character.rotation.set(0, Math.PI / 2, Math.PI / 2);
                character.position.set(character.position.x + MOVEMENT, character.position.y, character.position.z);
            } else if (character.position.y > next.y) {
                character.rotation.set(Math.PI / 2, 0, 0);
                character.position.set(character.position.x, character.position.y - MOVEMENT, character.position.z);
            } else if (character.position.y < next.y) {
                character.rotation.set(-Math.PI / 2, 0, Math.PI);
                character.position.set(character.position.x, character.position.y + MOVEMENT, character.position.z);
            }

            if (character.position.x === next.x && character.position.y === next.y) {
                path.shift();
            }
        }
    }
}

function enterLight() {
    if(win) reruen;
    win = true;
    showMessage("You have entered the light!", 2000);
    pauseAudio();
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mousedown', onMouseDown);
    const updateData = {
        level: litLightNum,
        score: (gameData.score || 0) + 500,
        state: "world",
        gameMode: litLightNum % 3 + 1,
    }
    localStorage.setItem('gameData', JSON.stringify(updateData));
    console.log("Game data updated: ", updateData);
    localStorage.removeItem('positionData');

    setTimeout(() => {
        window.location.href = "world.html";
    }, 1000);
}

function showMessage(message, duration=2000, mode = 1) {
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
    }, duration);  // Message disappears after 3 seconds
}

// BFS pathfinding
let findPath = async (destination) => {
    let dest = getMapLocation(destination);
    let start = getMapLocation(character.position);

    // no need to calc this case
    if (dest.x === start.x && dest.y === start.y) {
        return [];
    }

    let destKey = `${dest.x}x${dest.y}`
    let queue = [start];
    let parents = {};

    while (queue.length > 0) {
        let curr = queue.shift();
        let currKey = `${curr.x}x${curr.y}`

        // no need to run any further
        if (currKey === destKey) {
            break;
        }

        // XM, XP, YM, YP
        let neighbors = [
            {z: curr.z, x: curr.x - 1, y: curr.y},
            {z: curr.z, x: curr.x + 1, y: curr.y},
            {z: curr.z, x: curr.x, y: curr.y - 1},
            {z: curr.z, x: curr.x, y: curr.y + 1}
        ];

        for (let i = 0; i < neighbors.length; i++) {
            const tempZ = neighbors[i].z;
            const tempX = neighbors[i].x;
            const tempY = neighbors[i].y;

            // do nothing if the neighbor is out of the grid
            if (tempX < 0 || tempX > data.floorplan[0].length - 1 ||
                tempY < 0 || tempY > data.floorplan[0].length - 1) {
                continue;
            }

            if (data.floorplan[tempZ][tempX][tempY] !== 1) {
                continue;
            }

            let temp = {
                z: tempZ,
                x: tempX,
                y: tempY
            }
            let tempKey = `${temp.x}x${temp.y}`

            if (tempKey in parents) {
                continue;
            }

            parents[tempKey] = {
                key: currKey,
                platform: curr
            };

            queue.push(neighbors[i]);
        }
    }

    // configure path
    let path = [];
    let backword = dest;

    while (backword !== start) {
        path.push(backword);

        const {key, platform} = parents[destKey];
        backword = platform;
        destKey = key;
    }
    let out = path.reverse();

    // make sure the character does not step on non-platform blocks
    for (let i = 0; i < DEST_BLACKLIST.length; i++) {
        if (out[out.length - 1].x === DEST_BLACKLIST[i].x &&
            out[out.length - 1].y === DEST_BLACKLIST[i].y) {
            out.pop();
            break;
        }
    }
    return out;
}

// map coordinates: { z, x, y }
let getMapLocation = (vectorLocation) => {
    return {
        z: Math.ceil(Math.abs(vectorLocation.z / 20 - 11)),
        x: Math.ceil(vectorLocation.x / 20 + 6),
        y: Math.ceil(vectorLocation.y / 20 + 6)
    }
}

let getActualPosition = (mapVector) => {
    return new THREE.Vector3(
        mapVector.x === undefined ? 0 : defaultMapGeometry.x + (mapVector.x * blockSize),
        mapVector.y === undefined ? 0 : defaultMapGeometry.y + (mapVector.y * blockSize),
        mapVector.z === undefined ? 0 : defaultMapGeometry.z - (mapVector.z * blockSize)
    );
}

// ========== MOUSE ACTION ==========
function mouseListener() {
    renderer.domElement.addEventListener('mousemove', onMouseMove, false);
    renderer.domElement.addEventListener('mousedown', onMouseDown, false);
    renderer.domElement.addEventListener('touchstart', onMouseDown, false);
}

let onMouseDown = async (event) => {
    if(autoMusicTrigger){
        bgm.play();
        autoMusicTrigger = false;
        showMessage("Music is playing!");
    }

    // controls.autoRotate = false;
    if (isMobile()) {
        mouse.x = (event.changedTouches[0].clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.changedTouches[0].clientY / window.innerHeight) * 2 + 1;
    }

    mousePointer.setFromCamera(mouse, camera);
    let intersects = mousePointer.intersectObjects(scene.children);

    if (intersects.length === 0) return;
    let target;
    for (let i = 0; i < intersects.length; i++) {
        if (intersects[i].object.type === TYPE_PLATFORM) {
            target = intersects[i].object;
            break;
        }
    }
    if (target.draggable === true)
        dragging = true;

    if (MOUSE_POINTED !== target &&
        target.position.z === Math.floor(data.floorplan.length / 2)) {
        MOUSE_POINTED = target;
        if (MOUSE_POINTED !== blockOnCursor) {
            if (blockOnCursor !== undefined) blockOnCursor.material.color.set(`rgb(${data.settings.cellColor})`);
            blockOnCursor = MOUSE_POINTED;
            blockOnCursor.material.color.set(0xFFFFFF);
        }
    }

    if (MOUSE_POINTED) {
        MOUSE_POINTED.material.color.set(0xFFFFFF);
        isMoving = true;
        path = await findPath(MOUSE_POINTED.position);
    }
}

let onMouseMove = (event) => {
    event.preventDefault();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    if (dragging && selectedObject) {
        mousePointer.setFromCamera(mouse, camera);
        const intersects = mousePointer.intersectObject(scene.children[0]); // 假设地面是 scene.children[0]
        if (intersects.length > 0) {
            const intersectPoint = intersects[0].point;
            selectedObject.position.x = intersectPoint.x;
            selectedObject.position.y = intersectPoint.y;
        }
    }
}

window.addEventListener('mouseup', () => {
    dragging = false;
    selectedObject = null;
});

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

// ========== GAME ENTRY ==========
loadGame();