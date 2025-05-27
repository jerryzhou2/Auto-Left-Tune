// DVD播放器视觉效果控制器
class DVDPlayer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.isPlaying = false;
        this.init();
    }

    init() {
        if (!this.container) return;
        
        // 添加播放状态监听
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 监听播放按钮状态变化
        const playButton = document.getElementById('play-pause-midi-btn');
        const stopButton = document.getElementById('stop-midi-btn');

        if (playButton) {
            playButton.addEventListener('click', () => {
                this.togglePlayState();
            });
        }

        if (stopButton) {
            stopButton.addEventListener('click', () => {
                this.stop();
            });
        }

        // 监听MIDI播放事件（如果有的话）
        document.addEventListener('midiPlay', () => {
            this.play();
        });

        document.addEventListener('midiPause', () => {
            this.pause();
        });

        document.addEventListener('midiStop', () => {
            this.stop();
        });
    }

    togglePlayState() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        this.isPlaying = true;
        this.container.classList.add('playing');
        
        // 更新播放按钮文本
        const playButton = document.getElementById('play-pause-midi-btn');
        if (playButton) {
            playButton.innerHTML = '⏸️ 暂停';
            playButton.classList.remove('btn-success');
            playButton.classList.add('btn-danger');
        }

        // 添加播放特效
        this.addPlayingEffects();
    }

    pause() {
        this.isPlaying = false;
        this.container.classList.remove('playing');
        
        // 更新播放按钮文本
        const playButton = document.getElementById('play-pause-midi-btn');
        if (playButton) {
            playButton.innerHTML = '▶️ 播放';
            playButton.classList.remove('btn-danger');
            playButton.classList.add('btn-success');
        }

        // 移除播放特效
        this.removePlayingEffects();
    }

    stop() {
        this.isPlaying = false;
        this.container.classList.remove('playing');
        
        // 重置播放按钮
        const playButton = document.getElementById('play-pause-midi-btn');
        if (playButton) {
            playButton.innerHTML = '▶️ 播放';
            playButton.classList.remove('btn-danger');
            playButton.classList.add('btn-success');
        }

        // 移除所有特效
        this.removePlayingEffects();
    }

    addPlayingEffects() {
        // 添加音符飘落效果
        this.startMusicNotes();
        
        // 添加彩虹光环效果
        this.addRainbowGlow();
    }

    removePlayingEffects() {
        // 停止音符效果
        this.stopMusicNotes();
        
        // 移除光环效果
        this.removeRainbowGlow();
    }

    startMusicNotes() {
        // 创建音符飘落动画
        this.musicNotesInterval = setInterval(() => {
            this.createFloatingNote();
        }, 800);
    }

    stopMusicNotes() {
        if (this.musicNotesInterval) {
            clearInterval(this.musicNotesInterval);
            this.musicNotesInterval = null;
        }
        
        // 清除现有的音符
        const notes = document.querySelectorAll('.floating-note');
        notes.forEach(note => note.remove());
    }

    createFloatingNote() {
        const note = document.createElement('div');
        note.className = 'floating-note';
        
        // 随机选择音符符号
        const noteSymbols = ['♪', '♫', '♬', '🎵', '🎶'];
        note.textContent = noteSymbols[Math.floor(Math.random() * noteSymbols.length)];
        
        // 随机位置
        const containerRect = this.container.getBoundingClientRect();
        note.style.left = Math.random() * (containerRect.width - 30) + 'px';
        note.style.top = '0px';
        
        // 随机颜色
        const colors = ['#667eea', '#764ba2', '#f093fb', '#4ecdc4', '#ffe066'];
        note.style.color = colors[Math.floor(Math.random() * colors.length)];
        
        this.container.appendChild(note);
        
        // 动画
        note.style.animation = 'floatUp 3s ease-out forwards';
        
        // 3秒后移除
        setTimeout(() => {
            if (note.parentNode) {
                note.remove();
            }
        }, 3000);
    }

    addRainbowGlow() {
        this.container.style.boxShadow = `
            inset 0 0 20px rgba(102, 126, 234, 0.3),
            0 5px 25px rgba(102, 126, 234, 0.4),
            0 0 30px rgba(240, 147, 251, 0.3)
        `;
    }

    removeRainbowGlow() {
        this.container.style.boxShadow = `
            inset 0 0 20px rgba(0, 0, 0, 0.1),
            0 5px 15px rgba(0, 0, 0, 0.2)
        `;
    }
}

// 添加CSS动画样式
const style = document.createElement('style');
style.textContent = `
    .floating-note {
        position: absolute;
        font-size: 1.5rem;
        font-weight: bold;
        pointer-events: none;
        z-index: 10;
        opacity: 0.8;
    }

    @keyframes floatUp {
        0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0.8;
        }
        50% {
            opacity: 1;
        }
        100% {
            transform: translateY(-120px) rotate(360deg);
            opacity: 0;
        }
    }

    .dvd-player.playing {
        animation: dvdSpin 3s linear infinite, colorShift 2s ease-in-out infinite alternate;
    }

    @keyframes colorShift {
        0% {
            filter: hue-rotate(0deg);
        }
        100% {
            filter: hue-rotate(60deg);
        }
    }

    /* 增强的音符动画 */
    .dvd-player.playing::after {
        animation: musicNote 2s ease-in-out infinite, noteGlow 1.5s ease-in-out infinite alternate;
    }

    @keyframes noteGlow {
        0% {
            text-shadow: 0 0 5px currentColor;
        }
        100% {
            text-shadow: 0 0 15px currentColor, 0 0 25px currentColor;
        }
    }
`;
document.head.appendChild(style);

// 导出类
export default DVDPlayer; 