import SampleLibrary from '../lib/ToneInstruments.js';

let midiData = null;
let currentMidi = null;
// let synth = new Tone.PolySynth().toDestination();
let synth = SampleLibrary.load({
    instruments: "piano",
    onload: () => {
        console.log('音频加载完成');
        this.audioLoaded = true;
    }
});
let isPlaying = false;
let trackVisibility = []; // 全局轨道可见性控制数组
// ✅ 新增：记录上一帧的进度线位置

const canvas = document.getElementById("pianoRoll");
const ctx = canvas.getContext("2d");
const noteHeight = 18;
const timeScale = 150;
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

addBtn.addEventListener('click', (e) => {
    if (!currentMidi) return;

    addBtnContainer.style.display = 'none'; // 隐藏添加按钮容器

    addNoteContainer.style.top = `${e.clientY}px`;
    addNoteContainer.style.left = `${e.clientX}px`;
    addNoteContainer.style.display = 'block';

    trackInput_add.value = 0; // 设置初始轨道索引为当前选中的轨道

    timeInput_add.value = 0; // 设置初始时间为0

    nameInput_add.value = 'A0'; // 设置初始音符名称为A0

    slider_add.value = 1; // 设置滑块初始值
    valueDisplay_add.textContent = slider_add.value;
});

confirmBtn.addEventListener('click', () => {
    const trackIndex = parseInt(trackInput_add.value, 10);
    const newTime = parseFloat(timeInput_add.value);
    const newDuration = parseFloat(slider_add.value);
    const newName = nameInput_add.value.trim();
    const newMidi = noteNameToMidi(newName);
    let isValid = true;
    if (!isNaN(newTime) && !isNaN(newDuration) && newDuration > 0 && newName !== '') {
        const track = currentMidi.tracks[trackIndex];
        const newNote = {
            time: newTime,
            duration: newDuration,
            name: newName,
            midi: newMidi
        };

        console.log("create new note:", newNote);

        track.notes.push(newNote); // 添加到轨道的notes数组中
        track.notes.sort((a, b) => a.time - b.time); // 确保按时间排序

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

        allNotes.push(noteObj); // 添加到全局音符数组

        console.log("add to allNotes");
    }
    else {
        alert("请确保输入的时间、持续时间和音符名称有效！");
        isValid = false;
    }

    trackInputBox_add.style.display = 'none';
    timeInputBox_add.style.display = 'none';
    nameInputBox_add.style.display = 'none';
    sliderContainer_add.style.display = 'none';
    addNoteContainer.style.display = 'none';

    if (!isValid) {
        return;
    }

    redrawCanvas(currentMidi); // 重新绘制画布

    hasModified = true; // 标记为已修改
});

// // 滑动时更新显示的值
// slider_add.addEventListener('input', () => {
//     valueDisplay_add.textContent = slider_add.value;
//     durationInput = parseFloat(slider.value);

//     const track = currentMidi.tracks[choosedNote.trackIndex];
//     const choosedNoteInNotes = track.notes.find(note => note === choosedNote.note);

//     if (choosedNoteInNotes && choosedNote) {
//         choosedNoteInNotes.duration = durationInput;
//         choosedNote.width = durationInput * timeScale; // 更新选中音符的宽度

//         redrawCanvas(currentMidi); // 重新绘制画布
//     }
//     else {
//         console.warn("notes中找不到对应音符");
//     }
// });

resetBtn.addEventListener('click', () => {

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

    midi.tracks.forEach((track, trackIndex) => {
        if (!trackVisibility[trackIndex]) return;
        track.notes.forEach(note => {
            const thisNote = allNotes.find(n => n.note === note);
            console.log("name = ", thisNote.note.name);
            ctx.fillStyle = getColor(trackIndex);
            ctx.fillRect(thisNote.x, thisNote.y, thisNote.width, thisNote.height);
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
        return x >= note.x && x < note.x + note.width && y >= note.y && y < note.y + note.height;       // 定位选中的音符
    });

    if (!choosedNote) {
        console.warn("contextmenu没有选中音符");
        // 单独显示添加音符按钮
        addBtnContainer.style.top = `${e.clientY}px`;
        addBtnContainer.style.left = `${e.clientX}px`;
        addBtnContainer.style.display = 'block';

        // 记得隐藏其他菜单
        menu.style.display = 'none';

        return; // 没有选中音符
    }

    // 设置菜单位置
    menu.style.top = `${e.clientY}px`;
    menu.style.left = `${e.clientX}px`;
    menu.style.display = 'block';

    initDurationValue = String(choosedNote.note.duration);
    console.log("initDurationValue:", initDurationValue);
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
    timeInputBox.style.top = `${e.clientY}px`;
    timeInputBox.style.left = `${e.clientX}px`;
    timeInputBox.style.display = 'block';
});

confirmTime.addEventListener('click', () => {
    const newTime = parseFloat(timeInput.value);
    if (!isNaN(newTime)) {
        const track = currentMidi.tracks[choosedNote.trackIndex];
        const noteInTrack = track.notes.find(note => note === choosedNote.note);
        if (noteInTrack) {
            noteInTrack.time = newTime;
            choosedNote.note.time = newTime;
            choosedNote.x = newTime * timeScale;

            redrawCanvas(currentMidi); // 重新绘制画布
        }
    }
    timeInputBox.style.display = 'none';
});

document.getElementById('delete').addEventListener('click', () => {
    if (!choosedNote) return; // 没有选中音符

    const x = choosedNote.x;
    const y = choosedNote.y;

    ctx.clearRect(x, y, choosedNote.width, choosedNote.height); // 清除选中的音符

    choosedIndex = allNotes.findIndex(note => note === choosedNote.note);

    allNotes.splice(choosedIndex, 1); // 删除选中的音符

    const track = currentMidi.tracks[choosedNote.trackIndex];
    const noteIndex = track.notes.findIndex(n => n === choosedNote.note);
    if (noteIndex > -1) {
        track.notes.splice(noteIndex, 1); // 删除选中的音符
    }

    console.log("delete note");
});

showSliderBtn.addEventListener('click', (e) => {
    console.log("showSliderBtn");
    sliderContainer.style.top = `${e.clientY}px`;
    sliderContainer.style.left = `${e.clientX}px`;
    sliderContainer.style.display = 'block';
});

// 滑动时更新显示的值
slider.addEventListener('input', () => {
    valueDisplay.textContent = slider.value;
    durationInput = parseFloat(slider.value);

    const track = currentMidi.tracks[choosedNote.trackIndex];
    const choosedNoteInNotes = track.notes.find(note => note === choosedNote.note);

    if (choosedNoteInNotes && choosedNote) {
        choosedNoteInNotes.duration = durationInput;
        choosedNote.width = durationInput * timeScale; // 更新选中音符的宽度

        redrawCanvas(currentMidi); // 重新绘制画布
    }
    else {
        console.warn("notes中找不到对应音符");
    }
});

setSliderValue.addEventListener('click', () => {
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

canvas.addEventListener('mousedown', (e) => {
    if (menu.contains(e.target) || sliderContainer.contains(e.target)) {
        return;
    }
    if (e.button !== 0) return; // 只处理左键点击

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;                // 网页左上角为原点
    const y = e.clientY - rect.top;
    draggedNote = allNotes.find(note => {
        return x >= note.x && x < note.x + note.width && y >= note.y && y < note.y + note.height;       // 定位选中的音符
    });
    if (draggedNote) {
        isDragging = true;
        startX = x;
        startY = y;
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

        hasModified = true; // 标记为已修改
        draggedNote = null; // 清除拖动的音符
    }
});

document.getElementById("midiFileInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

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
});

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
    if (!currentMidi) return;

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
                    }, note.time);
                    maxTime = Math.max(maxTime, note.time + note.duration);
                });
            });

            hasScheduled = true;
            Tone.Transport.start();

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
        }

    } else {
        // 暂停播放
        Tone.Transport.pause();
        isPlaying = false;
        playPauseBtn.textContent = "播放";
    }
});

document.getElementById("resetBtn").addEventListener("click", () => {
    Tone.Transport.stop();
    isPlaying = false;

    currentTime = 0; // 重置时间

    // 重绘音符和网格
    drawPianoRoll(currentMidi);
});

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
    const canvasWidth = maxTime * timeScale + 1500;     // 留一些富余的位置
    canvas.width = canvasWidth;

    offscreenCanvas.width = canvas.width;
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

    for (let i = 0; i < visibleRange; i++) {
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

        sidebar.prepend(div); // 从高音往低音画，和 canvas 对齐
    }
}

function drawGrid() {
    offCtx.clearRect(0, 0, canvas.width, canvas.height);

    const beatWidth = timeScale * beatsToSeconds(1);       // 每拍的宽度

    offCtx.lineWidth = 1;

    // 1. 绘制音高横线（水平）
    for (let i = 0; i < visibleRange; i++) {
        const y = canvas.height - (i * noteHeight);
        offCtx.beginPath();
        offCtx.moveTo(0, y);
        offCtx.lineTo(canvas.width, y);
        offCtx.strokeStyle = i % 12 === 0 ? '#bbb' : '#eee'; // 每个C音高加深
        offCtx.stroke();
    }

    // 2. 绘制垂直拍线 + 小节线 + 小节编号 + 时间刻度
    for (let x = 0; x < canvas.width; x += beatWidth) {
        offCtx.beginPath();
        offCtx.moveTo(x, 0);
        offCtx.lineTo(x, canvas.height);

        const beatIndex = x / beatWidth;
        const isMeasureStart = beatIndex % 4 === 0;

        ctx.strokeStyle = isMeasureStart ? '#999' : '#ddd'; // 小节线加深
        ctx.stroke();

        // 时间轴显示（每拍时间）
        const timeInSeconds = beatsToSeconds(beatIndex);
        offCtx.fillStyle = '#007';
        offCtx.font = '10px Arial';
        offCtx.fillText(`${timeInSeconds}s`, x + 2, 10);

        // 小节编号
        if (isMeasureStart) {
            const measureNumber = Math.floor(beatIndex / 4) + 1;
            offCtx.fillStyle = '#333';
            offCtx.font = '10px Arial';
            offCtx.fillText(`M${measureNumber}`, x + 3, 22); // 往下移一点，避免与时间重叠
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