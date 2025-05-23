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
let lastProgressLineX = 0;

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

canvas.addEventListener('mousedown', (e) => {
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
        const draggedNoteIndex = track.notes.findIndex(n => n === draggedNote.note);
        if (draggedNoteIndex > -1) {
            track.notes[draggedNoteIndex].time = draggedNote.x / timeScale; // 更新时间 --> 影响接下来的绘制
        }

        currentMidi.tracks.forEach((track, trackIndex) => {
            if (!trackVisibility[trackIndex]) return;
            track.notes.forEach((note, noteIndex) => {
                const height = noteHeight - 1;
                const width = note.duration * timeScale;
                ctx.fillStyle = getColor(trackIndex);
                // 正在拖动的音符
                if (noteIndex === draggedNoteIndex) {
                    const draggedX = draggedNote.x;
                    const draggedY = draggedNote.y;
                    ctx.fillRect(draggedX, draggedY, width, height);
                }
                //固定不动的那些
                else {
                    const x = note.time * timeScale;
                    const y = canvas.height - ((note.midi - pitchBase) * noteHeight);
                    ctx.fillRect(x, y, width, height);
                }
            });
        });
    }
});

// 鼠标抬起后，更新note的性质
canvas.addEventListener('mouseup', (e) => {
    if (isDragging) {
        isDragging = false;
        // 新的y需要更新到画布上
        const nearestY = Math.round(draggedNote.y / noteHeight) * noteHeight;
        draggedNote.y = nearestY;

        const track = currentMidi.tracks[draggedNote.trackIndex];
        const noteIndex = track.notes.findIndex(n => n === draggedNote.note);
        if (noteIndex > -1) {
            track.notes[noteIndex].time = draggedNote.x / timeScale;

            // 写入新音高，但是新的音高没办法立刻体现在播放器上
            const newNote = pitchBase + visibleRange - 1 - draggedNote.y / noteHeight;   // 计算新音高存在问题？canvas.height并非完全对应 --> 网格也占据了px
            const clampedMidi = getNoteName(newNote);
            track.notes[noteIndex].midi = clampedMidi;
            draggedNote.note = track.notes[noteIndex];
        }

        // 重新绘制自动挪移的音符
        ctx.clearRect(0, 0, canvas.width, canvas.height); // 清除画布
        ctx.drawImage(offscreenCanvas, 0, 0); // 绘制网格

        currentMidi.tracks.forEach((track, trackIndex) => {
            if (!trackVisibility[trackIndex]) return;
            track.notes.forEach((note, index) => {
                const height = noteHeight - 1;
                const width = note.duration * timeScale;
                ctx.fillStyle = getColor(trackIndex);
                // 正在拖动的音符
                if (index === noteIndex) {
                    const draggedX = draggedNote.x;
                    const draggedY = draggedNote.y;
                    ctx.fillRect(draggedX, draggedY, width, height);
                }
                //固定不动的那些
                else {
                    const x = note.time * timeScale;
                    const y = canvas.height - ((note.midi - pitchBase) * noteHeight);
                    ctx.fillRect(x, y, width, height);
                }
            });
        });
    }
});

// ✅ 新增：进度线相关变量
let currentTime = 0; // 当前时间（秒）
let progressLineX = 0; // 进度线X坐标
const progressLineWidth = 2; // 线宽
const timeDisplayOffset = 20; // 时间数字偏移量

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

document.getElementById("playBtn").addEventListener("click", async () => {
    if (!currentMidi || isPlaying) return;

    // 重置上一帧位置
    lastProgressLineX = 0;

    isPlaying = true;
    Tone.Transport.cancel();
    Tone.Transport.bpm.value = 120;
    Tone.Transport.start();

    updateProgressLoop(); // 启动进度线刷新

    currentMidi.tracks.forEach((track, trackIndex) => {
        if (!trackVisibility[trackIndex]) return;
        track.notes.forEach(note => {
            Tone.Transport.scheduleOnce((time) => {
                synth.triggerAttackRelease(note.name, note.duration, time);
            }, note.time);
        });
    });
});

document.getElementById("pauseBtn").addEventListener("click", () => {
    Tone.Transport.pause();
    isPlaying = false;

    cancelAnimationFrame(animationFrameId);
});

document.getElementById("resetBtn").addEventListener("click", () => {
    Tone.Transport.stop();
    isPlaying = false;

    currentTime = 0; // 重置时间
    progressLineX = 0; // 重置进度线位置

    cancelAnimationFrame(animationFrameId);

    // 擦除进度线
    ctx.clearRect(progressLineX, 0, progressLineWidth + 1, canvas.height);

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
    a.download = "exported.mid";
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
    const canvasWidth = maxTime * timeScale;
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
            const y = canvas.height - ((note.midi - pitchBase) * noteHeight);
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

function drawProgressLine() {
    // 擦除上一帧的进度线
    ctx.clearRect(lastProgressLineX, 0, progressLineWidth + 1, canvas.height);

    // 当前播放时间
    currentTime = Tone.Transport.seconds;
    progressLineX = currentTime * timeScale;

    // 绘制新的进度线
    ctx.beginPath();
    ctx.moveTo(progressLineX, 0);
    ctx.lineTo(progressLineX, canvas.height);
    ctx.strokeStyle = "red";
    ctx.lineWidth = progressLineWidth;
    ctx.stroke();

    // 显示时间数字
    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    ctx.fillText(currentTime.toFixed(2) + "s", progressLineX + 4, timeDisplayOffset);

    // 记录本次绘制位置用于下一帧擦除
    lastProgressLineX = progressLineX;
}

let animationFrameId;

function updateProgressLoop() {
    if (!isPlaying) return;
    drawProgressLine();
    animationFrameId = requestAnimationFrame(updateProgressLoop);
}