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
    }

    init() {
        this.renderer = new Vex.Renderer(this.container, Vex.Renderer.Backends.SVG);
        this.renderer.resize(this.container.clientWidth, 200);
        this.context = this.renderer.getContext();
        this.stave = new Vex.Stave(10, 0, this.container.clientWidth - 20);
        this.stave.addClef("treble").addTimeSignature("4/4");
        this.stave.setContext(this.context).draw();
    }

    midiToNoteName(midi) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        const noteIndex = midi % 12;
        return noteNames[noteIndex] + '/' + octave;
    }

    getDuration(duration) {
        if (duration <= 0.25) return '16';
        if (duration <= 0.5) return '8';
        if (duration <= 1) return 'q';
        if (duration <= 2) return 'h';
        return 'w';
    }

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

    getDurationFromBeats(beats) {
        if (beats >= 4) return 'w';
        if (beats >= 2) return 'h';
        if (beats >= 1) return 'q';
        if (beats >= 0.5) return '8';
        return '16';
    }

    createRest(duration) {
        return new Vex.StaveNote({
            keys: ['b/4'],
            duration: duration,
            stem_direction: Vex.StaveNote.STEM_DOWN
        }).setStyle({ fillStyle: 'transparent' });
    }

    convertMidiToVexFlowNotes(midiNotes) {
        const vexNotes = [];
        midiNotes.forEach(note => {
            const noteName = this.midiToNoteName(note.midi);
            if (noteName) {
                vexNotes.push({
                    keys: [noteName],
                    duration: note.duration,
                    time: note.time
                });
            }
        });
        return vexNotes;
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
        if (visibleTracks.length === 0) return;

        const allNotes = visibleTracks.reduce((notes, track) => {
            if (track.notes && track.notes.length > 0) {
                return notes.concat(track.notes);
            }
            return notes;
        }, []).sort((a, b) => a.time - b.time);

        const rawNotes = this.convertMidiToVexFlowNotes(allNotes);
        const timeSigRaw = midiData.header.timeSignatures?.[0];
        const timeSig = (timeSigRaw && timeSigRaw.numerator && timeSigRaw.denominator)
            ? timeSigRaw
            : { numerator: 4, denominator: 4 };

        const totalBeats = timeSig.numerator;
        const beatValue = timeSig.denominator;

        const measures = [];

        let currentMeasure = [];
        let currentBeats = 0;

        for (let i = 0; i < rawNotes.length; i++) {
            let { keys, duration } = rawNotes[i];

            // 当前音符还有多少节拍没有被分配到小节之中
            let beatsLeft = this.getNoteDuration(this.getDuration(duration));

            while (beatsLeft > 0) {
                // 当前小节允许的总拍数（4/4为4）- 当前小节已经使用的拍数
                const space = totalBeats - currentBeats;

                // 小节已经填满
                if (space <= 0) {
                    measures.push(currentMeasure);
                    currentMeasure = [];
                    currentBeats = 0;
                    continue;
                }

                // 剩余节拍数太大的音符被切割
                const beatsToUse = Math.min(beatsLeft, space);
                const vexDuration = this.getDurationFromBeats(beatsToUse);

                const note = new Vex.StaveNote({ keys, duration: vexDuration });
                currentMeasure.push(note);
                currentBeats += beatsToUse;
                beatsLeft -= beatsToUse;

                if (beatsLeft > 0 && space === beatsToUse) {
                    // 跨小节延音符号可考虑在此添加 Tie（留待拓展）
                }
            }
        }

        if (currentMeasure.length > 0) {
            if (currentBeats < totalBeats) {
                const beatsToFill = totalBeats - currentBeats;
                let beatsFilled = 0;

                while (beatsFilled < beatsToFill) {
                    const restDuration = this.getDurationFromBeats(beatsToFill - beatsFilled);
                    const restNote = this.createRest(restDuration);
                    currentMeasure.push(restNote);
                    beatsFilled += this.getNoteDuration(restDuration);
                }
            }
            measures.push(currentMeasure);
        }

        let x = 10;
        const staveWidth = Math.max(120, (this.container.clientWidth - 20) / measures.length);

        measures.forEach((measureNotes, i) => {
            const stave = new Vex.Stave(x, 0, staveWidth);
            // console.log(measureNotes);
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
