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
    this.playbackSpeed = 1; // 播放倍速，默认1倍速
    
    // 添加对当前文件的标识
    this.currentFileId = null; // 可以是文件名、URL或其他唯一标识
    this.isConvertedFile = false; // 标识当前播放的是否为转换后的文件
    
    // 在构造函数中检查Midi对象
    this.checkMidiLibrary();
    
    // 绑定增强功能事件
    this.bindEnhancedEvents();
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

  // 绑定增强功能事件
  bindEnhancedEvents() {
    // 监听进度跳转事件
    document.addEventListener('midi-seek', (e) => {
      this.seekToPercentage(e.detail.percentage);
    });

    // 监听音量变化事件
    document.addEventListener('midi-volume-change', (e) => {
      this.setVolume(e.detail.volume);
    });

    // 监听倍速变化事件
    document.addEventListener('midi-speed-change', (e) => {
      this.setPlaybackSpeed(e.detail.speed);
    });
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

  // 从Blob对象加载并播放MIDI文件
  loadMidiBlobAndPlay(blob, isConverted = false) {
    if (!this.isMidiLibAvailable()) {
      console.error('@tonejs/midi 未加载，无法播放MIDI文件');
      return;
    }

    // 确保音频系统已初始化
    if (!this.initialized) {
      const initialized = this.initAudio();
      if (!initialized) return;
    }

    // 使用时间戳作为标识
    const fileId = `processed_midi_${Date.now()}`;

    // 重置状态并设置新的文件标识
    this.resetPlayStatus();
    this.currentFileId = fileId;
    this.isConvertedFile = isConverted;
    
    if (this.debug) console.log(`加载MIDI Blob: ${fileId}, 是否为转换后文件: ${isConverted}`);
    
    const MidiLib = this.getMidiLib();
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const midiData = e.target.result;
      if (this.debug) console.log('MIDI Blob读取成功，开始解析');
      
      try {
        // 尝试使用构造函数直接解析
        try {
          const midi = new MidiLib(midiData);
          if (this.debug) console.log('使用构造函数直接解析MIDI Blob成功');
          this.currentMidiData = midi;
          this.playMidi();
          return;
        } catch (err) {
          console.error('使用构造函数解析MIDI Blob失败:', err);
          
          // 如果构造函数失败，尝试使用parse方法
          if (typeof MidiLib.parse === 'function') {
            try {
              const parsed = MidiLib.parse(midiData);
              if (this.debug) console.log('使用parse方法解析MIDI Blob成功');
              this.currentMidiData = parsed;
              this.playMidi();
              return;
            } catch (parseErr) {
              console.error('使用parse方法解析MIDI Blob失败:', parseErr);
            }
          }
        }
        
        console.error('无法解析MIDI Blob数据，尝试所有可用方法均失败');
      } catch (error) {
        console.error('调用Midi解析方法时出错:', error);
      }
    };
    reader.readAsArrayBuffer(blob);
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

  // 设置播放倍速
  setPlaybackSpeed(speed) {
    if (this.debug) console.log('设置播放倍速从', this.playbackSpeed, '到', speed);
    
    // 如果正在播放，需要重新计算时间
    if (!this.midiStop && this.currentMidiData) {
      // 计算当前音乐播放时间（考虑当前倍速）
      const musicTimeElapsed = (+new Date() - this.startTime) * this.playbackSpeed;
      
      if (this.debug) console.log('倍速切换时的音乐播放时间:', musicTimeElapsed, 'ms');
      
      // 更新倍速
      this.playbackSpeed = speed;
      
      // 重新设置开始时间，使得音乐播放时间保持一致
      this.startTime = +new Date() - (musicTimeElapsed / this.playbackSpeed);
      
      if (this.debug) console.log('新的开始时间:', this.startTime, '当前时间:', +new Date());
    } else {
      // 如果没有在播放，直接更新倍速
      this.playbackSpeed = speed;
    }
  }

  // 跳转到指定百分比位置
  seekToPercentage(percentage) {
    if (!this.currentMidiData || !this.midiNotes || this.midiNotes.length === 0) {
      if (this.debug) console.warn('无法跳转：没有有效的MIDI数据');
      return;
    }

    const totalDuration = this.calculateTotalDuration();
    const seekTime = totalDuration * percentage;
    const seekTimeMs = seekTime * 1000;

    if (this.debug) console.log(`跳转到 ${(percentage * 100).toFixed(1)}% 位置，时间: ${seekTime.toFixed(2)}秒`);

    // 暂停当前播放
    this.pauseForSeek();

    // 重新标记音符的播放状态
    this.midiNotes.forEach(note => {
      note.played = note.time < seekTime;
    });

    // 从新位置开始播放
    this.resumeFromSeek(seekTimeMs);
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
          // 分析并标记每个轨道的左右手信息
          this.currentMidiData.tracks.forEach((track, trackIndex) => {
            if (this.debug) {
              console.info('轨道索引:', trackIndex);
              console.info('轨道名称:', track.name);
              if (track.instrument) {
                console.info('轨道乐器:', track.instrument.family, track.instrument.name);
              }
            }
            
            // 检查轨道是否有notes数组
            if (Array.isArray(track.notes)) {
              // 确定当前轨道是左手还是右手
              const handType = this.determineTrackHand(track, trackIndex);
              
              // 为轨道中的每个音符添加手部信息
              track.notes.forEach(note => {
                note.hand = handType;
                note.trackIndex = trackIndex;
                note.trackName = track.name || `轨道 ${trackIndex + 1}`;
              });
              
              this.midiNotes = this.midiNotes.concat(track.notes);
              
              if (this.debug) {
                console.log(`轨道 ${trackIndex} (${track.name || '未命名'}) 识别为: ${handType}手, 包含 ${track.notes.length} 个音符`);
              }
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
    // 修正：音乐播放时间 = (当前时间 - 开始时间) * 倍速
    let playedTime = (now - this.startTime) * this.playbackSpeed;
    
    if (this.debug && Math.floor(playedTime / 1000) !== Math.floor((playedTime - 100) / 1000)) { // 每秒只打印一次
      console.log(`当前播放时间: ${(playedTime/1000).toFixed(1)}秒 (${this.playbackSpeed}x倍速), 剩余音符: ${unPlayedNotes.length}`);
    }
    
    unPlayedNotes.forEach((note) => {
      if (playedTime >= note.time * 1000 && !note.played) {
        // 播放note
        note.played = true;
        this.playNote(note);
      }
    });
    
    // 根据倍速调整循环间隔 - 倍速越快，间隔越短
    const loopInterval = Math.max(5, 30 / this.playbackSpeed);
    setTimeout(() => {
      this.playLoop();
    }, loopInterval);
    
    // 发送进度更新事件给增强控制器
    this.dispatchProgressUpdate();
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
        console.log('音符手部信息:', note.hand, '轨道:', note.trackIndex);
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
      
      // 获取左右手信息
      const hand = note.hand || 'unknown';
      
      if (this.debug) {
        console.log(`播放音符: ${noteName}, 手部: ${hand}, 轨道: ${note.trackIndex}, 持续时间: ${duration}, 力度: ${velocity}`);
      }
      
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
      
      // 触发带手部信息的钢琴键盘视觉效果
      this.triggerPianoKeyVisual(noteName, duration * 1000, hand); // 转换为毫秒
      
      // 触发音符播放回调，传递完整的音符信息包括手部信息
      this.onNotePlay({...note, hand, noteName});
    } catch (err) {
      console.error('播放音符出错:', err, note);
    }
  }

  // 触发钢琴键盘视觉效果
  triggerPianoKeyVisual(noteName, durationMs = 300, hand = 'unknown') {
    try {
      // 在DOM中找到对应的钢琴键
      const pianoKey = document.querySelector(`.piano-key[data-name="${noteName}"]`);
      
      if (pianoKey) {
        // 判断是白键还是黑键
        const keyClass = pianoKey.classList.contains('wkey') ? 'wkey' : 'bkey';
        
        // 添加按下效果
        pianoKey.classList.add(`${keyClass}-active`);
        
        // 触发带手部信息的钢琴卷帘窗矩形条效果
        // 检查是否存在piano实例和triggerPianoRollEffect方法
        if (window.pianoInstance && typeof window.pianoInstance.triggerPianoRollEffect === 'function') {
          window.pianoInstance.triggerPianoRollEffect(pianoKey, hand);
          if (this.debug) console.log(`MIDI播放触发${hand}手矩形条效果: ${noteName}`);
        }
        
        // 在音符持续时间结束后移除效果
        setTimeout(() => {
          pianoKey.classList.remove(`${keyClass}-active`);
        }, durationMs);
        
        if (this.debug) console.log(`触发${hand}手钢琴键视觉效果: ${noteName}, 持续时间: ${durationMs}ms`);
      } else if (this.debug) {
        console.warn(`找不到对应的钢琴键: ${noteName}`);
      }
    } catch (err) {
      console.error('触发钢琴键视觉效果时出错:', err);
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
    
    // 保留文件ID和转换状态，以便停止后仍能下载
    // 不要清除: this.currentFileId 和 this.isConvertedFile
    
    // 清理播放状态
    this.currentMidiData = null;
    this.midiNotes = [];
    this.lastPlayedTime = 0; // 重置已播放时间
    
    // 如果有正在播放的音符，全部停止
    if (this.synth) {
      this.synth.releaseAll();
    }
    
    if (this.debug) console.log('停止播放，保留文件标识以便下载');
  }

  // 暂停播放
  pauseMidiPlay() {
    if (this.currentMidiData && !this.midiStop) {
      this.isPaused = true;
      this.midiStop = true;
      // 修正：考虑倍速的时间计算
      this.lastPlayedTime = (+new Date() - this.startTime) * this.playbackSpeed;
      if (this.debug) console.log('暂停播放，已播放时间:', this.lastPlayedTime, 'ms，倍速:', this.playbackSpeed);
    }
  }

  // 专门用于拖拽进度条时的暂停，不清空当前播放状态
  pauseForSeek() {
    if (!this.currentMidiData || !this.midiNotes || this.midiNotes.length === 0) {
      return false;
    }
    
    // 只设置暂停和停止标志，不清空数据
    this.isPaused = true;
    this.midiStop = true;
    // 修正：考虑倍速的时间计算
    this.lastPlayedTime = (+new Date() - this.startTime) * this.playbackSpeed;
    
    if (this.debug) console.log('暂停用于跳转，当前播放时间:', this.lastPlayedTime, 'ms，倍速:', this.playbackSpeed);
    return true;
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
      // 修正：考虑倍速的开始时间计算
      this.startTime = +new Date() - (this.lastPlayedTime / this.playbackSpeed);
      this.playLoop();
    }
  }

  // 从指定时间位置恢复播放（用于拖拽进度条后）
  resumeFromSeek(seekTimeMs) {
    if (!this.currentMidiData || !this.midiNotes || this.midiNotes.length === 0) {
      if (this.debug) console.error('无法从跳转恢复：没有有效的MIDI数据');
      return false;
    }
    
    // 修正：考虑倍速的开始时间计算
    this.startTime = +new Date() - (seekTimeMs / this.playbackSpeed);
    this.lastPlayedTime = seekTimeMs;
    this.isPaused = false;
    this.midiStop = false;
    
    if (this.debug) console.log(`从 ${seekTimeMs/1000} 秒位置恢复播放，倍速: ${this.playbackSpeed}x，共有 ${this.midiNotes.length} 个音符，已标记播放 ${this.midiNotes.filter(n => n.played).length} 个`);
    
    // 立即开始播放循环
    this.playLoop();
    return true;
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

  // 计算MIDI文件的总时长（秒）
  calculateTotalDuration() {
    if (!this.midiNotes || this.midiNotes.length === 0) {
      return 0;
    }
    
    // 计算最后一个音符的结束时间
    const lastNote = this.midiNotes.reduce((prev, current) => {
      return (prev.time + prev.duration > current.time + current.duration) ? prev : current;
    });
    
    return lastNote.time + lastNote.duration;
  }

  // 获取当前播放时间（秒）- 用于调试和验证
  getCurrentPlayTime() {
    if (this.midiStop || !this.startTime) return 0;
    
    const realTimeElapsed = (+new Date() - this.startTime); // 实际经过的毫秒数
    const musicTimeElapsed = realTimeElapsed * this.playbackSpeed; // 音乐时间轴上的毫秒数
    return musicTimeElapsed / 1000; // 转换为秒
  }

  // 分发进度更新事件
  dispatchProgressUpdate() {
    if (!this.currentMidiData || this.midiStop) return;
    
    // 检查是否有增强控制器正在拖拽，如果是则不发送进度更新
    const isDragging = document.querySelector('.midi-player-enhanced')?.classList.contains('dragging') || 
                      document.querySelector('#midi-progress-thumb')?.classList.contains('dragging');
    if (isDragging) return;
    
    // 正确计算：音乐播放时间 = (当前时间 - 开始时间) * 倍速 / 1000（转换为秒）
    // 这里的逻辑是：实际经过的时间 * 倍速 = 音乐时间轴上的播放时间
    const realTimeElapsed = (+new Date() - this.startTime); // 实际经过的毫秒数
    const musicTimeElapsed = realTimeElapsed * this.playbackSpeed; // 音乐时间轴上的毫秒数
    const currentTime = musicTimeElapsed / 1000; // 转换为秒
    const totalTime = this.calculateTotalDuration();
    
    if (this.debug && Math.floor(currentTime) !== Math.floor((currentTime - 0.1))) { // 每秒只打印一次
      console.log(`进度更新 - 实际时间: ${(realTimeElapsed/1000).toFixed(1)}s, 音乐时间: ${currentTime.toFixed(1)}s, 倍速: ${this.playbackSpeed}x`);
    }
    
    const event = new CustomEvent('midi-progress-update', {
      detail: { currentTime, totalTime }
    });
    document.dispatchEvent(event);
  }

  // 新增方法：确定轨道的左右手类型
  determineTrackHand(track, trackIndex) {
    // 方法1: 基于轨道名称识别
    if (track.name) {
      const trackName = track.name.toLowerCase();
      
      // 检查常见的左右手标识词
      const leftHandKeywords = ['left', 'bass', 'baixo', '左手', 'ひだり', 'gauche', 'links', 'izquierda', 'lh', 'l.h.'];
      const rightHandKeywords = ['right', 'treble', 'melody', 'soprano', '右手', 'みぎ', 'droite', 'rechts', 'derecha', 'rh', 'r.h.'];
      
      for (const keyword of leftHandKeywords) {
        if (trackName.includes(keyword)) {
          return 'left';
        }
      }
      
      for (const keyword of rightHandKeywords) {
        if (trackName.includes(keyword)) {
          return 'right';
        }
      }
    }
    
    // 方法2: 基于轨道索引（钢琴MIDI文件的常见约定）
    if (trackIndex === 0) {
      return 'right';  // 第一个轨道通常是主旋律（右手）
    } else if (trackIndex === 1) {
      return 'left';   // 第二个轨道通常是伴奏（左手）
    }
    
    // 方法3: 基于音符的平均音高
    if (track.notes && track.notes.length > 0) {
      const avgPitch = track.notes.reduce((sum, note) => {
        const midiNumber = note.midi || this.getMidiNumber(note);
        return sum + midiNumber;
      }, 0) / track.notes.length;
      
      // 如果平均音高低于中央C（60），认为是左手
      return avgPitch < 60 ? 'left' : 'right';
    }
    
    // 默认情况：基于轨道索引交替分配
    return trackIndex % 2 === 0 ? 'right' : 'left';
  }

  // 辅助方法：获取音符的MIDI编号
  getMidiNumber(note) {
    if (note.midi) return note.midi;
    if (note.midiNumber) return note.midiNumber;
    if (note.name) {
      try {
        return Tone.Midi(note.name).toMidi();
      } catch (e) {
        return 60; // 默认中央C
      }
    }
    return 60;
  }

  // 新增方法：获取轨道统计信息
  getTracksInfo() {
    if (!this.currentMidiData || !this.currentMidiData.tracks) {
      return null;
    }
    
    return this.currentMidiData.tracks.map((track, index) => ({
      index,
      name: track.name || `轨道 ${index + 1}`,
      notesCount: track.notes ? track.notes.length : 0,
      hand: this.determineTrackHand(track, index),
      instrument: track.instrument ? track.instrument.name : '未知'
    }));
  }
}

export default MidiPlayer; 