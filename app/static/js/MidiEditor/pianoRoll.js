import SampleLibrary from '../lib/ToneInstruments.js';
import Piano from '/static/js/MidiEditor/piano.js';
import { MidiHistoryManager } from './MidiHistoryManager.js';
import { locate, buildNoteIndex, removeNoteFromSpatialIndex, addNoteToSpatialIndex } from './mapAndLocate.js';
import { allNotes, noteInTrackMap, noteToIndexMap, spatialIndex } from './hashTable.js';

const piano = new Piano();
// 页面加载完成后初始化钢琴
document.addEventListener('DOMContentLoaded', () => {
    piano.init('#piano-container');

    // ✅ 绑定快捷键处理函数
    document.addEventListener('keydown', (event) => {
        // 仅在非输入框/文本区域时处理快捷键
        const target = event.target;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
            historyManager.handleShortcut(event);
        }
    });
});

let midiData = null;
let currentMidi = null;
let historyManager = null;

// let synth = new Tone.PolySynth().toDestination();
let synth = SampleLibrary.load({
    instruments: "piano",
    onload: () => {
        console.log('音频加载完成');
        this.audioLoaded = true;
    }
});
let isPlaying = false;
export let trackVisibility = []; // 全局轨道可见性控制数组
// ✅ 新增：记录上一帧的进度线位置

export let canvas = document.getElementById("pianoRoll");
const ctx = canvas.getContext("2d");

const overlayCanvas = document.createElement("canvas");
// 会导致从父容器的最左边开始绘制，还有画布覆盖问题
overlayCanvas.style.position = "absolute";
overlayCanvas.style.top = "0";
overlayCanvas.style.left = "0";
overlayCanvas.style.pointerEvents = "none"; // 🔒 不遮挡鼠标事件
overlayCanvas.style.backgroundColor = "transparent"; // ⬅ 可省略，默认就是透明
// 为父容器添加子元素，也即为canvas的兄弟元素
canvas.parentNode.appendChild(overlayCanvas);
// canvas.parentNode.insertBefore(overlayCanvas, canvas.nextSibling);
overlayCanvas.style.zIndex = "2"; // 🔝 叠在上层
const overlayCtx = overlayCanvas.getContext("2d");
// overlayCanvas.style.border = "2px solid red";
overlayCanvas.style.minWidth = "3000px";

const noteHeight = 18;
const timeScale = 200;
const pitchBase = 21; // A0
const visibleRange = 88;

let isDragging = false;
let draggedNote = null;
let startX = 0;
let startY = 0;

canvas.height = noteHeight * visibleRange;
overlayCanvas.height = canvas.height;

const offscreenCanvas = document.createElement('canvas');
const offCtx = offscreenCanvas.getContext('2d');

offscreenCanvas.height = canvas.height;
offCtx.fillStyle = '#fff';

let hasModified = false; // 标记是否有修改
let choosedNote = null;      // 被选中的音符下标

let initDurationValue = -1; // 初始化值为选中音符的持续时间
let durationInput = -1;
let initWidth = -1;
const tolerance = 5;

// 滚动相关变量
let scrollX = 0;
let scrollY = 0;
let viewportWidth = canvas.clientWidth;
let viewportHeight = canvas.clientHeight;

const menu = document.getElementById('context-menu');

const setTimeBtn = document.getElementById('setTime');
const timeInputBox = document.getElementById('timeInputBox');
const timeInput = document.getElementById('timeInput');
const confirmTime = document.getElementById('confirmTime');

const showSliderBtn = document.getElementById('setDuration');
const sliderContainer = document.getElementById('sliderContainer');
const slider = document.getElementById('slider');
const valueDisplay = document.getElementById('valueDisplay');
const setSliderValue = document.getElementById('setSliderValue');
const resetSliderValue = document.getElementById('resetSlider');


const addBtn = document.getElementById('addOneNote');
const addBtnContainer = document.getElementById('addBtnContainer');
const addNoteContainer = document.getElementById('addNoteContainer');

const trackInputBox_add = document.getElementById('trackInputBox-add');
const trackInput_add = document.getElementById('trackInput-add');

const timeInputBox_add = document.getElementById('timeInputBox-add');
const timeInput_add = document.getElementById('timeInput-add');

const nameInputBox_add = document.getElementById('nameInputBox-add');
const nameInput_add = document.getElementById('nameInput-add');

const sliderContainer_add = document.getElementById('sliderContainer-add');
const slider_add = document.getElementById('slider-add');
const valueDisplay_add = document.getElementById('valueDisplay-add');

const confirmBtn = document.getElementById('confirm-add');
const resetBtn = document.getElementById('reset-add');

const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');


document.getElementById("canvasWrapper").addEventListener("scroll", (e) => {
    const scrollLeft = e.target.scrollLeft;
    overlayCanvas.style.transform = `translateX(${-scrollLeft}px)`;
});

// 捕获未处理的异常
window.addEventListener('error', (error) => {
    console.error('Global hidden error:', error.message);
});

addBtn.addEventListener('click', (e) => {
    if (!currentMidi) return;

    addBtnContainer.style.display = 'none'; // 隐藏添加按钮容器

    addNoteContainer.style.top = `${e.pageY}px`;
    addNoteContainer.style.left = `${e.pageX}px`;
    addNoteContainer.style.display = 'block';

    trackInput_add.value = 0; // 设置初始轨道索引为当前选中的轨道

    timeInput_add.value = 1; // 设置初始时间为0

    nameInput_add.value = 'G3'; // 设置初始音符名称鼠标所在位置

    slider_add.value = 1; // 设置滑块初始值
    valueDisplay_add.textContent = slider_add.value;
});

let oldObj = null;
function updatePreview() {
    const trackIndex = parseInt(trackInput_add.value, 10);
    const newTime = parseFloat(timeInput_add.value);
    const newDuration = parseFloat(slider_add.value);
    const newName = nameInput_add.value.trim();
    const newMidi = noteNameToMidi(newName);

    const track = currentMidi.tracks[trackIndex];
    if (!track) {
        console.warn("Track not found");
        return;
    }

    // 第二次开始删除旧的音符块
    if (oldObj) {
        ctx.clearRect(oldObj.x, oldObj.y, oldObj.width, oldObj.height);
    }

    let isValid = true;
    let newNote = null;
    let noteObj = null;
    if (!isNaN(newTime) && newTime !== '' && !isNaN(newDuration) && newDuration > 0 && newName !== '' && trackIndex !== '') {
        // const track = currentMidi.tracks[trackIndex];
        newNote = {
            time: newTime,
            duration: newDuration,
            name: newName,
            midi: newMidi
        };

        const x = newNote.time * timeScale;
        const y = canvas.height - ((newNote.midi - pitchBase + 1) * noteHeight);
        const width = newNote.duration * timeScale;
        const height = noteHeight - 1;
        noteObj = {
            note: newNote,
            x,
            y,
            width,
            height,
            trackIndex
        };
        // 一旦调用就进行更新
        oldObj = { ...noteObj };
    }
    else {
        alert("请确保输入的时间、持续时间和音符名称有效！");
        isValid = false;
    }

    if (!isValid) {
        return;
    }

    ctx.fillStyle = getColor(noteObj.trackIndex);
    ctx.fillRect(noteObj.x, noteObj.y, noteObj.width, noteObj.height);

    ctx.drawImage(offscreenCanvas, scrollX, scrollY, viewportWidth, viewportHeight, scrollX, scrollY, viewportWidth, viewportHeight);
}

function isValidNoteName(name) {
    // 允许 A-G 开头，后跟 # 或 b 可选，再跟 0-9 的数字
    return /^[A-G](#|b)?\d$/.test(name);
}

trackInput_add.addEventListener('input', () => {
    if (trackInput_add.value !== '') {
        updatePreview();
    }
});

timeInput_add.addEventListener('input', () => {
    if (timeInput_add.value !== '') {
        updatePreview();
    }
});

slider_add.addEventListener('input', () => {
    valueDisplay_add.textContent = slider_add.value;
    updatePreview();
});

nameInput_add.addEventListener('input', () => {
    if (isValidNoteName(nameInput_add.value)) {
        updatePreview();
    }
});

confirmBtn.addEventListener('click', () => {
    let noteObj = null;

    const trackIndex = parseInt(trackInput_add.value, 10);
    const newTime = parseFloat(timeInput_add.value);
    const newDuration = parseFloat(slider_add.value);
    const newName = nameInput_add.value.trim();
    const newMidi = noteNameToMidi(newName);

    let newNote = null;
    let isValid = true;
    if (!isNaN(newTime) && newTime !== '' && !isNaN(newDuration) && newDuration > 0 && newName !== '' && trackIndex !== '') {
        const track = currentMidi.tracks[trackIndex];
        newNote = {
            time: newTime,
            duration: newDuration,
            name: newName,
            midi: newMidi
        };

        track.notes.push(newNote); // 添加到轨道的notes数组中
        track.notes.sort((a, b) => a.time - b.time); // 确保按时间排序

        const x = newNote.time * timeScale;
        const y = canvas.height - ((newNote.midi - pitchBase + 1) * noteHeight);
        const width = newNote.duration * timeScale;
        const height = noteHeight - 1;
        noteObj = {
            note: newNote,
            x,
            y,
            width,
            height,
            trackIndex
        };

        // 添加到全局音符数组
        const key = `${noteObj.trackIndex}-${noteObj.note.time}-${noteObj.note.midi}`;  // 自定义哈希键
        allNotes.set(key, noteObj);  // 存入哈希表 
        noteInTrackMap.set(key, newNote);
        // 如何优化？
        const idx = track.notes.findIndex(note => note === newNote);
        noteToIndexMap.set(key, { trackIndex, idx });
    }
    else {
        alert("请确保输入的时间、持续时间和音符名称有效！");
        isValid = false;
    }

    addNoteContainer.style.display = 'none';

    if (!isValid) {
        return;
    }

    // 只绘制该音符即可
    ctx.fillStyle = getColor(noteObj.trackIndex);
    ctx.fillRect(noteObj.x, noteObj.y, noteObj.width, noteObj.height);

    // // ✅ 添加历史记录：添加音符
    historyManager.addNote(trackIndex, noteObj); // 自动处理轨道和位置

    hasModified = true; // 标记为已修改
});

resetBtn.addEventListener('click', () => {
    addNoteContainer.style.display = 'none';
    // 预览是通过数组的副本实现的
    redrawCanvas(currentMidi);
});

function noteNameToMidi(noteName) {
    const noteRegex = /^([A-Ga-g])(#|b)?(\d+)$/;
    const match = noteName.match(noteRegex);
    if (!match) throw new Error("Invalid note name: " + noteName);

    const [, letter, accidental, octaveStr] = match;
    const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const base = semitones[letter.toUpperCase()];
    const accidentalOffset = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
    const octave = parseInt(octaveStr, 10);

    return (octave + 1) * 12 + base + accidentalOffset;
}

// 尽量少使用，容易降低性能
function redrawCanvas(midi) {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // 清除画布
    ctx.drawImage(offscreenCanvas, 0, 0); // 绘制网格

    console.log("redrawCanvas triggered");

    midi.tracks.forEach((track, trackIndex) => {
        if (!trackVisibility[trackIndex]) return;
        track.notes.forEach(note => {
            const x = note.time * timeScale;
            const y = canvas.height - ((note.midi - pitchBase + 1) * noteHeight);
            const width = note.duration * timeScale;
            const height = noteHeight - 1;
            ctx.fillStyle = getColor(trackIndex);
            ctx.fillRect(x, y, width, height);
        });
    });
}

// 封装的异步版本
function redrawCanvasAsync(midi) {
    return new Promise((resolve) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // 清除画布
        ctx.drawImage(offscreenCanvas, 0, 0); // 绘制网格

        console.log("redrawCanvas triggered");

        midi.tracks.forEach((track, trackIndex) => {
            if (!trackVisibility[trackIndex]) return;
            track.notes.forEach(note => {
                const x = note.time * timeScale;
                const y = canvas.height - ((note.midi - pitchBase + 1) * noteHeight);
                const width = note.duration * timeScale;
                const height = noteHeight - 1;
                ctx.fillStyle = getColor(trackIndex);
                ctx.fillRect(x, y, width, height);
            });
        });

        // 等下一帧绘制完成后再 resolve，保证视觉一致性
        requestAnimationFrame(() => resolve());
    });
}

// 显示菜单
canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault(); // 阻止默认菜单

    const rect = canvas.getBoundingClientRect();
    const scrollTop = canvas.scrollTop;   // 获取滚动容器滚动值
    const scrollLeft = canvas.scrollLeft;
    const x = e.clientX - rect.left + scrollLeft;                // 网页左上角为原点
    const y = e.clientY - rect.top + scrollTop;
    // choosedNote = allNotes.find(note => {
    //     return x >= note.x - tolerance && x < note.x + note.width + tolerance && y >= note.y - tolerance && y < note.y + note.height + tolerance;       // 定位选中的音符
    // });

    // 传引用获取目标choosedNote
    choosedNote = locate(x, y, tolerance);

    if (choosedNote) {
        // 展示menu时隐藏add相关的元素
        addBtnContainer.style.display = 'none';
        addNoteContainer.style.display = 'none';
        console.log(`x = ${x}, y = ${y}`);
        console.log(`chooseNote = ${choosedNote.note.name}, x->[${choosedNote.x}, ${choosedNote.x + choosedNote.width}], y->[${choosedNote.y}, ${choosedNote.y + choosedNote.height}]`);
    }
    else {
        console.warn("contextmenu没有选中音符");
        console.warn(`x = ${x}, y = ${y}`);
        // 使用 pageY 和 pageX 来考虑页面滚动位置
        addBtnContainer.style.top = `${e.pageY}px`;   // 在鼠标点下方偏移一点
        addBtnContainer.style.left = `${e.pageX}px`; // 在鼠标点右侧偏移一点
        addBtnContainer.style.display = 'block';
        // 记得隐藏其他菜单
        menu.style.display = 'none';

        // 给历史记录按键一同隐藏
        const contextMenu = document.getElementById('history-context-menu');
        contextMenu.classList.remove('show');
        contextMenu.style.display = 'none';

        return; // 没有选中音符
    }

    // 设置菜单位置
    menu.style.top = `${e.pageY}px`;
    menu.style.left = `${e.pageX}px`;
    menu.style.display = 'block';

    initDurationValue = String(choosedNote.note.duration);
    durationInput = parseFloat(initDurationValue);

    slider.value = initDurationValue; // 设置滑块初始值
    valueDisplay.textContent = slider.value;

    initWidth = choosedNote.width; // 记录初始宽度
});

// 点击页面其他地方隐藏菜单 --> 点击菜单中的按键有无影响？
document.addEventListener('click', () => {
    menu.style.display = 'none';
});

setTimeBtn.addEventListener('click', (e) => {
    if (!choosedNote) return;

    // 设置初值和位置
    timeInput.value = choosedNote.note.time;
    timeInputBox.style.top = `${e.pageY}px`;
    timeInputBox.style.left = `${e.pageX}px`;
    timeInputBox.style.display = 'block';
});

confirmTime.addEventListener('click', () => {
    const newTime = parseFloat(timeInput.value);
    if (!isNaN(newTime)) {
        const track = currentMidi.tracks[choosedNote.trackIndex];
        // const noteInTrack = track.notes.find(note => note === choosedNote.note);
        const key = `${choosedNote.trackIndex}-${choosedNote.note.time}-${choosedNote.note.midi}`;
        const noteIndex = noteToIndexMap.get(key).idx;
        const noteInTrack = track.notes[noteIndex];

        // 修改choosedNote之前进行保存
        const oldNote = { ...choosedNote };

        // ✅ 添加历史记录：修改音符时间
        historyManager.modifyNoteTime(choosedNote.trackIndex, oldNote, newTime); // 在修改前记录下来

        if (noteInTrack) {
            noteInTrack.time = newTime;
            choosedNote.note.time = newTime;
            choosedNote.x = newTime * timeScale;

            // redrawCanvas(currentMidi); // 重新绘制画布
            redrawNote(oldNote, choosedNote);
        }
    }
    timeInputBox.style.display = 'none';

    ctx.drawImage(offscreenCanvas, scrollX, scrollY, viewportWidth, viewportHeight, scrollX, scrollY, viewportWidth, viewportHeight);
});

export function deleteByNoteInAll(noteInAllNotes) {
    const key = `${noteInAllNotes.trackIndex}-${noteInAllNotes.note.time}-${noteInAllNotes.note.midi}`;  // 自定义哈希键
    if (allNotes.get(key)) {
        allNotes.delete(key);
        console.log("Delete note from allNotes");
        return;
    }
    console.error("Cannot find note in allNotes");
    return;
}

export function deleteByNoteInTrack(allNotesMap, noteInTrack) {
    // 这里也可以做直接映射
    for (const [key, value] of allNotesMap.entries()) {
        if (value.note === noteInTrack) {
            allNotesMap.delete(key);
            return true;
        }
    }
    return false;
}

const deleteBtn = document.getElementById('delete');

deleteBtn.addEventListener('click', (e) => {
    if (!choosedNote) return; // 没有选中音符

    const backupNote = { ...choosedNote };

    const x = choosedNote.x;
    const y = choosedNote.y;

    ctx.clearRect(x, y, choosedNote.width, choosedNote.height); // 清除选中的音符

    const track = currentMidi.tracks[choosedNote.trackIndex];
    // const noteIndex = track.notes.findIndex(n => n === choosedNote.note);
    const key = `${choosedNote.trackIndex}-${choosedNote.note.time}-${choosedNote.note.midi}`;
    const noteIndex = noteToIndexMap.get(key).idx;
    console.log(`delete ${choosedNote.note.name}`);

    if (noteIndex > -1) {
        track.notes.splice(noteIndex, 1); // 删除选中的音符
        noteToIndexMap.delete(key);
        noteInTrackMap.delete(key);
    }


    // 有问题???
    // const choosedIndex = allNotes.findIndex(note => note === choosedNote.note);

    // allNotes.splice(choosedIndex, 1); // 删除选中的音符

    deleteByNoteInAll(choosedNote);

    // ✅ 添加历史记录：删除音符
    historyManager.deleteNote(choosedNote.trackIndex, backupNote);

    // showMidi(currentMidi);

    menu.style.display = 'none';

    // 部分网格被连同音符一起消去，需要重绘
    // 绘制可见区域内的网格
    ctx.drawImage(offscreenCanvas, scrollX, scrollY, viewportWidth, viewportHeight, scrollX, scrollY, viewportWidth, viewportHeight);
});

export function showMidi(midi) {
    const track = midi.tracks[0];
    track.notes.forEach(note => {
        console.log(`Piano Roll midi has note ${note.name}`);
    })
}

showSliderBtn.addEventListener('click', (e) => {
    sliderContainer.style.top = `${e.pageY}px`;
    sliderContainer.style.left = `${e.pageX}px`;
    sliderContainer.style.display = 'block';
});

function redrawNote(oldNote, newNote) {
    ctx.clearRect(oldNote.x, oldNote.y, oldNote.width, oldNote.height);
    ctx.fillStyle = getColor(newNote.trackIndex);
    ctx.fillRect(newNote.x, newNote.y, newNote.width, newNote.height);
}

// 滑动时更新显示的值
slider.addEventListener('input', () => {
    valueDisplay.textContent = slider.value;
    durationInput = parseFloat(slider.value);

    // 保存旧状态的choosedNote
    const oldNote = { ...choosedNote };

    const track = currentMidi.tracks[choosedNote.trackIndex];
    // const choosedNoteInNotes = track.notes.find(note => note === choosedNote.note);
    const key = `${choosedNote.trackIndex}-${choosedNote.note.time}-${choosedNote.note.midi}`;
    const noteIndex = noteToIndexMap.get(key).idx;
    const choosedNoteInNotes = track.notes[noteIndex];

    if (choosedNoteInNotes && choosedNote) {
        choosedNoteInNotes.duration = durationInput;
        choosedNote.width = durationInput * timeScale; // 更新选中音符的宽度

        // redrawCanvas(currentMidi); // 重新绘制画布
        redrawNote(oldNote, choosedNote);
    }
    else {
        console.warn("notes中找不到对应音符");
    }
});

setSliderValue.addEventListener('click', () => {
    // ✅ 添加历史记录：修改音符持续时间
    const initDuration = parseFloat(initDurationValue);
    const newDuration = parseFloat(slider.value);
    const changedNote = { ...choosedNote };

    historyManager.modifyNote(changedNote.trackIndex, changedNote, initDuration, newDuration);        // newDuration重新定义

    sliderContainer.style.display = 'none';

    hasModified = true; // 标记为已修改

    ctx.drawImage(offscreenCanvas, scrollX, scrollY, viewportWidth, viewportHeight, scrollX, scrollY, viewportWidth, viewportHeight);
});

resetSliderValue.addEventListener('click', () => {
    if (initWidth > -1) {
        const track = currentMidi.tracks[choosedNote.trackIndex];
        const choosedNoteInNotes = track.notes.find(note => note === choosedNote.note);
        choosedNoteInNotes.duration = initWidth / timeScale; // 恢复初始持续时间
        choosedNote.width = initWidth; // 更新选中音符的宽度
        redrawCanvas(currentMidi); // 重新绘制画布
    }

    sliderContainer.style.display = 'none';
});


let dragCount = 0;
let noteBeforeDrag = null;
canvas.addEventListener('mousedown', (e) => {
    if (menu.contains(e.target) || sliderContainer.contains(e.target)) {
        console.warn("mousedown error");
        return;
    }
    if (e.button !== 0) {
        return; // 只处理左键点击
    }

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;                // 网页左上角为原点
    const y = e.clientY - rect.top;

    // 点击任意地方鼠标隐藏
    addBtnContainer.style.display = 'none';
    menu.style.display = 'none';
    addNoteContainer.style.display = 'none';

    draggedNote = locate(x, y, tolerance);
    // locate之后立即删除，反正在mouseup之后还会将新的添加进去
    // 无法删除？

    if (draggedNote) {
        console.log("Drag begins");
        removeNoteFromSpatialIndex(draggedNote);

        isDragging = true;
        startX = x;
        startY = y;

        dragCount++;
        noteBeforeDrag =
        {
            ...draggedNote,
            note: JSON.parse(JSON.stringify(draggedNote.note))   // 单独复制 note 对象，断开引用关系 ！！！
        };

        if (!noteBeforeDrag) {
            console.warn("noteBeforeDrag is null");
        }

        if (!dragCount) {
            historyManager.beginBatch("拖拽音符*1"); // 开始批量操作
        }
    }
    else {
        console.warn("Cannot find draggedNote");
    }
});

// 辅助函数：检查点是否在元素内
function isPointInElement(x, y, element) {
    const rect = element.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

let oldNote = null;
canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const dx = x - startX;
        const dy = y - startY;

        oldNote = { ...draggedNote };

        draggedNote.x += dx;
        draggedNote.y += dy;
        startX = x;
        startY = y;

        const track = currentMidi.tracks[draggedNote.trackIndex];
        if (draggedNote) {
            // track.notes.find(note => note === draggedNote.note).time = draggedNote.x / timeScale; // 更新时间 --> 影响接下来的绘制
            let key = `${draggedNote.trackIndex}-${draggedNote.note.time}-${draggedNote.note.midi}`;
            const noteInTrack = noteInTrackMap.get(key);
            if (noteInTrack) {
                noteInTrack.time = draggedNote.x / timeScale; // 更新时间
            }
        }

        ctx.clearRect(oldNote.x, oldNote.y, oldNote.width, oldNote.height);
        // 绘制可见区域内的网格
        ctx.drawImage(offscreenCanvas, scrollX, scrollY, viewportWidth, viewportHeight, scrollX, scrollY, viewportWidth, viewportHeight);
        ctx.fillStyle = getColor(draggedNote.trackIndex);
        ctx.fillRect(draggedNote.x, draggedNote.y, draggedNote.width, draggedNote.height);

        // smoothScrollToNote(draggedNote);
    }
});

// 鼠标抬起后，更新note的性质
canvas.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;

    if (isDragging) {
        isDragging = false;
        oldNote = { ...draggedNote };

        // 新的y需要更新到画布上
        const nearestY = Math.round(draggedNote.y / noteHeight) * noteHeight;
        draggedNote.y = nearestY;

        const track = currentMidi.tracks[draggedNote.trackIndex];

        // 此时noteInTrackMap还未更新（无法随着mousemove同步更新），无法直接使用
        // draggedNote.note和track.notes引用断开
        const keyForSearch = `${noteBeforeDrag.trackIndex}-${noteBeforeDrag.note.time}-${noteBeforeDrag.note.midi}`;
        const oldNoteInTrack = noteInTrackMap.get(keyForSearch);

        if (draggedNote) {
            draggedNote.note.time = draggedNote.x / timeScale;
            const newNote = pitchBase + visibleRange - 1 - draggedNote.y / noteHeight;
            const clampedMidi = getNoteName(newNote);
            if (newNote)
                draggedNote.note.midi = newNote;
            if (clampedMidi)
                draggedNote.note.name = clampedMidi;      // 播放时使用字符串

            oldNoteInTrack.time = draggedNote.note.time; // 更新时间
            oldNoteInTrack.midi = draggedNote.note.midi; // 更新音高
            oldNoteInTrack.name = draggedNote.note.name; // 更新音符名称

            console.log(`Dragged note updated to ${draggedNote.note.name} at time ${draggedNote.note.time}`);
        }

        track.notes.sort((a, b) => a.time - b.time);

        // 更新映射关系
        const key = `${draggedNote.trackIndex}-${draggedNote.note.time}-${draggedNote.note.midi}`;
        allNotes.set(key, draggedNote);
        noteInTrackMap.set(key, draggedNote.note);
        // 如何优化？
        console.log(track.notes);
        console.log(draggedNote.note);
        // 使用这种方式稳定 ！！！不需要被引用困扰
        const idx = track.notes.findIndex(note => note.time === draggedNote.note.time && note.midi === draggedNote.note.midi && note.duration === draggedNote.note.duration);
        console.log(`In drag note, get idx = ${idx}`);
        const trackIndex = draggedNote.trackIndex;
        noteToIndexMap.set(key, { trackIndex, idx });
        // important
        addNoteToSpatialIndex(draggedNote);

        const key2 = `${noteBeforeDrag.trackIndex}-${noteBeforeDrag.note.time}-${noteBeforeDrag.note.midi}`;
        allNotes.delete(key2);
        noteInTrackMap.delete(key2);
        noteToIndexMap.delete(key2);

        // ✅ 添加历史记录：记录拖拽前后的音符状态
        historyManager.recordNoteDrag(
            draggedNote.trackIndex,
            // 浅拷贝
            noteBeforeDrag, // 原始值（拖拽前）
            draggedNote // 新值（拖拽后）
        );

        // 性能还能提高
        // 重新绘制自动挪移的音符
        if (!oldNote) {
            console.warn("old note not defined");
            return;
        }
        ctx.clearRect(oldNote.x, oldNote.y, oldNote.width, oldNote.height);
        ctx.fillStyle = getColor(draggedNote.trackIndex);
        ctx.fillRect(draggedNote.x, draggedNote.y, draggedNote.width, draggedNote.height);
        // 还可以优化
        // 绘制可见区域内的网格
        ctx.drawImage(offscreenCanvas, scrollX, scrollY, viewportWidth, viewportHeight, scrollX, scrollY, viewportWidth, viewportHeight);

        if (dragCount === 1) {
            historyManager.endBatch(); // 结束批量操作
            dragCount = 0;
        }

        hasModified = true; // 标记为已修改
        draggedNote = null; // 清除拖动的音符
    }
});

document.getElementById("midiFileInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) {
        alert("File not exists!");
        return;
    }

    const arrayBuffer = await file.arrayBuffer();
    midiData = new Midi(arrayBuffer);

    // 初始化轨道可见性（默认全部可见）
    trackVisibility = midiData.tracks.map(() => true);

    // 绘制钢琴卷帘
    drawPianoRoll(midiData);

    // 更新轨道控制面板
    updateTrackControls(midiData);

    drawSidebarNoteNames();

    currentMidi = midiData;

    // 初始化历史管理器
    historyManager = new MidiHistoryManager(currentMidi, allNotes, trackVisibility);

    initHistoryUI();
});

// 新增：初始化历史记录UI的函数
function initHistoryUI() {
    // 绑定撤销/重做按钮
    undoBtn.addEventListener('click', () => historyManager.undo());
    redoBtn.addEventListener('click', () => historyManager.redo());

    // 只重新绘制视口元素，优化性能
    historyManager.on('UNDO', (data) => {
        updateTrackControls(data);
        redrawCanvas(data);
    });

    // 初始化历史管理器后，立即绑定监听
    historyManager.on('CHANGE', (data) => {
        updateHistoryList(historyManager);
    });

    historyManager.on('REDO', (data) => {
        updateTrackControls(data);
        redrawCanvas(data);
    });
}

// 新增：轨道控制函数
function updateTrackControls(midi) {
    const trackControls = document.getElementById("trackControls");
    trackControls.innerHTML = ""; // 清空现有控件

    midi.tracks.forEach((track, trackIndex) => {
        const trackControl = document.createElement("div");         //出现新的轨道就会产生新的开关
        trackControl.className = "track-control";

        // 轨道颜色指示器
        const colorIndicator = document.createElement("div");
        colorIndicator.className = "track-color";
        colorIndicator.style.backgroundColor = getColor(trackIndex);

        // 轨道名称/编号
        const trackLabel = document.createElement("span");
        trackLabel.className = "track-label";
        trackLabel.textContent = `轨道 ${trackIndex + 1}`;

        // 轨道开关
        const trackToggle = document.createElement("input");
        trackToggle.type = "checkbox";
        trackToggle.checked = trackVisibility[trackIndex];
        trackToggle.addEventListener("change", () => {
            trackVisibility[trackIndex] = trackToggle.checked;
            redrawCanvas(midiData);
        });

        trackControl.appendChild(colorIndicator);
        trackControl.appendChild(trackLabel);
        trackControl.appendChild(trackToggle);
        trackControls.appendChild(trackControl);
    });
}

const playPauseBtn = document.getElementById("playBtn");
let hasScheduled = false;

let isTransitioning = false;
let parts = [];
playPauseBtn.addEventListener("click", async () => {
    if (isTransitioning) {
        console.warn("播放键被锁定");
        return;
    }
    isTransitioning = true;
    setTimeout(() => isTransitioning = false, 100); // 防止短时间重复点击

    if (!currentMidi) {
        console.log("currentMidi not defined");
        return;
    }

    if (!isPlaying) {
        isPlaying = true;
        playPauseBtn.textContent = "暂停";

        if (Tone.Transport.state === "stopped" || !hasScheduled || hasModified) {
            Tone.Transport.stop();
            Tone.Transport.cancel(); // 清除旧 scheduleOnce 调度

            // 清除旧 Part 实例
            clearParts();

            Tone.Transport.bpm.value = 120;

            let maxTime = 0;

            currentMidi.tracks.forEach((track, trackIndex) => {
                if (!trackVisibility[trackIndex]) return;

                const part = new Tone.Part((time, note) => {
                    synth.triggerAttackRelease(note.name, note.duration, time);
                }, track.notes.map(n => [n.time, n]));

                part.start(0); // 让所有 part 从 Transport 时间 0 开始
                parts.push(part);

                // 直接计算maxTime
                if (track.notes.length > 0) {
                    const lastNote = track.notes[track.notes.length - 1];
                    maxTime = Math.max(maxTime, lastNote.time + lastNote.duration);
                }
            });

            // 可选方案
            // currentMidi.tracks.forEach((track, trackIndex) => {
            //     if (!trackVisibility[trackIndex]) return;
            //     track.notes.forEach(note => {
            //         Tone.Transport.scheduleOnce((time) => {
            //             synth.triggerAttackRelease(note.name, note.duration, time);
            //             // setTimeout(() => {
            //             //     piano.triggerKeyByName(note.name, note.duration);
            //             // }, 10);
            //         }, note.time);
            //         maxTime = Math.max(maxTime, note.time + note.duration);
            //     });
            // });

            hasScheduled = true;
            Tone.Transport.start();

            if (Tone.Transport.state === 'started') {
                requestAnimationFrame(animatePlayhead);
            }

            // 播放结束重置状态
            Tone.Transport.scheduleOnce(() => {
                isPlaying = false;
                playPauseBtn.textContent = "播放";
                hasScheduled = false;

                // 释放资源
                clearParts();
            }, maxTime + 0.1);

            hasModified = false;

        } else {
            // 继续播放
            Tone.Transport.start();
            // // 恢复所有Part实例的播放
            // parts.forEach(part => part.start());
            if (Tone.Transport.state === 'started') {
                requestAnimationFrame(animatePlayhead);
            }
        }

    } else {
        // 暂停播放
        Tone.Transport.pause();
        // 会彻底停止所有Part实例
        // parts.forEach(part => part.stop());
        isPlaying = false;
        playPauseBtn.textContent = "播放";
    }
});

function clearParts() {
    parts.forEach(p => {
        p.stop();
        p.dispose();
    });
    parts = [];
}

const globalReset = document.getElementById("resetBtn");

globalReset.addEventListener("click", () => {
    Tone.Transport.stop();
    isPlaying = false;
    playPauseBtn.textContent = '播放';

    // 重绘音符和网格
    redrawCanvas(currentMidi);
});

// 新增：播放结束时的回调函数
function onPlaybackEnd() {
    console.log('播放结束，停止进度线动画');
    playPauseBtn.textContent = '播放';
    // 清除动画循环（若有残留的requestAnimationFrame）
    cancelAnimationFrame(animatePlayhead.id); // 需记录动画ID
}

function timeToX(timeInSeconds) {
    return timeInSeconds * timeScale;
}

let lastPlayheadX = null;

function drawPlayheadLine(x, height) {
    overlayCtx.save();
    overlayCtx.strokeStyle = 'red';
    overlayCtx.lineWidth = 2;
    overlayCtx.beginPath();
    overlayCtx.moveTo(x, 0);
    overlayCtx.lineTo(x, height);
    overlayCtx.stroke();
    overlayCtx.restore();
    console.log("Draw play line");
}

// 只清除旧进度线影响的区域 + 重绘音符
function eraseOldPlayhead(x, height) {
    const lineWidth = 2;
    const padding = 1;
    const clearX = x - lineWidth / 2 - padding;
    const clearWidth = lineWidth + 2 * padding;

    overlayCtx.clearRect(clearX, 0, clearWidth, height);
}

function animatePlayhead() {
    const currentTime = Tone.Transport.seconds;
    const scrollContainer = document.getElementById('canvasWrapper');
    const centerX = canvas.width / 2;
    const playheadX = timeToX(currentTime);

    const scrollTarget = Math.max(0, playheadX - centerX);
    scrollContainer.scrollLeft = scrollTarget;

    // // 擦除上一次的进度线及其影响范围
    // if (lastPlayheadX !== null) {
    //     // 在分层画布上擦除
    //     eraseOldPlayhead(lastPlayheadX, canvas.height);
    // }

    // const playheadScreenX = playheadX - scrollContainer.scrollLeft;
    // // 在分层画布上绘制
    // drawPlayheadLine(playheadScreenX, canvas.height);
    // lastPlayheadX = playheadScreenX;

    if (Math.abs(playheadX - lastPlayheadX) > 5) {
        eraseOldPlayhead(lastPlayheadX, canvas.height);
        const playheadScreenX = playheadX - scrollContainer.scrollLeft;
        drawPlayheadLine(playheadScreenX, canvas.height);
        lastPlayheadX = playheadScreenX;
    }

    // // 高亮当前播放音符（如果你希望这样）
    // highlightPlayingNotes(currentTime);

    if (currentTime < currentMidi.duration) {
        animatePlayhead.id = requestAnimationFrame(animatePlayhead);
    } else {
        Tone.Transport.stop();
        cancelAnimationFrame(animatePlayhead.id);
        onPlaybackEnd();
        // 不需要再重绘画布，删除最后一帧的进度线即可
        eraseOldPlayhead(lastPlayheadX, canvas.height);
        lastPlayheadX = null;
    }
}

// 使用时改进
function highlightPlayingNotes(currentTime) {
    // 遍历所有音符，找出正在播放的音符并高亮显示
    for (const thisNote of allNotes.values()) {
        if (trackVisibility[thisNote.trackIndex]) {
            if (thisNote.note.time <= currentTime && thisNote.note.time + thisNote.note.duration >= currentTime) {
                ctx.clearRect(thisNote.x, thisNote.y, thisNote.width, thisNote.height);
                ctx.fillStyle = 'rgba(255, 255, 0, 0.7)'; // 使用半透明黄色高亮
                ctx.fillRect(thisNote.x, thisNote.y, thisNote.width, thisNote.height);
            }
        }
    }
}

document.getElementById("exportBtn").addEventListener("click", () => {
    if (!currentMidi) return;
    const bytes = currentMidi.toArray();
    const blob = new Blob([bytes], { type: "audio/midi" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "NewMidi.mid";
    a.click();
    URL.revokeObjectURL(url);

    // 提供粗粒度的回溯功能
    historyManager.setSavePoint();
});

// 初始化滚动事件监听
function initScrollHandlers() {
    // 假设使用了滚动容器
    const scrollContainer = document.getElementById('canvasWrapper');
    if (!scrollContainer) {
        console.warn("Cannot find scroll container");
        return;
    }

    // 监听滚动事件
    scrollContainer.addEventListener('scroll', handleScroll);
}

// 节流控制变量
let isRendering = false;

// 处理滚动事件（节流版）
function handleScroll(e) {
    scrollX = e.target.scrollLeft;
    scrollY = e.target.scrollTop;

    // 如果当前已有一个绘制请求，则跳过
    if (!isRendering) {
        isRendering = true;
        requestAnimationFrame(() => {
            renderVisibleNotes();
            isRendering = false;
        });
    }
}

// 获取可见区域内的音符
function getVisibleNotes() {
    const startX = scrollX;
    const endX = scrollX + viewportWidth;
    const startY = scrollY;
    const endY = scrollY + viewportHeight;

    const visibleNotes = [];

    for (const note of allNotes.values()) {
        if (
            note.x + note.width >= startX &&
            note.x <= endX &&
            note.y + note.height >= startY &&
            note.y <= endY
        ) {
            visibleNotes.push(note);
        }
    }

    console.log(`Get ${visibleNotes.length} visible notes`);

    return visibleNotes;
}

// 只渲染可见区域内的音符
function renderVisibleNotes() {
    // 清除可见区域
    ctx.clearRect(scrollX, scrollY, viewportWidth, viewportHeight);

    // 绘制可见区域内的网格
    ctx.drawImage(offscreenCanvas, scrollX, scrollY, viewportWidth, viewportHeight, scrollX, scrollY, viewportWidth, viewportHeight);

    // 获取可见音符
    const visibleNotes = getVisibleNotes();

    console.log("Render visible notes");

    // 绘制可见音符
    visibleNotes.forEach(note => {
        ctx.fillStyle = getColor(note.trackIndex);
        ctx.fillRect(note.x, note.y, note.width, note.height);
    });
}

function smoothScrollToNote(note, duration = 300) {
    const scrollContainer = document.getElementById('canvasWrapper');
    if (!scrollContainer) return;

    const startX = scrollContainer.scrollLeft;
    const startY = scrollContainer.scrollTop;
    const targetX = note.x + note.width / 2 - viewportWidth / 2;
    const targetY = note.y + note.height / 2 - viewportHeight / 2;
    const distanceX = targetX - startX;
    const distanceY = targetY - startY;
    let startTime = null;

    function animateScroll(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = (timestamp - startTime) / duration;
        scrollContainer.scrollLeft = startX + distanceX * progress;
        scrollContainer.scrollTop = startY + distanceY * progress;
        if (progress < 1) requestAnimationFrame(animateScroll);
    }

    requestAnimationFrame(animateScroll);
}

function drawPianoRoll(midi) {
    // 计算总持续时间
    let maxTime = 0;
    midi.tracks.forEach(track => {
        track.notes.forEach(note => {
            const noteEnd = note.time + note.duration;
            if (noteEnd > maxTime) maxTime = noteEnd;
        });
    });

    // 计算需要的canvas宽度（例如：1秒 = 150像素）
    const canvasWidth = maxTime * timeScale + 3000;     // 留一些富余的位置
    canvas.width = canvasWidth;
    overlayCanvas.width = canvasWidth;

    offscreenCanvas.width = canvas.width;
    // 极其关键！！！
    canvas.style.width = canvasWidth + "px";
    overlayCanvas.style.width = canvasWidth + "px";
    overlayCanvas.style.height = canvas.style.height;

    offCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height); // 白色背景
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ✅ 绘制网格在底层
    drawGrid();     // 画在离屏画布上
    ctx.drawImage(offscreenCanvas, 0, 0); // 将离屏画布绘制到主画布上

    midi.tracks.forEach((track, trackIndex) => {
        if (!trackVisibility[trackIndex]) return;
        track.notes.forEach((note, idx) => {
            const x = note.time * timeScale;
            const y = canvas.height - ((note.midi - pitchBase + 1) * noteHeight);
            const width = note.duration * timeScale;
            const height = noteHeight - 1;
            ctx.fillStyle = getColor(trackIndex);
            ctx.fillRect(x, y, width, height);

            const noteObj = {
                note,
                x,
                y,
                width,
                height,
                trackIndex
            };
            // allNotes.push(noteObj);
            // 添加到全局音符数组
            const key = `${trackIndex}-${note.time}-${note.midi}`;  // 自定义哈希键
            allNotes.set(key, noteObj);  // 存入哈希表 
            noteInTrackMap.set(key, note);
            noteToIndexMap.set(key, { trackIndex, idx });
        });
    });

    buildNoteIndex(allNotes);
    // renderVisibleNotes();
}

function getColor(index) {
    const colors = ["#4caf50", "#2196f3", "#ff9800", "#e91e63", "#9c27b0"];
    return colors[index % colors.length];
}

function getNoteName(midi) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const note = noteNames[midi % 12];
    return `${note}${octave}`;
}

function drawSidebarNoteNames() {
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = '';

    sidebar.style.position = 'relative';
    sidebar.style.height = `${visibleRange * noteHeight}px`;

    for (let i = visibleRange - 1; i >= 0; i--) {
        const midiNum = pitchBase + i;
        const noteName = getNoteName(midiNum);
        const div = document.createElement('div');

        div.textContent = noteName;
        div.style.height = `${noteHeight}px`;
        div.style.display = 'flex';
        div.style.alignItems = 'center';      // 垂直居中
        div.style.justifyContent = 'flex-end';// 水平右对齐
        div.style.fontSize = `${Math.floor(noteHeight * 0.5)}px`; // 比如 noteHeight=20 → 14px 字号
        div.style.paddingRight = '5px';
        // 添加边框样式
        div.style.borderBottom = '1px solid #333'; // 浅灰色边框

        sidebar.append(div); // 从高音往低音画，和 canvas 对齐
    }
}

function drawGrid() {
    offCtx.clearRect(0, 0, canvas.width, canvas.height);

    const beatWidth = timeScale * beatsToSeconds(1);       // 每拍的宽度

    // 1. 绘制音高横线（水平）
    for (let i = 0; i < visibleRange + 1; i++) {
        // 从底部开始画
        const y = canvas.height - (i * noteHeight);
        offCtx.beginPath();
        offCtx.moveTo(0, y);
        offCtx.lineTo(canvas.width, y);
        offCtx.lineWidth = 1;
        offCtx.strokeStyle = i % 12 === 0 ? '#444' : '#ccc'; // C音高线颜色加深，其他也加深
        offCtx.stroke();
    }

    // 2. 绘制垂直拍线 + 小节线 + 小节编号 + 时间刻度
    for (let x = 0; x < canvas.width; x += beatWidth) {
        offCtx.beginPath();
        offCtx.moveTo(x, 0);
        offCtx.lineTo(x, canvas.height);

        const beatIndex = x / beatWidth;
        const isMeasureStart = beatIndex % 4 === 0;

        offCtx.lineWidth = isMeasureStart ? 1.5 : 1;                 // 小节线更粗
        offCtx.strokeStyle = isMeasureStart ? '#666' : '#bbb';    // 小节线颜色加深，拍线也加深
        offCtx.stroke();

        // 时间轴显示（每拍时间）
        const timeInSeconds = beatsToSeconds(beatIndex);
        offCtx.fillStyle = '#003366';  // 深蓝色，突出时间刻度
        offCtx.font = '10px Arial';
        offCtx.fillText(`${timeInSeconds}s`, x + 2, 10);

        // 小节编号
        if (isMeasureStart) {
            const measureNumber = Math.floor(beatIndex / 4) + 1;
            offCtx.fillStyle = '#222';  // 更深的文字颜色
            offCtx.font = '10px Arial';
            offCtx.fillText(`M${measureNumber}`, x + 3, 22);
        }
    }
}


function getCurrentBPM() {
    return Tone.Transport.bpm.value;
}

function beatsToSeconds(num_beats) {
    const bpm = getCurrentBPM();
    return (num_beats * 60) / bpm;
}

// 核心函数：更新页面历史记录列表
function updateHistoryList(manager) {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    // 从历史管理器中获取最近的操作（最多保留 3 条 + 新操作）
    const recentEntries = manager.history
        .map((entry, index) => ({
            ...entry,
            index,
            timeAgo: formatTimeAgo(entry.timestamp)
        }))
        .reverse() // 反转，让最新的在最前
        .slice(0, 3); // 只保留最近 3 条（新操作会插入到最前，所以实际最多 4 条，再裁剪）

    // 构建新的列表 HTML
    const newItems = recentEntries.map((entry) => {
        let actionText, detailText;

        // 根据操作类型，生成不同的文案
        switch (entry.type) {
            case 'add':
                actionText = '添加';
                detailText = entry.label;
                break;
            case 'delete':
                actionText = '删除';
                detailText = entry.label;
                break;
            case 'modify':
                actionText = '修改';
                detailText = entry.label;
                break;
            case 'modifyTime':
                actionText = '修改';
                detailText = entry.label;
                break;
            case 'dragNote':
                actionText = '拖拽';
                detailText = entry.label;
            default:
                actionText = '操作';
                detailText = entry.label || '未知';
        }

        // 判断是否是当前步骤（用于高亮）
        const isCurrent = entry.index === manager.pointer;

        // entry.index经过了映射得到
        return `
        <div class="history-item ${isCurrent ? 'history-item-current' : ''} bg-white hover:bg-neutral-50"  data-index="${entry.index}">
          <div class="flex items-center">
            <span class="midi-action midi-action-${entry.type} mr-2">${actionText}</span>
            <span class="text-neutral-700">${detailText}</span>
          </div>
          <span class="text-xs text-neutral-500">${entry.timeAgo}</span>
        </div>
      `;
    });

    // 插入新操作到最前，并保留最多 3 条（超出自动淘汰）
    historyList.innerHTML = newItems.join('');
}

// 辅助函数：格式化时间（刚刚、X分钟前等）
function formatTimeAgo(timestamp) {
    const now = new Date();
    const diff = now - new Date(timestamp);

    if (diff < 60 * 1000) {
        return '刚刚';
    } else if (diff < 60 * 60 * 1000) {
        return `${Math.floor(diff / (60 * 1000))}分钟前`;
    } else {
        return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
    }
}

// 找到历史记录列表容器
const historyList = document.getElementById('historyList');

// 事件委托：监听右键菜单事件
historyList.addEventListener('contextmenu', (e) => {
    e.preventDefault(); // 阻止浏览器默认右键菜单

    // 找到点击的 history-item 元素
    const historyItem = e.target.closest('.history-item');
    if (!historyItem) {
        console.warn("Cannot find any history-item");
        return; // 未点击在 item 上，直接返回
    }

    // 直接从 data-index 获取真实索引
    const entryIndex = parseInt(historyItem.getAttribute('data-index'));
    const historyEntry = historyManager.history[entryIndex];

    // 显示自定义右键菜单（需先准备好右键菜单 DOM）
    const contextMenu = document.getElementById('history-context-menu');
    if (contextMenu) {
        // 定位：基于鼠标位置显示
        contextMenu.classList.add('show');
        contextMenu.style.top = `${e.pageY}px`;
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.display = 'flex';

        // 绑定按键逻辑（如删除该历史记录、还原历史记录等）
        const deleteHistoryBtn = contextMenu.querySelector('#delete-history');
        deleteHistoryBtn?.addEventListener('click', () => {
            handleDelete(historyEntry);
            contextMenu.classList.remove('show');
            contextMenu.style.display = 'none';
        });

        // 绑定按键逻辑（如删除该历史记录、还原历史记录等）
        const restoreHistoryBtn = contextMenu.querySelector('#restore-history');
        restoreHistoryBtn?.addEventListener('click', () => {
            handleRestore(historyEntry);
            contextMenu.classList.remove('show');
            contextMenu.style.display = 'none';
        });
    }
    else {
        console.warn("Cannot find contextMenu");
        return;
    }
});

historyList.addEventListener('mousedown', () => {
    const contextMenu = document.getElementById('history-context-menu');
    contextMenu.classList.remove('show');
    contextMenu.style.display = 'none';
})

function handleDelete(entry) {
    console.log("Delete choosed history !");
    const index = historyManager.history.findIndex(_entry => _entry === entry);
    if (index == historyManager.history.length - 1) {
        alert("无法删除当前位置");
        console.log(historyManager.history);
        console.log(`pointer = ${historyManager.pointer}`);
        return;
    }
    historyManager.history.splice(index, 1);
    historyManager.pointer = historyManager.history.length - 1;
    updateHistoryList(historyManager);
}

const setSavePointBtn = document.getElementById("setSavePointBtn");
setSavePointBtn.addEventListener('click', () => {
    historyManager.setSavePoint();
});

const restoreSavePointBtn = document.getElementById("restoreSavePointBtn");
restoreSavePointBtn.addEventListener('click', () => {
    historyManager.restoreToSavePoint();
});

function handleRestore(entry) {
    const index = historyManager.history.findIndex(_entry => _entry === entry);
    const flag = historyManager.restoreToHistory(index);
    if (!flag) {
        alert("还原历史记录失败");
    }
    historyManager.history.splice(index, 1);
    updateHistoryList(historyManager);
}