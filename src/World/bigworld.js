import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from "three/addons/controls/OrbitControls.js";

let scene, camera, renderer, character, characterBox;
let keys = {}; // 用于存储键盘按键状态
let velocity = new THREE.Vector3(); // 移动速度
let canJump = false; // 是否可以跳跃
let rotation = new THREE.Vector2(); // 鼠标控制角色旋转

const GRAVITY = -5; // 重力加速度
const MOVE_SPEED = 10; // 移动速度
const JUMP_SPEED = 7; // 跳跃速度

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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // 加载主场景
    const loader = new GLTFLoader();
    loader.load(
        'data/models/the_room.glb', // 主场景模型路径
        (gltf) => {
            const mainScene = gltf.scene;
            mainScene.scale.set(1, 1, 1);
            scene.add(mainScene);

            // 加载角色模型
            loadCharacter();
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

function loadCharacter() {
    const loader = new GLTFLoader();
    loader.load(
        'data/models/cube_character.glb', // 角色模型路径
        (gltf) => {
            character = gltf.scene;
            character.scale.set(2, 2, 2); // 缩放角色
            character.position.set(0, 1, 0); // 初始位置
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

    // 跳跃与重力
    if (keys['Space'] && canJump) {
        velocity.y = JUMP_SPEED;
        canJump = false; // 跳跃中不能再次跳跃
    }
    velocity.y += GRAVITY * delta; // 应用重力
    character.position.y += velocity.y;

    // 碰撞检测与地面处理
    if (character.position.y <= 1) {
        velocity.y = 0;
        character.position.y = 1; // 保持在地面
        canJump = true;
    }

    // 更新碰撞盒
    characterBox.setFromObject(character);
}

// 更新角色朝向
function updateRotation() {
    character.rotation.y = rotation.x; // 基于鼠标的水平旋转更新角色的朝向
}

init();