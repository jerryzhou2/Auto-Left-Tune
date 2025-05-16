/**
 * 简化版的Tonejs-Instruments库，用于加载钢琴音频样本
 * 改编自 https://github.com/nbrosowsky/tonejs-instruments
 */

import { Notes } from './notes.js';

// 使用实际的钢琴音频样本
const SampleLibrary = {
    baseUrl: '../notes/',

    load: function (arg) {
        const t = arg || {};
        t.instruments = t.instruments || 'piano';
        t.baseUrl = t.baseUrl || this.baseUrl;

        // 创建音源采样器 - 使用实际的钢琴采样音频
        const pianoSamples = {};

        // 设置音符和对应的音频文件
        Notes.NotesMap.forEach(note => {
            pianoSamples[note.name] = note.file;
        });

        // 创建采样器
        const s = new Tone.Sampler(
            pianoSamples, {
            baseUrl: t.baseUrl, // 音频文件的基础路径
            onload: t.onload,
            release: 1
        }
        ).toDestination();

        return s;
    }
};

export default SampleLibrary; 