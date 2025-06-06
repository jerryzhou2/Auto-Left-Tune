import { trackVisibility } from "./pianoRoll.js";

const Vex = window.Vex.Flow;

export class SheetMusicRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.renderer = null;
        this.context = null;
        this.stave = null;
        this.notes = [];
        this.init();
    }

    init() {
        // 创建渲染器
        this.renderer = new Vex.Renderer(this.container, Vex.Renderer.Backends.SVG);
        this.renderer.resize(this.container.clientWidth, 200);
        this.context = this.renderer.getContext();

        // 创建五线谱
        this.stave = new Vex.Stave(10, 0, this.container.clientWidth - 20);
        this.stave.addClef("treble").addTimeSignature("4/4");
        this.stave.setContext(this.context).draw();
    }

    // 将MIDI音符转换为VexFlow音符
    convertMidiToVexFlowNotes(midiNotes) {
        const vexNotes = [];
        midiNotes.forEach(note => {
            // 将MIDI音高转换为音符名称
            const noteName = this.midiToNoteName(note.midi);
            if (noteName) {
                // 创建VexFlow音符
                const vexNote = new Vex.StaveNote({
                    keys: [noteName],
                    duration: this.getDuration(note.duration)
                });
                // 保存原始时间信息
                vexNote.time = note.time;
                vexNotes.push(vexNote);
            }
        });
        return vexNotes;
    }

    // MIDI音高转换为音符名称
    midiToNoteName(midi) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        const noteIndex = midi % 12;
        return noteNames[noteIndex] + '/' + octave;
    }

    // 将持续时间转换为音符时值
    getDuration(duration) {
        // 将秒转换为音符时值
        if (duration <= 0.25) return '16';
        if (duration <= 0.5) return '8';
        if (duration <= 1) return 'q';
        if (duration <= 2) return 'h';
        return 'w';
    }

    // 创建休止符
    createRest(duration) {
        return new Vex.StaveNote({
            keys: ['b/4'],
            duration: duration,
            stem_direction: Vex.StaveNote.STEM_DOWN
        }).setStyle({ fillStyle: 'transparent' });
    }

    // 渲染MIDI数据
    renderMidi(midiData) {
        if (!midiData || !midiData.tracks) return;

        // 清除现有内容
        this.container.innerHTML = '';

        // 只处理可见轨道的音符
        const visibleTracks = midiData.tracks.filter((track, index) => trackVisibility[index]);
        if (visibleTracks.length === 0) return;

        // 合并所有可见轨道的音符并按时间排序
        const allNotes = visibleTracks.reduce((notes, track) => {
            if (track.notes && track.notes.length > 0) {
                return notes.concat(track.notes);
            }
            return notes;
        }, []).sort((a, b) => a.time - b.time);

        // 转换音符
        const vexNotes = this.convertMidiToVexFlowNotes(allNotes);

        // 分小节
        const totalBeats = 4; // 4/4拍
        let measures = [];
        let currentMeasure = [];
        let currentBeats = 0;

        // 检查并调整音符时值
        vexNotes.forEach(note => {
            let duration = this.getNoteDuration(note.duration);
            let remainingDuration = duration;

            while (remainingDuration > 0) {
                const spaceInMeasure = totalBeats - currentBeats;

                if (spaceInMeasure <= 0) {
                    // 当前小节已满，创建新小节
                    if (currentMeasure.length > 0) {
                        measures.push(currentMeasure);
                    }
                    currentMeasure = [];
                    currentBeats = 0;
                    continue;
                }

                if (remainingDuration <= spaceInMeasure) {
                    // 音符可以完全放入当前小节
                    const noteToAdd = new Vex.StaveNote({
                        keys: note.keys,
                        duration: this.getDurationFromBeats(remainingDuration)
                    });
                    currentMeasure.push(noteToAdd);
                    currentBeats += remainingDuration;
                    remainingDuration = 0;
                } else {
                    // 音符需要分割到下一个小节
                    const splitNote = new Vex.StaveNote({
                        keys: note.keys,
                        duration: this.getDurationFromBeats(spaceInMeasure)
                    });
                    currentMeasure.push(splitNote);
                    measures.push(currentMeasure);
                    currentMeasure = [];
                    currentBeats = 0;
                    remainingDuration -= spaceInMeasure;
                }
            }
        });

        // 处理最后一个小节
        if (currentMeasure.length > 0) {
            if (currentBeats < totalBeats) {
                const remainingBeats = totalBeats - currentBeats;
                currentMeasure.push(this.createRest(this.getDurationFromBeats(remainingBeats)));
            }
            measures.push(currentMeasure);
        }

        // 渲染每个小节
        let x = 10;
        const staveWidth = Math.max(120, (this.container.clientWidth - 20) / measures.length);
        measures.forEach((measureNotes, i) => {
            // 创建stave
            const stave = new Vex.Stave(x, 0, staveWidth);
            if (i === 0) {
                stave.addClef("treble").addTimeSignature("4/4");
            }
            stave.setContext(this.context).draw();

            // 创建voice
            const voice = new Vex.Voice({
                num_beats: totalBeats,
                beat_value: 4
            });

            // 确保每个小节都有足够的音符
            let measureBeats = 0;
            const validNotes = measureNotes.filter(note => {
                const duration = this.getNoteDuration(note.duration);
                if (measureBeats + duration <= totalBeats) {
                    measureBeats += duration;
                    return true;
                }
                return false;
            });

            // 如果小节中的音符总时值不足4拍，添加休止符
            if (measureBeats < totalBeats) {
                const remainingBeats = totalBeats - measureBeats;
                validNotes.push(this.createRest(this.getDurationFromBeats(remainingBeats)));
            }

            voice.addTickables(validNotes);

            // 格式化
            new Vex.Formatter().joinVoices([voice]).format([voice], staveWidth - 20);

            // 绘制
            voice.draw(this.context, stave);

            x += staveWidth;
        });
    }

    // 获取音符时值对应的拍数
    getNoteDuration(duration) {
        switch (duration) {
            case 'w': return 4;
            case 'h': return 2;
            case 'q': return 1;
            case '8': return 0.5;
            case '16': return 0.25;
            default: return 1;
        }
    }

    // 根据拍数获取音符时值
    getDurationFromBeats(beats) {
        if (beats >= 4) return 'w';
        if (beats >= 2) return 'h';
        if (beats >= 1) return 'q';
        if (beats >= 0.5) return '8';
        return '16';
    }

    // 调整大小
    resize() {
        if (this.renderer) {
            this.renderer.resize(this.container.clientWidth, 200);
            this.stave.setWidth(this.container.clientWidth - 20);
            this.renderMidi(this.currentMidiData);
        }
    }
}

// 创建实例并导出
const sheetMusicRenderer = new SheetMusicRenderer('sheetMusic');
export default sheetMusicRenderer; 