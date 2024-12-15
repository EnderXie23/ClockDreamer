import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from "three/addons/controls/OrbitControls.js";

let scene, camera, renderer, character, characterBox;
let keys = {}; // 用于存储键盘按键状态
let velocity = new THREE.Vector3(); // 移动速度
let canJump = false; // 是否可以跳跃
let rotation = new THREE.Vector2(); // 鼠标控制角色旋转
let popupVisible = false; // 弹窗是否已显示

const GRAVITY = -0.5; // 重力加速度
const MOVE_SPEED = 5; // 移动速度
const JUMP_SPEED = 10; // 跳跃速度

const targetPosition = new THREE.Vector2(-0.51, 20.05); // 目标点（XZ 平面）

function init() {
    // 创建场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    // 创建相机
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 5, 10);

    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 添加光照
    const ambientLight = new THREE.AmbientLight(0xffffff, 3);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x228b22, 0.8);
    scene.add(hemisphereLight);

    // 加载主场景
    const loader = new GLTFLoader();
    loader.load(
        'data/models/the_room.glb', // 主场景模型路径
        (gltf) => {
            const mainScene = gltf.scene;
            mainScene.scale.set(0.1, 0.1, 0.1);
            scene.add(mainScene);

            // 加载角色模型
            loadCharacter();

            loadcamera();

            loadphoto();
        },
        undefined,
        (error) => {
            console.error('An error occurred while loading the main scene:', error);
        }
    );

    // 监听键盘事件
    window.addEventListener('keydown', (event) => {
        keys[event.code] = true;
    });
    window.addEventListener('keyup', (event) => {
        keys[event.code] = false;
    });

    // 监听鼠标移动（用于角色朝向）
    window.addEventListener('mousemove', (event) => {
        rotation.x -= event.movementX * 0.002; // 鼠标水平移动控制旋转
        rotation.y -= event.movementY * 0.002; // 鼠标垂直移动控制视角
        rotation.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotation.y)); // 限制垂直旋转范围
    });

    // 监听窗口大小变化
    window.addEventListener('resize', onWindowResize);

    // 开始渲染
    animate();
}

function loadcamera() {
    const loader = new GLTFLoader();
    loader.load(
        'data/models/sancamera.glb', // 门模型路径
        (gltf) => {
            const gate = gltf.scene;
            gate.scale.set(3, 3, 3); // 调整门的大小
            gate.position.set(-0.51, 4.00, 20.05); // 设置门的位置
            scene.add(gate);
            console.log('Gate loaded and added to the scene');
        },
        undefined,
        (error) => {
            console.error('An error occurred while loading the gate:', error);
        }
    );
}

function loadphoto() {
    const loader = new GLTFLoader();
    loader.load(
        'data/models/photo.glb', // 门模型路径
        (gltf) => {
            const gate = gltf.scene;
            gate.scale.set(0.6, 0.6, 0.6); // 调整门的大小
            gate.position.set(-0.5, 6.8, 1.88); // 设置门的位置
            scene.add(gate);
            console.log('Gate loaded and added to the scene');
        },
        undefined,
        (error) => {
            console.error('An error occurred while loading the gate:', error);
        }
    );
}
//x: -0.51, y: 5.00, z: 20.05
function loadCharacter() {
    const loader = new GLTFLoader();
    loader.load(
        'data/models/cube_character.glb', // 角色模型路径
        (gltf) => {
            character = gltf.scene;
            character.scale.set(0.5, 0.5, 0.5); // 缩放角色
            character.position.set(20, 5, 20); // 初始位置
            scene.add(character);

            // 初始化角色碰撞盒
            characterBox = new THREE.Box3().setFromObject(character);

            // 设置相机初始位置，绑定到角色
            camera.position.set(0, 1.5, 0); // 相机位于角色头部
            character.add(camera); // 将相机作为角色的子对象，跟随角色移动
        },
        undefined,
        (error) => {
            console.error('An error occurred while loading the character:', error);
        }
    );
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    if (character) {
        updateMovement();
        updateRotation();
        updateCoordinates(); // 更新坐标显示
        checkDistanceToTarget(); // 检查是否接近目标点
    }

    renderer.render(scene, camera);
}

// 更新角色移动
function updateMovement() {
    const delta = 0.016; // 假设每帧 16ms

    // 基于键盘输入的移动方向
    const direction = new THREE.Vector3();
    if (keys['KeyW']) direction.z -= MOVE_SPEED * delta; // 前
    if (keys['KeyS']) direction.z += MOVE_SPEED * delta; // 后
    if (keys['KeyA']) direction.x -= MOVE_SPEED * delta; // 左
    if (keys['KeyD']) direction.x += MOVE_SPEED * delta; // 右

    // 应用角色当前的旋转
    direction.applyEuler(new THREE.Euler(0, rotation.x, 0));

    // 更新角色位置
    character.position.add(direction);

    // // 跳跃与重力
    // if (keys['Space'] && canJump) {
    //     velocity.y = JUMP_SPEED;
    //     canJump = false; // 跳跃中不能再次跳跃
    // }
    // velocity.y += GRAVITY * delta; // 应用重力
    // character.position.y += velocity.y;
    //
    // // 碰撞检测与地面处理
    // if (character.position.y <= 1) {
    //     velocity.y = 0;
    //     character.position.y = 1; // 保持在地面
    //     canJump = true;
    // }

    // 更新碰撞盒
    characterBox.setFromObject(character);
}

// 更新角色朝向
function updateRotation() {
    character.rotation.y = rotation.x; // 基于鼠标的水平旋转更新角色的朝向
}

// 更新页面上的坐标显示
function updateCoordinates() {
    const coordinatesDiv = document.getElementById('coordinates');
    const { x, y, z } = character.position;
    coordinatesDiv.textContent = `x: ${x.toFixed(2)}, y: ${y.toFixed(2)}, z: ${z.toFixed(2)}`;
}
// 检查角色是否接近目标点
function checkDistanceToTarget() {
    const characterXZ = new THREE.Vector2(character.position.x, character.position.z);
    const distance = characterXZ.distanceTo(targetPosition);

    const popup = document.getElementById('popup');

    if (distance <= 4) {
        if (!popupVisible) {
            showPopup(); // 显示弹窗
            popupVisible = true;
        }
    } else {
        if (popupVisible) {
            hidePopup(); // 隐藏弹窗
            popupVisible = false;
        }
    }
}

function hidePopup() {
    const popup = document.getElementById('popup');
    popup.style.display = 'none';
}



function showPopup() {
    const popup = document.getElementById('popup');
    popup.style.display = 'block';

    // 动态绑定跳转逻辑
    const redirectButton = document.getElementById('redirectButton');
    redirectButton.addEventListener('click', () => {
        window.location.href = 'clock.html';
    });
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

init();