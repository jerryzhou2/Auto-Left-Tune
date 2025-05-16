/**
 * 钢琴采样库加载工具
 * 基于AutoPiano项目的实现
 */

import { NotesMap, mapFile } from './notes.js';

const SampleLibrary = {
  minify: false,
  ext: '.mp3', // 文件扩展名
  baseUrl: '/static/notes/',
  list: ['piano'],
  onload: null,

  /**
   * 加载采样器
   * @param {Object} arg - 配置参数
   * @param {string|Array} arg.instruments - 乐器名称（本实现中只支持piano）
   * @param {string} arg.baseUrl - 采样文件的基础URL
   * @param {Function} arg.onload - 加载完成后的回调函数
   * @returns {Tone.Sampler} Tone.js采样器
   */
  load: function (arg) {
    var t = arg || {};
    t.instruments = t.instruments || this.list;
    t.baseUrl = t.baseUrl || this.baseUrl;
    t.onload = t.onload || this.onload;

    // 打印日志
    console.log('加载钢琴采样器', t);

    // 构建采样映射对象 - 这是关键，必须使用正确格式的映射
    const pianoSamples = {};
    
    // 为每个音符名称创建映射
    NotesMap.forEach(note => {
      pianoSamples[note.name] = note.file;
    });

    // 创建Tone.js采样器，精确匹配AutoPiano配置
    try {
      // 使用更少的衰减和更长的释放，更接近真实钢琴
      const sampler = new Tone.Sampler({
        urls: pianoSamples,
        baseUrl: t.baseUrl,
        onload: t.onload,
        release: 1.5, // 更长的释放时间
        volume: -8,   // 降低音量，防止削波
        attack: 0,    // 立即起音
        curve: "exponential", // 指数曲线提供更自然的音量变化
        onerror: (err) => {
          console.error('加载钢琴采样出错:', err);
        }
      }).toDestination();
      
      // 添加轻微的效果处理，增强音色
      const reverb = new Tone.Reverb({
        decay: 1.5,
        wet: 0.2
      }).toDestination();
      
      sampler.connect(reverb);
      
      return sampler;
    } catch (error) {
      console.error('创建采样器时出错:', error);
      return null;
    }
  },

  'piano': {} // 空对象，实际映射在load函数中动态创建
};

export default SampleLibrary; 