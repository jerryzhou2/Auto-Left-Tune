import { trackVisibility } from "./pianoRoll.js";

const Vex = window.Vex.Flow;

export class SheetMusicRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.renderer = null;
        this.context = null;
        this.stave = null;
        this.notes = [];
        this.currentMidiData = null;
        this.init();

        // VexFlow 支持的音符时值及对应的拍数（4/4 拍）
        this.durationMap = [
            { duration: 'w', beats: 4 },
            { duration: 'hd', beats: 3 },  // dotted half
            { duration: 'h', beats: 2 },
            { duration: 'qd', beats: 1.5 }, // dotted quarter
            { duration: 'q', beats: 1 },
            { duration: '8d', beats: 0.75 }, // dotted eighth
            { duration: '8', beats: 0.5 },
            { duration: '16', beats: 0.25 },
            { duration: '32', beats: 0.125 },
            { duration: '64', beats: 0.0625 },
        ];
    }

    init() {
        this.renderer = new Vex.Renderer(this.container, Vex.Renderer.Backends.SVG);
        this.renderer.resize(this.container.clientWidth, 200);
        this.context = this.renderer.getContext();
        this.stave = new Vex.Stave(10, 0, this.container.clientWidth - 20);

        // ???
        this.stave.addClef("treble").addTimeSignature("4/4");
        this.stave.setContext(this.context).draw();
    }

    midiToNoteName(midi) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        const noteIndex = midi % 12;
        return noteNames[noteIndex] + '/' + octave;
    }

    createRest(duration) {
        return new Vex.StaveNote({
            // 随便
            keys: ['b/4'],
            // 休止符
            duration: duration + 'r',
            stem_direction: Vex.StaveNote.STEM_DOWN
        }).setStyle({ fillStyle: 'transparent' });
    }

    convertMidiToVexFlowNotes(midiNotes) {
        const vexNotes = [];
        midiNotes.forEach(note => {
            // 要求中间带有/的
            const noteName = this.midiToNoteName(note.midi);
            if (noteName) {
                vexNotes.push({
                    keys: [noteName],
                    // 字符串
                    duration: note.duration,
                    time: note.time
                });
            }
        });
        return vexNotes;
    }

    /**
     * 将任意节拍数拆分成若干合法时值数组
     * @param {number} beatsLeft - 还剩多少拍需要拆分
     * @returns {string[]} - 按顺序的 duration 字符串数组
     */
    splitBeatsToDurations(beatsLeft) {
        const result = [];
        // 规定的误差
        const epsilon = 0.001;

        while (beatsLeft > epsilon) {
            // 找到第一个满足 beats <= beatsLeft 的 duration
            const dur = this.durationMap.find(d => d.beats <= beatsLeft + epsilon);
            if (!dur) {
                // 理论上不会进来，保险起见防止死循环
                console.warn('Cannot split beats:', beatsLeft);
                break;
            }
            result.push(dur.duration);
            beatsLeft -= dur.beats;
        }

        return result;
    }

    getBeat(durationInSeconds, bpm) {
        return durationInSeconds * (bpm / 60);
    }

    getInitialBPM(midiData) {
        if (midiData.header.tempos.length > 0) {
            return midiData.header.tempos[0].bpm;
        } else {
            return 120; // 默认 BPM
        }
    }

    getClosestDuration(beats) {
        for (const entry of this.durationMap) {
            if (entry.beats <= beats) {
                return entry.duration;
            }
        }
        // 若 beats 小于最小值，则返回最短时值
        return this.durationMap[this.durationMap.length - 1].duration;
    }

    getValue(duration) {
        for (const entry of this.durationMap) {
            if (entry.duration === duration) {
                return entry.beats;
            }
        }
    }

    renderMidi(midiData) {
        if (!midiData || !midiData.tracks) {
            console.log("MidiData not found");
            return;
        }

        console.log("renderMidi triggered");

        // 清空画布
        this.container.innerHTML = '';
        this.currentMidiData = midiData;

        const visibleTracks = midiData.tracks.filter((track, index) => trackVisibility[index]);
        if (visibleTracks.length === 0) {
            console.warn("No track visible");
            return;
        }

        const allNotes = visibleTracks.reduce((notes, track) => {
            if (track.notes && track.notes.length > 0) {
                return notes.concat(track.notes);
            }
            return notes;
        }, []).sort((a, b) => a.time - b.time);

        const rawNotes = this.convertMidiToVexFlowNotes(allNotes);

        // 默认为4/4
        const timeSigRaw = midiData.header.timeSignatures?.[0];
        const timeSig = (timeSigRaw && timeSigRaw.numerator && timeSigRaw.denominator)
            ? timeSigRaw
            : { numerator: 4, denominator: 4 };

        const totalBeats = timeSig.numerator;
        const beatValue = timeSig.denominator;

        const bpm = this.getInitialBPM(this.currentMidiData);

        // 小节
        const measures = [];

        let currentMeasure = [];
        const remainingBeats = totalBeats;

        // 还需要计算所在小节
        for (let i = 0; i < rawNotes.length; i++) {
            // time用来干嘛？
            let { keys, duration } = rawNotes[i];

            // 当前音符还有多少没有被分配到小节之中
            let beatsLeft = getBeat(parseFloat(duration), bpm);

            while (remainingBeats > 0.0625 && beatsLeft > 0.625) {
                // 当beatsLeft太小就忽略
                if (beatsLeft <= remainingBeats && beatsLeft > 0.0625) {
                    // 当前小节足够容纳这个音符
                    const dur = this.getClosestDuration(beatsLeft);
                    const note = new Vex.StaveNote({ keys, duration: dur });

                    currentMeasure.push(note);
                    const durValue = this.getValue(dur);
                    remainingBeats -= durValue;
                    beatsLeft -= durValue;
                } else if (beatsLeft > remainingBeats) {
                    // 当前小节不够，需要拆分
                    let dur;
                    const splitBeats = this.splitBeatsToDurations(beatsLeft);
                    for (let i = 0; i < splitBeats.length; i++) {
                        if (splitBeats[i] <= remainingBeats) {
                            // 得到的是字符串
                            dur = splitBeats[i];
                            break;
                        }
                    }

                    const note = new Vex.StaveNote({ keys, duration: dur });
                    currentMeasure.push(note);
                    const durValue = this.getValue(dur);
                    remainingBeats -= durValue;
                    beatsLeft -= durValue;
                }
            }

            // 理论上不会出现这种情况
            if (remainingBeats < 0.0625) {
                console.warn("二分过程出现未知错误");
                return;
            }
        }

        let x = 10;
        const staveWidth = Math.max(400, (this.container.clientWidth - 20) / measures.length);

        measures.forEach((measureNotes, i) => {
            const stave = new Vex.Stave(x, 0, staveWidth);
            // 初始时绘制4/4标签
            if (i === 0) {
                stave.addClef("treble").addTimeSignature(`${totalBeats}/${beatValue}`);
            }
            stave.setContext(this.context).draw();

            const voice = new Vex.Voice({
                num_beats: totalBeats,
                beat_value: beatValue
            });

            console.log("Join voices and draw!");
            voice.addTickables(measureNotes);

            new Vex.Formatter().joinVoices([voice]).format([voice], staveWidth - 20);
            voice.draw(this.context, stave);

            measureNotes.forEach(note => {
                note.setContext(this.context);
                note.setStave(stave);
                note.draw();  // ✅ 只有显式调用 note.draw()，postFormatted 才会变 true
                console.log("After draw:", note.preFormatted, note.postFormatted);
            });

            measureNotes.forEach(note => {
                console.log(note.preFormatted, note.postFormatted);
            })

            x += staveWidth;
        });
    }

    resize() {
        if (this.renderer) {
            this.renderer.resize(this.container.clientWidth, 200);
            this.renderMidi(this.currentMidiData);
        }
    }
}

const sheetMusicRenderer = new SheetMusicRenderer('sheetMusic');
export default sheetMusicRenderer;
