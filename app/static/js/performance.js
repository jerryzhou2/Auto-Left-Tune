/**
 * 演奏区专用JavaScript
 * 处理歌曲列表和界面切换功能
 */

// 歌曲数据缓存
let songsData = null;

// 演奏示例MIDI播放器类
class DemoMidiPlayer {
    constructor(options = {}) {
        this.currentMidiData = null;
        this.midiNotes = [];
        this.midiStop = false;
        this.isPaused = false;
        this.audioContext = null;
        this.synth = null;
        this.onNotePlay = options.onNotePlay || function() {};
        this.onMusicEnd = options.onMusicEnd || function() {};
        this.debug = options.debug || false;
        this.initialized = false;
        this.volume = options.volume || 0.7;
        this.lastPlayedTime = 0;
        this.playbackSpeed = 1;
        
        this.currentFileId = null;
        this.isConvertedFile = false;
        
        this.checkMidiLibrary();
    }

    // 检查Midi库是否可用
    checkMidiLibrary() {
        this.isMidiLibAvailable = () => {
            return typeof Midi !== 'undefined' && Midi && typeof Midi.fromUrl === 'function';
        };
        
        this.getMidiLib = () => {
            return typeof Midi !== 'undefined' ? Midi : null;
        };
    }

    // 初始化音频系统
    initAudio() {
        if (this.initialized) return true;
        
        if (typeof Tone === 'undefined') {
            console.error('Tone.js 未加载');
            return false;
        }

        try {
            // 确保音频上下文已启动
            if (Tone.context.state !== 'running') {
                Tone.start();
            }

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
            
            this.initialized = true;
            this.setVolume(this.volume);
            
            if (this.debug) console.log('MIDI播放器音频系统初始化成功');
            return true;
        } catch (error) {
            console.error('初始化音频系统失败:', error);
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

    // 设置音量
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.synth) {
            this.synth.volume.value = Tone.gainToDb(this.volume);
        }
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
            if (this.debug) console.log(`切换到新的MIDI文件: ${midiUrl}`);
        }

        if (this.debug) console.log('开始加载MIDI文件:', midiUrl);
        
        const MidiLib = this.getMidiLib();
        
        MidiLib.fromUrl(midiUrl).then((data) => {
            this.currentMidiData = data;
            if (this.debug) console.log('MIDI文件加载成功，开始播放');
            this.playMidi();
        }).catch((error) => {
            console.error('加载MIDI文件失败:', error);
        });
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
            this.isPaused = false;
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
                    
                    // 显示轨道信息 - 注释掉，演奏示例播放时不显示轨道信息
                    // this.displayTracksInfo();
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
        let playedTime = (now - this.startTime) * this.playbackSpeed;
        
        unPlayedNotes.forEach((note) => {
            if (playedTime >= note.time * 1000 && !note.played) {
                note.played = true;
                this.playNote(note);
            }
        });
        
        const loopInterval = Math.max(5, 30 / this.playbackSpeed);
        setTimeout(() => {
            this.playLoop();
        }, loopInterval);
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
            
            // 使用Tone.js播放音符
            this.synth.triggerAttackRelease(
                noteName,
                duration,
                Tone.now(),
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
                    if (this.debug) console.log(`演奏示例触发${hand}手矩形条效果: ${noteName}`);
                }

                // 同时更新左右手按键显示框
                if (window.pianoInstance && typeof window.pianoInstance.addHandKeyDisplay === 'function') {
                    if (hand === 'left' || hand === 'right') {
                        window.pianoInstance.addHandKeyDisplay(noteName, hand, durationMs);
                        if (this.debug) console.log(`演奏示例更新${hand}手按键显示: ${noteName}`);
                    }
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

    // 暂停播放
    pauseMidiPlay() {
        if (this.currentMidiData && !this.midiStop) {
            this.isPaused = true;
            this.midiStop = true;
            // 保存当前播放时间
            this.lastPlayedTime = (+new Date() - this.startTime) * this.playbackSpeed;
            if (this.synth) {
                this.synth.releaseAll();
            }
            if (this.debug) console.log('暂停播放，已播放时间:', this.lastPlayedTime, 'ms');
        }
    }

    // 恢复播放
    resumeMidiPlay() {
        if (!this.isPaused || !this.currentMidiData) return;
        
        if (this.debug) console.log('从暂停位置恢复播放，已播放时间:', this.lastPlayedTime, 'ms');
        
        // 计算恢复播放的时间点
        const resumeTimeInSeconds = this.lastPlayedTime / 1000;
        
        // 重新标记哪些音符应该已经播放过
        this.midiNotes.forEach(note => {
            note.played = note.time < resumeTimeInSeconds;
        });
        
        this.isPaused = false;
        this.midiStop = false;
        
        // 重新计算开始时间，确保音乐从正确的位置继续
        this.startTime = +new Date() - (this.lastPlayedTime / this.playbackSpeed);
        
        this.playLoop();
        if (this.debug) console.log('恢复播放成功');
    }

    // 停止播放
    stopMidiPlay() {
        this.midiStop = true;
        this.isPaused = false;
        
        this.currentMidiData = null;
        this.midiNotes = [];
        this.lastPlayedTime = 0;
        
        if (this.synth) {
            this.synth.releaseAll();
        }
        
        if (this.debug) console.log('停止播放');
    }

    // 重置播放状态
    resetPlayStatus() {
        this.midiStop = true;
        
        if (this.synth) {
            this.synth.releaseAll();
        }
        
        this.isPaused = false;
        this.lastPlayedTime = 0;
        this.midiNotes = [];
        this.currentMidiData = null;
        
        if (this.debug) console.log('重置播放状态');
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

    // 显示轨道信息
    displayTracksInfo() {
        const tracksInfo = this.getTracksInfo();
        if (!tracksInfo) return;
        
        const container = document.getElementById('tracks-info-container');
        const tracksInfoElement = document.getElementById('tracks-info');
        const demoListView = document.getElementById('demo-list-view');
        
        if (container && tracksInfoElement && demoListView) {
            // 隐藏演奏示例列表，显示轨道信息
            demoListView.style.display = 'none';
            container.style.display = 'block';
            
            // 生成轨道信息HTML
            tracksInfoElement.innerHTML = tracksInfo.map(track => 
                `<div class="track-info ${track.hand}-hand">
                    <div class="track-name-info">
                        <strong>${track.name}</strong>
                        <span class="track-hand-label ${track.hand}">${track.hand === 'left' ? '左手' : track.hand === 'right' ? '右手' : '未知'}</span>
                    </div>
                    <div class="track-details">
                        <span>音符数量: ${track.notesCount}</span>
                        <span>乐器: ${track.instrument}</span>
                    </div>
                </div>`
            ).join('');
            
            console.log('轨道信息已显示:', tracksInfo);
        }
    }

    // 隐藏轨道信息
    hideTracksInfo() {
        const container = document.getElementById('tracks-info-container');
        const demoListView = document.getElementById('demo-list-view');
        
        if (container && demoListView) {
            container.style.display = 'none';
            demoListView.style.display = 'block';
        }
    }
}

// 演奏示例数据
const demoData = {
    demo1: {
        id: "demo1",
        name: "打上花火",
        file: "/static/data/demo/dashanghuahuo.mid"
    },
    demo2: {
        id: "demo2",
        name: "等你下课", 
        file: "/static/data/demo/dengnixiake.mid"
    },
    demo3: {
        id: "demo3",
        name: "梦中的婚礼",
        file: "/static/data/demo/mengzhongdehunli.mid"
    },
    demo4: {
        id: "demo4",
        name: "晴天",
        file: "/static/data/demo/qingtian.mid"
    },
    demo5: {
        id: "demo5",
        name: "至少还有你", 
        file: "/static/data/demo/zhishaohaiyouni.mid"
    }
};

// 全局演奏示例播放器实例
let demoMidiPlayer = null;
let currentPlayingDemo = null;

// 加载歌曲数据
async function loadSongsData() {
    try {
        const response = await fetch('/static/data/songs.json');
        songsData = await response.json();
        console.log('歌曲数据已加载');
    } catch (error) {
        console.error('加载歌曲数据失败:', error);
    }
}

// 演奏示例功能
function initDemoListFeature() {
    // 初始化MIDI播放器
    demoMidiPlayer = new DemoMidiPlayer({
        onNotePlay: function(note) {
            // 音符播放时的回调
        },
        onMusicEnd: function() {
            // 音乐结束时的回调
            resetDemoUI();
            console.log('演奏示例播放完成');
        },
        debug: true
    });

    const demoItems = document.querySelectorAll('.demo-item');
    
    demoItems.forEach(item => {
        const demoId = item.getAttribute('data-demo');
        const playBtn = item.querySelector('.demo-play-btn');
        const pauseBtn = item.querySelector('.demo-pause-btn');
        const stopBtn = item.querySelector('.demo-stop-btn');
        const controls = item.querySelector('.demo-controls');
        
        // 鼠标悬停显示控制按钮
        item.addEventListener('mouseenter', () => {
            controls.style.display = 'flex';
        });
        
        item.addEventListener('mouseleave', () => {
            if (!item.classList.contains('playing')) {
                controls.style.display = 'none';
            }
        });

        // 播放按钮事件
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playDemo(demoId);
        });

        // 暂停按钮事件
        pauseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            pauseDemo();
        });

        // 停止按钮事件
        stopBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            stopDemo();
        });
    });
}

// 播放演奏示例
function playDemo(demoId) {
    const demo = demoData[demoId];
    if (!demo) return;

    // 确保音频上下文已启动
    if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
        Tone.start();
    }

    // 如果是同一首歌且处于暂停状态，直接恢复播放
    if (currentPlayingDemo === demoId && demoMidiPlayer && demoMidiPlayer.isPaused) {
        demoMidiPlayer.resumeMidiPlay();
        updateDemoUI(demoId, 'playing');
        console.log(`恢复播放演奏示例: ${demo.name}`);
        return;
    }

    // 停止当前播放的示例
    if (currentPlayingDemo && currentPlayingDemo !== demoId) {
        stopDemo();
    }

    // 加载并播放MIDI
    demoMidiPlayer.loadMidiAndPlay(demo.file);
    
    // 更新UI
    updateDemoUI(demoId, 'playing');
    currentPlayingDemo = demoId;
    
    console.log(`开始播放演奏示例: ${demo.name}`);
}

// 暂停演奏示例
function pauseDemo() {
    if (demoMidiPlayer) {
        demoMidiPlayer.pauseMidiPlay();
        updateDemoUI(currentPlayingDemo, 'paused');
    }
}

// 停止演奏示例
function stopDemo() {
    if (demoMidiPlayer) {
        demoMidiPlayer.stopMidiPlay();
        // 隐藏轨道信息
        demoMidiPlayer.hideTracksInfo();
        resetDemoUI();
    }
}

// 更新演奏示例UI
function updateDemoUI(demoId, state) {
    const demoItem = document.querySelector(`.demo-item[data-demo="${demoId}"]`);
    if (!demoItem) return;

    const playBtn = demoItem.querySelector('.demo-play-btn');
    const pauseBtn = demoItem.querySelector('.demo-pause-btn');
    const stopBtn = demoItem.querySelector('.demo-stop-btn');
    const controls = demoItem.querySelector('.demo-controls');

    // 移除所有其他项目的播放状态
    document.querySelectorAll('.demo-item').forEach(item => {
        item.classList.remove('playing');
        const itemControls = item.querySelector('.demo-controls');
        if (item !== demoItem) {
            itemControls.style.display = 'none';
        }
    });

    if (state === 'playing') {
        demoItem.classList.add('playing');
        controls.style.display = 'flex';
        playBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-flex';
        stopBtn.style.display = 'inline-flex';
    } else if (state === 'paused') {
        demoItem.classList.add('playing');
        controls.style.display = 'flex';
        playBtn.style.display = 'inline-flex';
        pauseBtn.style.display = 'none';
        stopBtn.style.display = 'inline-flex';
    }
}

// 重置演奏示例UI
function resetDemoUI() {
    document.querySelectorAll('.demo-item').forEach(item => {
        item.classList.remove('playing');
        const controls = item.querySelector('.demo-controls');
        const playBtn = item.querySelector('.demo-play-btn');
        const pauseBtn = item.querySelector('.demo-pause-btn');
        const stopBtn = item.querySelector('.demo-stop-btn');
        
        controls.style.display = 'none';
        playBtn.style.display = 'inline-flex';
        pauseBtn.style.display = 'none';
        stopBtn.style.display = 'none';
    });
    
    // 如果有MIDI播放器实例，也隐藏轨道信息
    if (demoMidiPlayer) {
        demoMidiPlayer.hideTracksInfo();
    }
    
    currentPlayingDemo = null;
}

// 歌曲列表功能
function initSongListFeature() {
    const songListView = document.getElementById('song-list-view');
    const tutorialView = document.getElementById('tutorial-view');
    const songItems = document.querySelectorAll('.song-item');
    const backButton = document.getElementById('back-to-list');
    const currentSongTitle = document.getElementById('current-song-title');
    
    // 点击歌曲项事件
    songItems.forEach(item => {
        item.addEventListener('click', async () => {
            const songId = item.getAttribute('data-song');
            
            // 确保歌曲数据已加载
            if (!songsData) {
                await loadSongsData();
            }
            
            const songInfo = songsData.songs[songId];
            if (songInfo) {
                // 更新教程界面标题
                currentSongTitle.textContent = `🎵 ${songInfo.name} - 演奏方法`;
                
                // 加载歌曲内容
                loadSongContent(songInfo);
                
                // 切换到教程界面
                switchView('tutorial');
                
                console.log(`加载 ${songInfo.name} 的演奏方法`);
            }
        });
    });
    
    // 返回按钮事件
    backButton.addEventListener('click', () => {
        switchView('list');
    });
    
    // 界面切换函数
    function switchView(viewType) {
        if (viewType === 'tutorial') {
            songListView.classList.remove('active');
            setTimeout(() => {
                tutorialView.classList.add('active');
            }, 150);
        } else if (viewType === 'list') {
            tutorialView.classList.remove('active');
            setTimeout(() => {
                songListView.classList.add('active');
            }, 150);
        }
    }
}

// 加载歌曲内容到教程界面
function loadSongContent(songInfo) {
    // 更新歌曲描述
    const descriptionElement = document.getElementById('song-description');
    descriptionElement.textContent = songInfo.description;
    
    // 更新难度等级
    const levelElement = document.getElementById('song-level');
    levelElement.textContent = songInfo.level;
    levelElement.className = 'level-badge';
    
    // 根据难度等级添加相应的CSS类
    switch(songInfo.level) {
        case '初级':
            levelElement.classList.add('beginner');
            break;
        case '中级':
            levelElement.classList.add('intermediate');
            break;
        case '高级':
            levelElement.classList.add('advanced');
            break;
    }
    
    // 更新演奏指导
    const instructionElement = document.getElementById('tutorial-instruction');
    instructionElement.textContent = songInfo.tutorial.instruction;
    
    // 更新按键序列
    const sequenceElement = document.getElementById('key-sequence');
    sequenceElement.textContent = songInfo.tutorial.sequence;
    
    // 更新演奏技巧
    const tipsElement = document.getElementById('playing-tips');
    tipsElement.innerHTML = '';
    songInfo.tutorial.tips.forEach(tip => {
        const li = document.createElement('li');
        li.textContent = tip;
        tipsElement.appendChild(li);
    });
}

// 为歌曲项添加难度等级样式
function applySongLevelStyles() {
    const songLevels = document.querySelectorAll('.song-level');
    songLevels.forEach(levelElement => {
        const level = levelElement.textContent;
        switch(level) {
            case '初级':
                levelElement.style.background = 'rgba(34, 197, 94, 0.2)';
                levelElement.style.color = '#22c55e';
                break;
            case '中级':
                levelElement.style.background = 'rgba(251, 191, 36, 0.2)';
                levelElement.style.color = '#f59e0b';
                break;
            case '高级':
                levelElement.style.background = 'rgba(239, 68, 68, 0.2)';
                levelElement.style.color = '#ef4444';
                break;
        }
    });
}

// 演奏区初始化函数
async function initPerformanceArea() {
    // 加载歌曲数据
    await loadSongsData();
    
    // 初始化歌曲列表功能
    initSongListFeature();
    
    // 初始化演奏示例功能
    initDemoListFeature();
    
    // 应用歌曲难度等级样式
    applySongLevelStyles();
    
    console.log('演奏区功能已初始化');
}

// 导出函数（如果使用模块化）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initPerformanceArea,
        initSongListFeature,
        initDemoListFeature,
        loadSongsData,
        loadSongContent
    };
} 