import { canvas } from './pianoRoll.js'
import { spatialIndex } from './hashTable.js';

const cellWidth = 100;

const visibleRange = 88;        // 显示 88 个音高
const bottomPitch = 21;         // 最底音 A0
const topPitch = bottomPitch + visibleRange - 1;
const noteHeight = 18;
const timeScale = 200;

// 二维映射
export function buildNoteIndex(allNotes) {
    spatialIndex.clear();
    for (const note of allNotes.values()) {
        const pitch = note.note.midi;  // 或者 note.midi
        const startBlock = Math.floor(note.x / cellWidth);
        const endBlock = Math.floor((note.x + note.width) / cellWidth);

        if (!spatialIndex.has(pitch)) {
            spatialIndex.set(pitch, new Map());
        }

        const xMap = spatialIndex.get(pitch);
        for (let i = startBlock; i <= endBlock; i++) {
            if (!xMap.has(i)) xMap.set(i, new Set());
            xMap.get(i).add(note);
        }
    }
}

export function locate(x, y, tolerance = 3) {
    const pitch = yToPitch(y);  // 根据 y 坐标反推音高（比如 60 - 108）
    const blockIndex = Math.floor(x / cellWidth);

    const xMap = spatialIndex.get(pitch);
    if (!xMap) return null;

    const candidateNotes = new Set();

    // 检查临近几个格子，避免刚好边界出错
    for (let i = blockIndex - 1; i <= blockIndex + 1; i++) {
        if (xMap.has(i)) {
            for (const note of xMap.get(i)) {
                candidateNotes.add(note);
            }
        }
    }

    // 精确碰撞检测
    for (const note of candidateNotes) {
        if (
            x >= note.x - tolerance &&
            x < note.x + note.width + tolerance &&
            y >= note.y - tolerance &&
            y < note.y + note.height + tolerance
        ) {
            return note;
        }
    }

    return null;
}

// 按pitch/midi映射
// floor可能存在问题？
export function yToPitch(y) {
    const row = Math.floor((canvas.height - y) / noteHeight);  // 从底部反推行数
    return bottomPitch + row;
}

export function pitchToY(pitch) {
    const row = pitch - bottomPitch;
    return canvas.height - row * noteHeight;
}

export function removeNoteFromSpatialIndex(note) {
    const pitch = note.note.midi;
    const startBlock = Math.floor(note.x / cellWidth);
    const endBlock = Math.floor((note.x + note.width) / cellWidth);

    const xMap = spatialIndex.get(pitch);
    if (!xMap) {
        console.warn("Cannot find corresponding xMap");
        return;
    }

    for (let i = startBlock; i <= endBlock; i++) {
        const noteSet = xMap.get(i);
        if (noteSet) {
            // 可能产生大问题
            noteSet.delete(note);
            // 可选：若该 Set 清空，则从 xMap 中删除该 block
            if (noteSet.size === 0) {
                xMap.delete(i);
            }
        }
    }

    // 可选：若该 pitch 已无 block，移除整个 pitch 层级
    if (xMap.size === 0) {
        spatialIndex.delete(pitch);
    }
}

export function addNoteToSpatialIndex(note) {
    const pitch = note.note.midi;
    const startBlock = Math.floor(note.x / cellWidth);
    const endBlock = Math.floor((note.x + note.width) / cellWidth);

    // 若当前 pitch 尚不存在，先初始化一层 map
    if (!spatialIndex.has(pitch)) {
        spatialIndex.set(pitch, new Map());
    }

    const xMap = spatialIndex.get(pitch);

    for (let i = startBlock; i <= endBlock; i++) {
        if (!xMap.has(i)) {
            xMap.set(i, new Set());
        }
        xMap.get(i).add(note);
    }
}





