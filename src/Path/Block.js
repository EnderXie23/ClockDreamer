// Block.js
import * as THREE from 'three';

class Block {
    constructor(type, position, geometryParams = {}) {
        this.type = type; // 'red', 'yellow', 'blue', 'black'
        this.color = this.getColor();
        this.geometry = new THREE.BoxGeometry(
            geometryParams.width || 1,
            geometryParams.height || 1,
            geometryParams.depth || 1
        );
        this.geometry.translate(
            geometryParams.translateX || 0,
            geometryParams.translateY || 0,
            geometryParams.translateZ || 0
        );
        this.material = new THREE.MeshBasicMaterial({ color: this.color });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.copy(position);
        this.isAnimating = false;
        this.animationParams = {};
        this.moveDirection = geometryParams.moveDirection || null;
        this.boundingBox = new THREE.Box3().setFromObject(this.mesh);
        this.isColliding = false;
    }

    // 根据类型返回颜色
    getColor() {
        const colors = {
            red: 0xff3300,
            yellow: 0xffcc00,
            blue: 0x0000ff,
            black: 0x000000
        };
        return colors[this.type] || 0xffffff;
    }

    // 将方块添加到场景中
    addToScene(scene) {
        scene.add(this.mesh);
    }

    // 启动方块的特定行为
    startAction() {
        if (this.type === 'red') {
            this.startRotationXoY();
        } else if (this.type === 'yellow') {
            // 黄色方块的拖动逻辑在主文件中处理，无需在这里启动
            console.log('黄色方块不执行自动移动，允许拖动');
        } else if (this.type === 'blue') {
            this.startRotationYoZ();
        }
        // 黑色方块不执行任何动作
    }

    // 红色方块绕 z 轴旋转（xoy 平面）
    startRotationXoY() {
        if (this.isAnimating) return;
        this.isAnimating = true;
        this.animationParams = {
            axis: new THREE.Vector3(0, 0, 1), // z轴旋转，相当于xoy平面
            speed: Math.PI / 180 * 2, // 每帧旋转2度
            totalRotation: 0,
            maxRotation: Math.PI / 2 // 旋转90度
        };
    }

    // 蓝色方块绕 x 轴旋转（yoz 平面）
    startRotationYoZ() {
        if (this.isAnimating) return;
        this.isAnimating = true;
        this.animationParams = {
            axis: new THREE.Vector3(1, 0, 0), // x轴旋转，相当于yoz平面
            speed: Math.PI / 180 * 2, // 每帧旋转2度
            totalRotation: 0,
            maxRotation: Math.PI / 2 // 旋转90度
        };
    }

    // 更新方块的动画
    update() {
        if (!this.isAnimating) return;

        if (this.type === 'red' || this.type === 'blue') {
            this.mesh.rotateOnAxis(this.animationParams.axis, this.animationParams.speed);
            this.animationParams.totalRotation += Math.abs(this.animationParams.speed);
            if (this.animationParams.totalRotation >= this.animationParams.maxRotation) {
                this.isAnimating = false;
                this.animationParams.totalRotation = 0;
            }
        }
        // 黄色方块的移动由主文件处理，因此无需在这里更新
    }

    // 碰撞检测方法（将在主文件中实现）
    checkCollisions() {
        return false;
    }
}

export default Block;
