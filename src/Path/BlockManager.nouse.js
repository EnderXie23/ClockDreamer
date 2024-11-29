// BlockManager.js
import Block from './Block.nouse.js';
import * as THREE from 'three';

class BlockManager {
    constructor(scene) {
        this.scene = scene;
        this.blocks = [];
    }

    // 创建并添加方块
    createBlock(type, position, geometryParams = {}) {
        const block = new Block(type, position, geometryParams);
        block.addToScene(this.scene);
        this.blocks.push(block);
        return block;
    }

    // 更新所有方块
    update() {
        this.blocks.forEach(block => block.update());
    }

    // 获取所有可交互的方块
    getInteractableBlocks() {
        return this.blocks.map(block => block.mesh);
    }

    // 根据 mesh 对象找到对应的 Block 实例
    getBlockByMesh(mesh) {
        return this.blocks.find(block => block.mesh === mesh);
    }
}

export default BlockManager;
