/**
 * MIDI播放器模块
 * 参考自AutoPiano项目的midiAutoPlayMixin.js
 */

// 导入所需的模块
import SampleLibrary from './lib/SampleLibrary.js';

// 引入Tone.js和@tonejs/midi
class MidiPlayer {
  constructor(options = {}) {
    this.currentMidiData = null;
    this.midiNotes = [];
    this.midiStop = false;
    this.isPaused = false; // 添加暂停状态标志
    this.audioContext = null;
    this.synth = null;
    this.onNotePlay = options.onNotePlay || function() {};
    this.onMusicEnd = options.onMusicEnd || function() {};
    this.debug = options.debug || false;
    this.initialized = false;
    this.volume = options.volume || 0.7; // 默认音量70%
    this.lastPlayedTime = 0; // 上次播放的时间点
    
    // 添加对当前文件的标识
    this.currentFileId = null; // 可以是文件名、URL或其他唯一标识
    this.isConvertedFile = false; // 标识当前播放的是否为转换后的文件
    
    // 在构造函数中检查Midi对象
    this.checkMidiLibrary();
  }
  
  // 检查Midi库是否可用
  checkMidiLibrary() {
    if (this.debug) {
      if (typeof Midi !== 'undefined') {
        console.log('Midi库已加载，库类型:', typeof Midi);
        if (typeof Midi === 'function') {
          console.log('Midi是一个构造函数，可以正常使用');
        } else {
          console.warn('Midi不是一个构造函数，可能无法正常使用');
        }
      } else {
        console.error('Midi库未加载');
      }
    }
  }

  initAudio() {
    // 初始化Web Audio API
    if (typeof Tone !== 'undefined') {
      if (!this.initialized) {
        try {
          // 检查SampleLibrary是否可用
          if (typeof SampleLibrary !== 'undefined') {
            if (this.debug) console.log('尝试使用SampleLibrary加载钢琴音色...');
            
            // 加载钢琴音色
            this.synth = SampleLibrary.load({
              instruments: "piano",
              onload: () => {
                if (this.debug) console.log('钢琴音色加载完成');
                // 设置初始音量
                this.setVolume(this.volume);
              }
            });
            
            if (this.debug) console.log('钢琴音色初始化成功');
          } else {
            console.warn('SampleLibrary未定义，将使用合成器作为备选');
            this.initSynthesizer();
          }
        } catch (err) {
          console.error('初始化钢琴音色失败:', err);
          this.initSynthesizer();
        }
        
        // 设置初始音量
        this.setVolume(this.volume);
        
        this.initialized = true;
      }
      return true;
    } else {
      console.error('Tone.js 未加载，无法初始化音频');
      return false;
    }
  }

  // 初始化合成器（当无法使用采样器时的备选方案）
  initSynthesizer() {
    // 创建一个更接近钢琴音色的合成器
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: "triangle",
        partials: [1, 0.2, 0.01]
      },
      envelope: {
        attack: 0.005,
        decay: 0.3,
        sustain: 0.7,
        release: 2
      },
      volume: -6
    }).toDestination();
    
    if (this.debug) console.log('合成器初始化成功 - 使用增强的合成钢琴音色');
  }

  // 检查MIDI库是否可用
  isMidiLibAvailable() {
    // 检查各种可能的导出方式
    return (typeof Midi !== 'undefined');
  }

  // 获取Midi对象
  getMidiLib() {
    if (typeof Midi !== 'undefined') {
      return Midi;
    }
    console.error('找不到Midi库');
    return null;
  }

  // 从URL加载并播放MIDI文件
  loadMidiAndPlay(midiUrl, isConverted = false) {
    if (!this.isMidiLibAvailable()) {
      console.error('@tonejs/midi 未加载，无法播放MIDI文件');
      return;
    }

    // 确保音频系统已初始化
    if (!this.initialized) {
      const initialized = this.initAudio();
      if (!initialized) return;
    }

    // 如果是同一个文件且处于暂停状态，直接恢复播放
    if (this.currentFileId === midiUrl && this.isPaused && this.currentMidiData) {
      this.resumeMidiPlay();
      return;
    }

    // 如果是不同的文件，需要重置状态
    if (this.currentFileId !== midiUrl) {
      this.resetPlayStatus();
      this.currentFileId = midiUrl;
      this.isConvertedFile = isConverted;
      if (this.debug) console.log(`切换到新的MIDI文件: ${midiUrl}, 是否为转换后文件: ${isConverted}`);
    }

    if (this.debug) console.log('开始加载MIDI文件:', midiUrl);
    
    const MidiLib = this.getMidiLib();
    
    try {
      // 使用fetch获取MIDI文件
      fetch(midiUrl)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
          }
          return response.arrayBuffer();
        })
        .then(arrayBuffer => {
          if (this.debug) console.log('MIDI文件下载成功，开始解析');
          
          try {
            // 尝试使用构造函数直接解析
            const midi = new MidiLib(arrayBuffer);
            if (this.debug) console.log('使用构造函数直接解析MIDI成功');
            this.currentMidiData = midi;
            this.playMidi();
          } catch (err) {
            console.error('使用构造函数解析MIDI失败:', err);
            
            // 如果构造函数失败，尝试使用parse方法
            if (typeof MidiLib.parse === 'function') {
              try {
                const parsed = MidiLib.parse(arrayBuffer);
                if (this.debug) console.log('使用parse方法解析MIDI成功');
                this.currentMidiData = parsed;
                this.playMidi();
              } catch (parseErr) {
                console.error('使用parse方法解析MIDI失败:', parseErr);
              }
            }
          }
        })
        .catch(err => {
          console.error('获取MIDI文件失败:', err);
        });
    } catch (error) {
      console.error('调用加载MIDI的方法时出错:', error);
    }
  }

  // 从File对象加载并播放MIDI文件
  loadMidiFileAndPlay(file, isConverted = false) {
    if (!this.isMidiLibAvailable()) {
      console.error('@tonejs/midi 未加载，无法播放MIDI文件');
      return;
    }

    // 确保音频系统已初始化
    if (!this.initialized) {
      const initialized = this.initAudio();
      if (!initialized) return;
    }

    // 使用文件名作为标识
    const fileId = file.name;

    // 如果是同一个文件且处于暂停状态，直接恢复播放
    if (this.currentFileId === fileId && this.isPaused && this.currentMidiData) {
      this.resumeMidiPlay();
      return;
    }

    // 如果是不同的文件，需要重置状态
    if (this.currentFileId !== fileId) {
      this.resetPlayStatus();
      this.currentFileId = fileId;
      this.isConvertedFile = isConverted;
      if (this.debug) console.log(`切换到新的MIDI文件: ${fileId}, 是否为转换后文件: ${isConverted}`);
    }

    if (this.debug) console.log('开始读取MIDI文件:', file.name);
    
    const MidiLib = this.getMidiLib();
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const midiData = e.target.result;
      if (this.debug) console.log('MIDI文件读取成功，开始解析');
      
      try {
        // 检查可用的API方法
        if (this.debug) {
          console.log('Midi构造函数方法:', Object.keys(MidiLib));
          for (const key in MidiLib) {
            console.log(`- ${key}: ${typeof MidiLib[key]}`);
          }
        }
        
        // 尝试使用构造函数直接解析
        try {
          const midi = new MidiLib(midiData);
          if (this.debug) console.log('使用构造函数直接解析MIDI成功');
          this.currentMidiData = midi;
          this.playMidi();
          return;
        } catch (err) {
          console.error('使用构造函数解析MIDI失败:', err);
          
          // 如果构造函数失败，尝试使用parse方法
          if (typeof MidiLib.parse === 'function') {
            try {
              const parsed = MidiLib.parse(midiData);
              if (this.debug) console.log('使用parse方法解析MIDI成功');
              this.currentMidiData = parsed;
              this.playMidi();
              return;
            } catch (parseErr) {
              console.error('使用parse方法解析MIDI失败:', parseErr);
            }
          }
        }
        
        console.error('无法解析MIDI数据，尝试所有可用方法均失败');
      } catch (error) {
        console.error('调用Midi解析方法时出错:', error);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // 设置音量 (0-1之间的值)
  setVolume(volume) {
    this.volume = volume;
    // 对数缩放音量，使其更符合人耳感知
    const scaledVolume = Math.pow(volume, 2);
    
    if (this.synth && this.synth.volume) {
      this.synth.volume.value = Tone.gainToDb(scaledVolume);
      if (this.debug) console.log('设置音量:', volume, '转换为分贝:', Tone.gainToDb(scaledVolume));
    }
  }

  // 播放已加载的MIDI文件
  playMidi() {
    if (this.currentMidiData) {
      if (this.debug) console.info('当前MIDI数据:', this.currentMidiData);
      
      // 如果处于暂停状态，优先从暂停的位置恢复播放
      if (this.isPaused && this.currentFileId) {
        this.resumeMidiPlay();
        return;
      }
      
      this.midiStop = false;
      this.isPaused = false; // 重置暂停状态
      this.midiNotes = [];
      
      try {
        // 检查是否有标准格式的tracks属性
        if (Array.isArray(this.currentMidiData.tracks)) {
          // 收集所有轨道的音符
          this.currentMidiData.tracks.forEach((track, trackIndex) => {
            if (this.debug) {
              console.info('轨道索引:', trackIndex);
              if (track.instrument) {
                console.info('轨道乐器:', track.instrument.family, track.instrument.name);
              }
            }
            
            // 检查轨道是否有notes数组
            if (Array.isArray(track.notes)) {
              this.midiNotes = this.midiNotes.concat(track.notes);
            } else if (this.debug) {
              console.warn('轨道没有notes数组:', trackIndex);
            }
          });
        } 
        // 如果没有标准格式的tracks属性，尝试其他格式
        else if (this.debug) {
          console.warn('MIDI数据没有标准的tracks数组');
          console.log('MIDI数据结构:', Object.keys(this.currentMidiData));
        }
        
        // 检查是否成功收集到音符
        if (this.midiNotes.length === 0) {
          console.error('没有找到可播放的音符');
          
          // 尝试查找其他可能的音符结构
          if (Array.isArray(this.currentMidiData.notes)) {
            this.midiNotes = this.currentMidiData.notes;
            if (this.debug) console.log('从根级别notes属性找到音符');
          }
          
          // 如果仍然没有音符，取消播放
          if (this.midiNotes.length === 0) {
            return;
          }
        }
        
        if (this.debug) console.log(`找到${this.midiNotes.length}个音符`);
        
        // 重置所有音符的played状态
        this.midiNotes.forEach(note => {
          note.played = false;
        });
        
        this.startTime = +new Date();
        this.lastPlayedTime = 0;
        this.playLoop();
      } catch (error) {
        console.error('处理MIDI数据时出错:', error);
      }
    } else {
      console.error('没有MIDI数据可播放');
    }
  }

  // 播放循环
  playLoop() {
    if (this.midiStop) return;
    
    let unPlayedNotes = this.midiNotes.filter(n => !n.played);
    if (unPlayedNotes.length <= 0) {
      if (this.debug) console.log('所有音符播放完成');
      this.onMusicEnd();
      return;
    }
    
    let now = +new Date();
    let playedTime = now - this.startTime; // 单位毫秒ms
    
    if (this.debug && playedTime % 1000 < 30) { // 每秒只打印一次，避免日志过多
      console.log(`当前播放时间: ${(playedTime/1000).toFixed(1)}秒, 剩余音符: ${unPlayedNotes.length}`);
    }
    
    unPlayedNotes.forEach((note) => {
      if (playedTime >= note.time * 1000 && !note.played) {
        // 播放note
        note.played = true;
        this.playNote(note);
      }
    });
    
    setTimeout(() => {
      this.playLoop();
    }, 30);
  }

  // 播放单个音符
  playNote(note) {
    // 检查是否有可用的音频输出
    if (!this.synth) {
      console.warn('音频系统未初始化，无法播放音符');
      return;
    }
    
    try {
      // 调试音符对象结构
      if (this.debug) {
        console.log('音符对象结构:', Object.keys(note));
      }
      
      // 获取音符名称，尝试多种可能的属性
      let noteName = null;
      
      // 首先尝试获取音符名称
      if (typeof note.name === 'string') {
        noteName = note.name;
      } else if (typeof note.pitch === 'string') {
        noteName = note.pitch;
      } else if (typeof note.note === 'string') {
        noteName = note.note;
      }
      
      // 如果上面方法都没找到，尝试使用MIDI编号
      if (!noteName) {
        const midiNumber = note.midi || note.midiNumber || note.midiNote;
        if (typeof midiNumber === 'number') {
          try {
            noteName = Tone.Midi(midiNumber).toNote();
          } catch (e) {
            console.warn('无法将MIDI编号转换为音符名:', midiNumber, e);
          }
        }
      }
      
      // 如果仍然没有音符名，无法继续
      if (!noteName) {
        if (this.debug) console.warn('音符没有有效的名称或MIDI值:', note);
        return;
      }
      
      // 确保音符名称格式正确（例如："C4"而不是"c4"）
      if (typeof noteName === 'string') {
        // 确保第一个字母大写，避免某些版本的Tone.js不识别小写音符名
        noteName = noteName.charAt(0).toUpperCase() + noteName.slice(1);
      }
      
      // 获取持续时间和力度
      const duration = note.duration || 0.5;  // 默认半秒
      
      // 更精确地处理力度，使声音更自然
      // MIDI力度范围从0到127，这里将其标准化为0-1
      let velocity = note.velocity !== undefined ? note.velocity : 0.7;
      
      // 针对钢琴音色做特殊处理，普遍提高低音域的力度
      if (noteName.match(/[A-G]#?[0-2]/)) {
        // 低音域增强
        velocity = Math.min(velocity * 1.2, 1);
      } else if (noteName.match(/[A-G]#?[5-7]/)) {
        // 高音域减弱，创造更自然的音色平衡
        velocity = velocity * 0.9;
      }
      
      if (this.debug) console.log(`播放音符: ${noteName}, 持续时间: ${duration}, 力度: ${velocity}`);
      
      // 使用Tone.js播放音符，添加微量随机时间偏移和释放时间变化
      // 这可以模拟人类演奏的自然变化
      const timeVariation = Math.random() * 0.01; // 最多10ms的时间随机变化
      const releaseVariation = Math.random() * 0.1; // 释放时间的细微变化
      
      // 更精确地控制触发和释放，模拟钢琴触键和松开的物理特性
      this.synth.triggerAttackRelease(
        noteName,
        duration - timeVariation,
        Tone.now() + timeVariation,
        velocity
      );
      
      // 触发音符播放回调
      this.onNotePlay(note);
    } catch (err) {
      console.error('播放音符出错:', err, note);
    }
  }

  // 重置播放状态（切换文件时使用）
  resetPlayStatus() {
    // 停止当前播放
    this.midiStop = true;
    
    // 如果有正在播放的音符，全部停止
    if (this.synth) {
      this.synth.releaseAll();
    }
    
    // 重置状态
    this.isPaused = false;
    this.lastPlayedTime = 0;
    this.midiNotes = [];
    this.currentMidiData = null;
    
    if (this.debug) console.log('重置播放状态，准备播放新文件');
  }

  // 停止MIDI播放
  stopMidiPlay() {
    this.midiStop = true;
    this.isPaused = false; // 重置暂停状态
    this.currentMidiData = null;
    this.midiNotes = [];
    this.lastPlayedTime = 0; // 重置已播放时间
    // 注意：不清除currentFileId，因为可能还会再次播放同一文件
    
    // 如果有正在播放的音符，全部停止
    if (this.synth) {
      this.synth.releaseAll();
    }
    
    if (this.debug) console.log('停止播放，重置所有状态');
  }

  // 暂停播放
  pauseMidiPlay() {
    this.midiStop = true;
    this.isPaused = true; // 设置暂停状态为true
    this.lastPlayedTime = +new Date() - this.startTime;
    
    if (this.debug) console.log('暂停播放，已播放时间:', this.lastPlayedTime, 'ms');
  }

  // 恢复播放
  resumeMidiPlay() {
    if (this.currentMidiData && this.isPaused) {
      if (this.debug) console.log('从暂停位置恢复播放，已播放时间:', this.lastPlayedTime, 'ms');
      
      // 计算恢复播放的时间点
      const resumeTimeInSeconds = this.lastPlayedTime / 1000;
      
      // 重新标记哪些音符应该已经播放过
      if (this.midiNotes && this.midiNotes.length > 0) {
        // 重置所有音符的played状态
        this.midiNotes.forEach(note => {
          // 根据音符时间和暂停时间比较，决定哪些音符应该被标记为已播放
          note.played = note.time < resumeTimeInSeconds;
        });
        
        if (this.debug) {
          const playedCount = this.midiNotes.filter(n => n.played).length;
          console.log(`恢复播放: 已播放 ${playedCount} 个音符，剩余 ${this.midiNotes.length - playedCount} 个音符`);
        }
      }
      
      this.midiStop = false;
      this.isPaused = false; // 重置暂停状态
      this.startTime = +new Date() - this.lastPlayedTime;
      this.playLoop();
    }
  }

  // 获取当前播放文件的状态信息
  getPlaybackInfo() {
    return {
      fileId: this.currentFileId,
      isPlaying: !this.midiStop,
      isPaused: this.isPaused,
      isConverted: this.isConvertedFile,
      playbackTime: this.lastPlayedTime || (+new Date() - this.startTime)
    };
  }
}

// 导出MidiPlayer类
export { MidiPlayer }; 