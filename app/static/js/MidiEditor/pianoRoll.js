import SampleLibrary from '../lib/ToneInstruments.js';
import Piano from '/static/js/MidiEditor/piano.js';
import { MidiHistoryManager } from './MidiHistoryManager.js';
import sheetMusicRenderer from './sheetMusic.js';

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

const canvas = document.getElementById("pianoRoll");
const ctx = canvas.getContext("2d");
const noteHeight = 18;
const timeScale = 200;
const pitchBase = 21; // A0
const visibleRange = 88;

const allNotes = [];        // 用于存储所有音符对象，在对音符进行操作时使用
let isDragging = false;
let draggedNote = null;
let startX = 0;
let startY = 0;

canvas.height = noteHeight * visibleRange;

const offscreenCanvas = document.createElement('canvas');
const offCtx = offscreenCanvas.getContext('2d');

offscreenCanvas.height = canvas.height;
offCtx.fillStyle = '#fff';

let hasModified = false; // 标记是否有修改
let choosedNote = null;      // 被选中的音符下标

let initDurationValue = -1; // 初始化值为选中音符的持续时间
let durationInput = -1;
let initWidth = -1;
const tolerance = 3;

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
    const allNotes_copy = allNotes.slice();
    const track_notes_copy = track.notes.slice();

    let isValid = true;
    if (!isNaN(newTime) && newTime !== '' && !isNaN(newDuration) && newDuration > 0 && newName !== '' && trackIndex !== '') {
        const track = currentMidi.tracks[trackIndex];
        const newNote = {
            time: newTime,
            duration: newDuration,
            name: newName,
            midi: newMidi
        };

        track_notes_copy.push(newNote); // 添加到轨道的notes数组中
        track_notes_copy.sort((a, b) => a.time - b.time); // 确保按时间排序

        const x = newNote.time * timeScale;
        const y = canvas.height - ((newNote.midi - pitchBase + 1) * noteHeight);
        const width = newNote.duration * timeScale;
        const height = noteHeight - 1;
        const noteObj = {
            note: newNote,
            x,
            y,
            width,
            height,
            trackIndex
        };

        allNotes_copy.push(noteObj); // 添加到全局音符数组
    }
    else {
        alert("请确保输入的时间、持续时间和音符名称有效！");
        isValid = false;
    }

    if (!isValid) {
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height); // 清除画布
    ctx.drawImage(offscreenCanvas, 0, 0); // 绘制网格

    // 这里使用的是预览，不用redraw函数（只使用副本值进行绘制)
    if (!trackVisibility[trackIndex]) return;
    track_notes_copy.forEach(note => {
        const thisNote = allNotes_copy.find(n => n.note === note);
        ctx.fillStyle = getColor(trackIndex);
        ctx.fillRect(thisNote.x, thisNote.y, thisNote.width, thisNote.height);
    });
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
    let noteObj;

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

        allNotes.push(noteObj); // 添加到全局音符数组
    }
    else {
        alert("请确保输入的时间、持续时间和音符名称有效！");
        isValid = false;
    }

    addNoteContainer.style.display = 'none';

    if (!isValid) {
        return;
    }

    // redrawCanvas(currentMidi); // 重新绘制画布
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
            // console.log("redrawCanvas draws", width);
            ctx.fillRect(x, y, width, height);
            // console.log(`In redraw, draw ${note.name}`);
        });
    });
}

// 显示菜单
canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault(); // 阻止默认菜单

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;                // 网页左上角为原点
    const y = e.clientY - rect.top;
    choosedNote = allNotes.find(note => {
        return x >= note.x - tolerance && x < note.x + note.width + tolerance && y >= note.y - tolerance && y < note.y + note.height + tolerance;       // 定位选中的音符
    });

    if (choosedNote) {
        // 展示menu时隐藏add相关的元素
        addBtnContainer.style.display = 'none';
        addNoteContainer.style.display = 'none';
        console.log(`chooseNote = ${choosedNote.note.name}`);
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
        const noteInTrack = track.notes.find(note => note === choosedNote.note);
        // 修改choosedNote之前进行保存
        const oldNote = { ...choosedNote };

        // ✅ 添加历史记录：修改音符时间
        historyManager.modifyNoteTime(choosedNote.trackIndex, oldNote, newTime); // 在修改前记录下来

        if (noteInTrack) {
            noteInTrack.time = newTime;
            choosedNote.note.time = newTime;
            choosedNote.x = newTime * timeScale;

            // redrawCanvas(currentMidi); // 重新绘制画布
            redrawNote(oldNote, newNote);
        }
    }
    timeInputBox.style.display = 'none';
});

const deleteBtn = document.getElementById('delete');

deleteBtn.addEventListener('click', (e) => {
    if (!choosedNote) return; // 没有选中音符

    const backupNote = { ...choosedNote };

    const x = choosedNote.x;
    const y = choosedNote.y;

    ctx.clearRect(x, y, choosedNote.width, choosedNote.height); // 清除选中的音符

    const track = currentMidi.tracks[choosedNote.trackIndex];
    const noteIndex = track.notes.findIndex(n => n === choosedNote.note);
    console.log(`delete ${choosedNote.note.name}`);

    if (noteIndex > -1) {
        track.notes.splice(noteIndex, 1); // 删除选中的音符
    }

    const choosedIndex = allNotes.findIndex(note => note === choosedNote.note);

    allNotes.splice(choosedIndex, 1); // 删除选中的音符

    // redrawCanvas(currentMidi);

    // ✅ 添加历史记录：删除音符
    historyManager.deleteNote(choosedNote.trackIndex, backupNote);

    // showMidi(currentMidi);

    menu.style.display = 'none';

    // 部分网格被连同音符一起消去，需要重绘
    drawGrid();
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
    const choosedNoteInNotes = track.notes.find(note => note === choosedNote.note);

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

    console.log("In setSlider Btn----------------------------------------------");

    allNotes.forEach(_note => {
        console.log(`In allNotes, name: ${_note.note.name}, width: ${_note.width}`);
    })

    currentMidi.tracks[0].notes.forEach(note => {
        console.log(`In currentMidi, name: ${note.name}, width: ${note.duration * timeScale}`);
    })

    console.log("----------------------------------------------");

    historyManager.modifyNote(changedNote.trackIndex, changedNote, initDuration, newDuration);        // newDuration重新定义

    sliderContainer.style.display = 'none';

    hasModified = true; // 标记为已修改
});

resetSliderValue.addEventListener('click', () => {
    if (initWidth > -1) {
        const track = currentMidi.tracks[choosedNote.trackIndex];
        const choosedNoteInNotes = track.notes.find(note => note === choosedNote.note);
        choosedNoteInNotes.duration = initWidth / timeScale; // 恢复初始持续时间
        choosedNote.width = initWidth; // 更新选中音符的宽度
        redrawCanvas(currentMidi); // 重新绘制画布
    }
});

let dragCount = 0;
let noteBeforeDrag = null;
let begun = false;
canvas.addEventListener('mousedown', (e) => {
    if (menu.contains(e.target) || sliderContainer.contains(e.target)) {
        return;
    }
    if (e.button !== 0) return; // 只处理左键点击

    // 点击任意地方鼠标隐藏
    addBtnContainer.style.display = 'none';
    menu.style.display = 'none';
    addNoteContainer.style.display = 'none';

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;                // 网页左上角为原点
    const y = e.clientY - rect.top;
    draggedNote = allNotes.find(note => {
        return x >= note.x - tolerance && x < note.x + note.width + tolerance
            && y >= note.y - tolerance && y < note.y + note.height + tolerance;       // 定位选中的音符
    });
    if (draggedNote) {
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

        if (!begun) {
            historyManager.beginBatch("拖拽音符*1"); // 开始批量操作
            begun = true;
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const dx = x - startX;
        const dy = y - startY;
        draggedNote.x += dx;
        draggedNote.y += dy;
        startX = x;
        startY = y;

        ctx.clearRect(0, 0, canvas.width, canvas.height); // 清除画布
        ctx.drawImage(offscreenCanvas, 0, 0); // 绘制网格
        const track = currentMidi.tracks[draggedNote.trackIndex];
        if (draggedNote) {
            track.notes.find(note => note === draggedNote.note).time = draggedNote.x / timeScale; // 更新时间 --> 影响接下来的绘制
        }

        currentMidi.tracks.forEach((track, trackIndex) => {
            if (!trackVisibility[trackIndex]) return;
            track.notes.forEach(note => {
                const thisNote = allNotes.find(n => n.note === note);
                ctx.fillStyle = getColor(trackIndex);
                ctx.fillRect(thisNote.x, thisNote.y, thisNote.width, thisNote.height);
            });
        });
    }
});

// 鼠标抬起后，更新note的性质
canvas.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    if (isDragging) {
        isDragging = false;
        // 新的y需要更新到画布上
        const nearestY = Math.round(draggedNote.y / noteHeight) * noteHeight;
        draggedNote.y = nearestY;

        const track = currentMidi.tracks[draggedNote.trackIndex];
        const draggedNoteInNotes = track.notes.find(note => note === draggedNote.note);

        // 两个数组进行同步
        if (draggedNote && draggedNoteInNotes) {
            draggedNoteInNotes.time = draggedNote.x / timeScale;        // 时间更新，其在notes数组中的位置也可能更新

            // 写入新音高，但是新的音高没办法立刻体现在播放器上
            const newNote = pitchBase + visibleRange - 1 - draggedNote.y / noteHeight;   // 计算新音高存在问题？canvas.height并非完全对应 --> 网格也占据了px
            const clampedMidi = getNoteName(newNote);
            if (newNote)
                draggedNoteInNotes.midi = newNote;
            if (clampedMidi)
                draggedNoteInNotes.name = clampedMidi;      // 播放时使用字符串

            draggedNote.note = draggedNoteInNotes;

            const newX = draggedNoteInNotes.time * timeScale;
            const newY = canvas.height - ((draggedNoteInNotes.midi - pitchBase) * noteHeight);
            draggedNote.x = newX;
            draggedNote.y = newY;
        }

        track.notes.sort((a, b) => a.time - b.time); // 不需要allNotes和其顺序一致

        // ✅ 添加历史记录：记录拖拽前后的音符状态
        historyManager.recordNoteDrag(
            draggedNote.trackIndex,
            // 浅拷贝
            noteBeforeDrag, // 原始值（拖拽前）
            draggedNote // 新值（拖拽后）
        );

        console.log(`Drag note from ${noteBeforeDrag.note.name} to ${draggedNote.note.name}`);

        // 性能还能提高
        // 重新绘制自动挪移的音符
        ctx.clearRect(0, 0, canvas.width, canvas.height); // 清除画布
        ctx.drawImage(offscreenCanvas, 0, 0); // 绘制网格

        currentMidi.tracks.forEach((track, trackIndex) => {
            if (!trackVisibility[trackIndex]) return;
            track.notes.forEach(note => {
                const thisNote = allNotes.find(n => n.note === note);
                ctx.fillStyle = getColor(trackIndex);
                ctx.fillRect(thisNote.x, thisNote.y, thisNote.width, thisNote.height);
            });
        });

        if (dragCount === 1) {
            historyManager.endBatch(); // 结束批量操作
            begun = false;
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

    console.log(currentMidi.tracks);

    // 渲染五线谱
    console.log("Begin to render midi");
    sheetMusicRenderer.renderMidi(midiData);
});

// 新增：初始化历史记录UI的函数
function initHistoryUI() {
    // 绑定撤销/重做按钮
    undoBtn.addEventListener('click', () => historyManager.undo());
    redoBtn.addEventListener('click', () => historyManager.redo());

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
            drawPianoRoll(midiData);
        });

        trackControl.appendChild(colorIndicator);
        trackControl.appendChild(trackLabel);
        trackControl.appendChild(trackToggle);
        trackControls.appendChild(trackControl);
    });
}

const playPauseBtn = document.getElementById("playBtn");
let hasScheduled = false;

playPauseBtn.addEventListener("click", async () => {
    if (!currentMidi) {
        console.log("currentMidi not defined");
        return;
    }

    if (!isPlaying) {
        isPlaying = true;
        playPauseBtn.textContent = "暂停";

        if (Tone.Transport.state === "stopped" || !hasScheduled || hasModified) {
            Tone.Transport.stop();
            Tone.Transport.cancel();
            Tone.Transport.bpm.value = 120;

            let maxTime = 0;

            currentMidi.tracks.forEach((track, trackIndex) => {
                if (!trackVisibility[trackIndex]) return;
                track.notes.forEach(note => {
                    Tone.Transport.scheduleOnce((time) => {
                        synth.triggerAttackRelease(note.name, note.duration, time);
                        setTimeout(() => {
                            piano.triggerKeyByName(note.name, note.duration);
                        }, 10);
                    }, note.time);
                    maxTime = Math.max(maxTime, note.time + note.duration);
                });
            });

            hasScheduled = true;
            Tone.Transport.start();
            if (Tone.Transport.state === 'started') {
                requestAnimationFrame(animatePlayhead);
            }

            // 播放结束后重置按钮状态
            Tone.Transport.scheduleOnce(() => {
                isPlaying = false;
                playPauseBtn.textContent = "播放";
                hasScheduled = false; // 允许再次调度
            }, maxTime + 0.1); // 加一点偏移避免截断

            hasModified = false; // 重置修改标记

        } else {
            // 继续播放
            Tone.Transport.start();
            if (Tone.Transport.state === 'started') {
                requestAnimationFrame(animatePlayhead);
            }
        }

    } else {
        // 暂停播放
        Tone.Transport.pause();
        isPlaying = false;
        playPauseBtn.textContent = "播放";
    }
});

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


function animatePlayhead() {
    const currentTime = Tone.Transport.seconds; // 或你的播放时间
    ctx.clearRect(0, 0, canvas.width, canvas.height); // 先清空画布
    ctx.drawImage(offscreenCanvas, 0, 0); // 重绘音符网格背景
    drawPlayheadLine(currentTime, canvas.height);

    currentMidi.tracks.forEach((track, trackIndex) => {
        if (!trackVisibility[trackIndex]) return;
        track.notes.forEach(note => {
            const thisNote = allNotes.find(n => n.note === note);
            ctx.fillStyle = getColor(trackIndex);
            // console.log("animatePlayHead draws", thisNote.width);
            ctx.fillRect(thisNote.x, thisNote.y, thisNote.width, thisNote.height);
        });
    });

    // 该函数没有用到allNotes，绘制正确，显然是allNotes的问题
    redrawCanvas(currentMidi);

    highlightPlayingNotes(currentTime);

    let playheadAnimationId;
    // 播放未结束则继续动画
    if (currentTime < currentMidi.duration) {
        playheadAnimationId = requestAnimationFrame(animatePlayhead);
    } else {
        // 停止播放并执行清理
        Tone.Transport.stop();
        cancelAnimationFrame(playheadAnimationId);
        onPlaybackEnd();
        // 用于清除进度线
        redrawCanvas(currentMidi);
    }
}

function highlightPlayingNotes(currentTime) {
    // 遍历所有音符，找出正在播放的音符并高亮显示
    currentMidi.tracks.forEach((track, trackIndex) => {
        if (!trackVisibility[trackIndex]) return;

        track.notes.forEach(note => {
            if (note.time <= currentTime && note.time + note.duration >= currentTime) {
                const thisNote = allNotes.find(n => n.note === note);
                ctx.fillStyle = 'rgba(255, 255, 0, 0.7)'; // 使用半透明黄色高亮
                ctx.fillRect(thisNote.x, thisNote.y, thisNote.width, thisNote.height);
            }
        });
    });
}

function drawPlayheadLine(currentTime, canvasHeight) {
    const x = currentTime * timeScale;

    ctx.save();
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();
    ctx.restore();
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

    offscreenCanvas.width = canvas.width;
    // 极其关键！！！
    canvas.style.width = canvasWidth + "px";
    offCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height); // 白色背景

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ✅ 绘制网格在底层
    drawGrid();     // 画在离屏画布上

    ctx.drawImage(offscreenCanvas, 0, 0); // 将离屏画布绘制到主画布上

    midi.tracks.forEach((track, trackIndex) => {
        if (!trackVisibility[trackIndex]) return;
        track.notes.forEach(note => {
            const x = note.time * timeScale;
            const y = canvas.height - ((note.midi - pitchBase + 1) * noteHeight);
            const width = note.duration * timeScale;
            const height = noteHeight - 1;
            ctx.fillStyle = getColor(trackIndex);       // track通过颜色区分
            ctx.fillRect(x, y, width, height);
            const noteObj = {
                note,
                x,
                y,
                width,
                height,
                trackIndex
            };
            allNotes.push(noteObj);
        });
    });
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

        // console.log(`When update history list, get:`);
        // console.log(entry);

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

// 添加窗口大小改变事件监听器
window.addEventListener('resize', () => {
    if (currentMidi) {
        console.log("Renderer resizes");
        sheetMusicRenderer.resize();
    }
});

export function compareRecord(allNotes, currentMidi) {
    console.log("----------------------------------------------");

    allNotes.forEach(_note => {
        console.log(`In allNotes, name: ${_note.note.name}, width: ${_note.width}`);
    })

    currentMidi.tracks[0].notes.forEach(note => {
        console.log(`In currentMidi, name: ${note.name}, width: ${note.duration * timeScale}`);
    })

    console.log("----------------------------------------------");
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
        contextMenu.style.top = `${e.pageY}px`;
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.display = 'block';

        // 绑定按键逻辑（如删除该历史记录、还原历史记录等）
        const deleteHistoryBtn = contextMenu.querySelector('#delete-history');
        deleteHistoryBtn?.addEventListener('click', () => {
            handleDelete(historyEntry);
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
    contextMenu.style.display = 'none';
})

function handleDelete(entry) {
    console.log("Delete choosed history !");
    const index = historyManager.history.findIndex(_entry => _entry === entry);
    historyManager.history.splice(index, 1);
    updateHistoryList(historyManager);
}