/**
 * 增强视觉效果管理器
 * 提供额外的动态效果和交互增强
 */

class EnhancedEffects {
    constructor() {
        this.particles = [];
        this.isAnimating = false;
        this.mousePosition = { x: 0, y: 0 };
        this.init();
    }

    init() {
        this.createParticleSystem();
        this.addMouseTracking();
        this.addHoverEffects();
        this.addClickEffects();
        this.createFloatingIcons();
        this.addPerformanceOptimization();
    }

    /**
     * 创建粒子系统
     */
    createParticleSystem() {
        const areas = ['pdf-area', 'player-area', 'buttons-area', 'upload-area'];
        
        areas.forEach((areaId, index) => {
            const area = document.getElementById(areaId);
            if (area) {
                this.createAreaParticles(area, index);
            }
        });
    }

    createAreaParticles(area, index) {
        const particleContainer = document.createElement('div');
        particleContainer.className = 'particle-container';
        particleContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1;
            overflow: hidden;
        `;

        // 为每个区域创建不同类型的粒子
        const particleConfigs = [
            { color: '#667eea', symbol: '♪', size: '12px' }, // PDF区域 - 音符
            { color: '#a8edea', symbol: '♫', size: '14px' }, // MIDI区域 - 双音符
            { color: '#ff8177', symbol: '⚡', size: '16px' }, // 结果区域 - 闪电
            { color: '#f093fb', symbol: '✨', size: '18px' }  // 上传区域 - 星星
        ];

        const config = particleConfigs[index];
        
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                this.createFloatingParticle(particleContainer, config);
            }, i * 500);
        }

        area.appendChild(particleContainer);
    }

    createFloatingParticle(container, config) {
        const particle = document.createElement('div');
        
        // 为每个区域使用相应的音符主题
        const areaMusicNotes = {
            0: ['♪', '♫', '🎼', '📄'], // PDF区域 - 文档+音符
            1: ['♫', '♬', '🎵', '🎶', '♪'], // MIDI区域 - 音乐音符
            2: ['⚡', '✨', '⭐', '💫', '♪'], // 结果区域 - 成功+音符
            3: ['✨', '🎼', '📁', '♪', '♫'] // 上传区域 - 文件+音符
        };
        
        const areaIndex = container.parentElement.id === 'pdf-area' ? 0 :
                         container.parentElement.id === 'player-area' ? 1 :
                         container.parentElement.id === 'buttons-area' ? 2 : 3;
        
        const noteOptions = areaMusicNotes[areaIndex] || ['♪', '♫'];
        const symbol = noteOptions[Math.floor(Math.random() * noteOptions.length)];
        
        particle.innerHTML = symbol;
        particle.className = 'musical-particle';
        
        // 根据区域调整颜色
        const baseHue = areaIndex * 90; // 0, 90, 180, 270度
        const hue = baseHue + (Math.random() - 0.5) * 60; // ±30度变化
        
        particle.style.cssText = `
            position: absolute;
            color: hsl(${hue}, 70%, 65%);
            font-size: ${config.size};
            opacity: 0.8;
            pointer-events: none;
            user-select: none;
            animation: floatUp 6s linear infinite;
            left: ${Math.random() * 100}%;
            animation-delay: ${Math.random() * 6}s;
            text-shadow: 0 0 8px hsl(${hue}, 70%, 80%);
            filter: drop-shadow(0 0 3px hsl(${hue}, 70%, 60%));
            font-weight: bold;
        `;

        container.appendChild(particle);

        // 粒子动画完成后移除
        setTimeout(() => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
            }
        }, 6000);
        
        // 继续生成新的粒子（循环效果）
        setTimeout(() => {
            if (container.parentNode) {
                this.createFloatingParticle(container, config);
            }
        }, 3000 + Math.random() * 3000); // 3-6秒后生成新粒子
    }

    /**
     * 添加鼠标跟踪效果
     */
    addMouseTracking() {
        let mouseTrailIndex = 0;
        
        document.addEventListener('mousemove', (e) => {
            this.mousePosition.x = e.clientX;
            this.mousePosition.y = e.clientY;
            
            // 创建鼠标跟随的音符效果
            this.createMouseMusicTrail(e.clientX, e.clientY, mouseTrailIndex);
            mouseTrailIndex++;
        });
    }

    createMouseMusicTrail(x, y, index) {
        // 更丰富的音符符号数组
        const musicNotes = ['♪', '♫', '♬', '♩', '♭', '♯', '𝄞', '𝄢', '♮', '𝄽', '𝄐', '𝄑'];
        const specialNotes = ['🎵', '🎶', '🎼', '🎹', '🎧'];
        
        // 创建3-5个音符跟随鼠标
        const noteCount = 3 + Math.floor(Math.random() * 3);
        
        // 偶尔创建特殊的音符效果
        const shouldCreateSpecial = Math.random() < 0.15; // 15%概率
        
        for (let i = 0; i < noteCount; i++) {
            setTimeout(() => {
                const note = document.createElement('div');
                
                // 选择音符类型
                let randomNote, noteClass = '';
                if (shouldCreateSpecial && i === 0) {
                    randomNote = specialNotes[Math.floor(Math.random() * specialNotes.length)];
                    noteClass = 'special-note';
                } else {
                    randomNote = musicNotes[Math.floor(Math.random() * musicNotes.length)];
                    
                    // 为不同音符添加特殊类
                    if (randomNote === '𝄞') noteClass = 'note-treble-clef';
                    else if (randomNote === '𝄢') noteClass = 'note-bass-clef';
                    else if (randomNote === '♭' || randomNote === '♯') noteClass = 'note-sharp-flat';
                    else noteClass = 'musical-particle';
                }
                
                note.innerHTML = randomNote;
                note.className = noteClass;
                
                // 为每个音符设置不同的偏移和属性
                const angle = (i / noteCount) * Math.PI * 2; // 圆形分布
                const radius = 15 + Math.random() * 25; // 15-40px半径
                const offsetX = Math.cos(angle) * radius;
                const offsetY = Math.sin(angle) * radius;
                
                // 动态色相变化
                const hue = (index * 15 + i * 45) % 360;
                const saturation = 60 + Math.random() * 30; // 60-90%
                const lightness = 50 + Math.random() * 30; // 50-80%
                
                const size = shouldCreateSpecial && i === 0 ? 18 + Math.random() * 6 : 12 + Math.random() * 8;
                const rotation = Math.random() * 360;
                
                note.style.cssText = `
                    position: fixed;
                    left: ${x + offsetX}px;
                    top: ${y + offsetY}px;
                    font-size: ${size}px;
                    color: hsl(${hue}, ${saturation}%, ${lightness}%);
                    text-shadow: 
                        0 0 8px hsl(${hue}, ${saturation}%, ${Math.min(lightness + 20, 100)}%),
                        0 0 16px hsl(${hue}, ${saturation}%, ${Math.min(lightness + 10, 100)}%);
                    pointer-events: none;
                    z-index: 9999;
                    animation: musicNoteTrail 1.5s ease-out forwards;
                    transform: translate(-50%, -50%) rotate(${rotation}deg);
                    user-select: none;
                    font-weight: bold;
                    filter: drop-shadow(0 0 4px hsl(${hue}, ${saturation}%, ${lightness}%));
                `;

                // 为特殊音符添加额外效果
                if (shouldCreateSpecial && i === 0) {
                    note.style.animation = 'musicTrailEnhanced 2s ease-out forwards';
                    note.style.fontSize = (size * 1.3) + 'px';
                }

                document.body.appendChild(note);

                // 音符移除
                setTimeout(() => {
                    if (note.parentNode) {
                        note.parentNode.removeChild(note);
                    }
                }, shouldCreateSpecial && i === 0 ? 2000 : 1500);
            }, i * 30); // 更快的错开时间
        }

        // 偶尔创建音符连线效果
        if (Math.random() < 0.08) { // 8%概率
            this.createMusicStaff(x, y);
        }
    }

    /**
     * 创建五线谱连线效果
     */
    createMusicStaff(x, y) {
        const staff = document.createElement('div');
        staff.style.cssText = `
            position: fixed;
            left: ${x - 30}px;
            top: ${y - 2}px;
            width: 60px;
            height: 1px;
            background: linear-gradient(90deg, transparent 0%, rgba(102, 126, 234, 0.6) 50%, transparent 100%);
            pointer-events: none;
            z-index: 9998;
            animation: staffFade 1s ease-out forwards;
            transform: translateY(-50%);
        `;

        document.body.appendChild(staff);

        // 创建多条线
        for (let i = 1; i < 5; i++) {
            setTimeout(() => {
                const line = staff.cloneNode(true);
                line.style.top = (y - 2 + i * 6) + 'px';
                line.style.animationDelay = (i * 0.1) + 's';
                document.body.appendChild(line);
                
                setTimeout(() => {
                    if (line.parentNode) {
                        line.parentNode.removeChild(line);
                    }
                }, 1000 + i * 100);
            }, i * 50);
        }

        setTimeout(() => {
            if (staff.parentNode) {
                staff.parentNode.removeChild(staff);
            }
        }, 1000);
    }

    /**
     * 添加悬停效果增强
     */
    addHoverEffects() {
        const areas = document.querySelectorAll('.grid-item.enhanced-bg');
        
        areas.forEach(area => {
            area.addEventListener('mouseenter', () => {
                this.createHoverBurst(area);
                this.addHoverGlow(area);
            });

            area.addEventListener('mouseleave', () => {
                this.removeHoverGlow(area);
            });
        });
    }

    createHoverBurst(element) {
        const burst = document.createElement('div');
        burst.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 100px;
            height: 100px;
            background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
            border-radius: 50%;
            transform: translate(-50%, -50%) scale(0);
            pointer-events: none;
            z-index: 2;
            animation: burstEffect 0.6s ease-out forwards;
        `;

        element.appendChild(burst);

        setTimeout(() => {
            if (burst.parentNode) {
                burst.parentNode.removeChild(burst);
            }
        }, 600);
    }

    addHoverGlow(element) {
        element.style.filter = 'brightness(1.1) saturate(1.2)';
        element.style.transform = 'translateY(-8px) scale(1.02)';
    }

    removeHoverGlow(element) {
        element.style.filter = '';
        element.style.transform = '';
    }

    /**
     * 添加点击效果
     */
    addClickEffects() {
        const buttons = document.querySelectorAll('.btn');
        
        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.createClickRipple(e);
                this.createSuccessSparkle(button);
            });
        });
    }

    createClickRipple(e) {
        const ripple = document.createElement('div');
        const rect = e.target.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        
        ripple.style.cssText = `
            position: absolute;
            left: ${e.clientX - rect.left - size/2}px;
            top: ${e.clientY - rect.top - size/2}px;
            width: ${size}px;
            height: ${size}px;
            background: radial-gradient(circle, rgba(255, 255, 255, 0.6) 0%, transparent 70%);
            border-radius: 50%;
            pointer-events: none;
            z-index: 10;
            animation: rippleEffect 0.6s ease-out forwards;
        `;

        e.target.style.position = 'relative';
        e.target.appendChild(ripple);

        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 600);
    }

    createSuccessSparkle(button) {
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const sparkle = document.createElement('div');
                sparkle.innerHTML = '✨';
                sparkle.style.cssText = `
                    position: absolute;
                    color: #f093fb;
                    font-size: 14px;
                    pointer-events: none;
                    z-index: 11;
                    animation: sparkleOut 1s ease-out forwards;
                    left: ${Math.random() * 100}%;
                    top: ${Math.random() * 100}%;
                `;

                button.style.position = 'relative';
                button.appendChild(sparkle);

                setTimeout(() => {
                    if (sparkle.parentNode) {
                        sparkle.parentNode.removeChild(sparkle);
                    }
                }, 1000);
            }, i * 100);
        }
    }

    /**
     * 创建浮动图标
     */
    createFloatingIcons() {
        const container = document.createElement('div');
        container.className = 'floating-icons-container';
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: -1;
        `;

        const icons = ['🎵', '♪', '♫', '🎶', '🎼', '🎹', '🎧', '✨'];
        
        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                this.createFloatingIcon(container, icons[Math.floor(Math.random() * icons.length)]);
            }, i * 2000);
        }

        document.body.appendChild(container);
    }

    createFloatingIcon(container, icon) {
        const floatingIcon = document.createElement('div');
        floatingIcon.innerHTML = icon;
        floatingIcon.style.cssText = `
            position: absolute;
            font-size: ${20 + Math.random() * 20}px;
            color: rgba(240, 147, 251, 0.3);
            left: ${Math.random() * 100}vw;
            top: 100vh;
            animation: floatUpSlow ${15 + Math.random() * 10}s linear infinite;
            animation-delay: ${Math.random() * 5}s;
        `;

        container.appendChild(floatingIcon);

        setTimeout(() => {
            if (floatingIcon.parentNode) {
                floatingIcon.parentNode.removeChild(floatingIcon);
            }
        }, 25000);
    }

    /**
     * 性能优化
     */
    addPerformanceOptimization() {
        // 使用 requestAnimationFrame 优化动画性能
        let ticking = false;
        
        const optimize = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    // 在这里执行需要优化的动画
                    ticking = false;
                });
                ticking = true;
            }
        };

        // 节流鼠标事件
        let mouseTimeout;
        document.addEventListener('mousemove', () => {
            clearTimeout(mouseTimeout);
            mouseTimeout = setTimeout(optimize, 16); // 60fps
        });

        // 页面可见性API优化
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseAnimations();
            } else {
                this.resumeAnimations();
            }
        });
    }

    pauseAnimations() {
        const animatedElements = document.querySelectorAll('.enhanced-bg');
        animatedElements.forEach(el => {
            el.style.animationPlayState = 'paused';
        });
    }

    resumeAnimations() {
        const animatedElements = document.querySelectorAll('.enhanced-bg');
        animatedElements.forEach(el => {
            el.style.animationPlayState = 'running';
        });
    }

    /**
     * 添加季节性主题切换
     */
    addSeasonalThemes() {
        const now = new Date();
        const month = now.getMonth() + 1;
        
        let seasonalClass = '';
        if (month >= 3 && month <= 5) {
            seasonalClass = 'spring-theme';
        } else if (month >= 6 && month <= 8) {
            seasonalClass = 'summer-theme';
        } else if (month >= 9 && month <= 11) {
            seasonalClass = 'autumn-theme';
        } else {
            seasonalClass = 'winter-theme';
        }
        
        document.body.classList.add(seasonalClass);
    }

    /**
     * 添加音频可视化效果（如果有音频播放）
     */
    addAudioVisualization() {
        // 监听音频播放状态
        const audioElements = document.querySelectorAll('audio, #midi-player');
        
        audioElements.forEach(audio => {
            if (audio.addEventListener) {
                audio.addEventListener('play', () => {
                    this.startAudioVisualization();
                });
                
                audio.addEventListener('pause', () => {
                    this.stopAudioVisualization();
                });
            }
        });
    }

    startAudioVisualization() {
        const areas = document.querySelectorAll('.enhanced-bg');
        areas.forEach(area => {
            area.classList.add('audio-active');
        });
    }

    stopAudioVisualization() {
        const areas = document.querySelectorAll('.enhanced-bg');
        areas.forEach(area => {
            area.classList.remove('audio-active');
        });
    }
}

// CSS动画样式（通过JavaScript注入）
const enhancedAnimations = `
    @keyframes floatUp {
        0% { transform: translateY(0) rotate(0deg); opacity: 0.7; }
        50% { opacity: 1; }
        100% { transform: translateY(-100px) rotate(360deg); opacity: 0; }
    }

    @keyframes floatUpSlow {
        0% { transform: translateY(0) rotate(0deg); opacity: 0; }
        10% { opacity: 0.3; }
        90% { opacity: 0.3; }
        100% { transform: translateY(-100vh) rotate(360deg); opacity: 0; }
    }

    @keyframes musicNoteTrail {
        0% { 
            opacity: 0.9; 
            transform: translate(-50%, -50%) scale(0.8) rotate(0deg);
            filter: blur(0px);
        }
        25% { 
            opacity: 1; 
            transform: translate(-50%, -50%) scale(1.2) rotate(90deg);
            filter: blur(0px);
        }
        75% { 
            opacity: 0.6; 
            transform: translate(-50%, -50%) scale(1) rotate(270deg);
            filter: blur(1px);
        }
        100% { 
            opacity: 0; 
            transform: translate(-50%, -50%) scale(0.3) rotate(360deg);
            filter: blur(2px);
        }
    }

    @keyframes trailFade {
        0% { opacity: 0.8; transform: scale(1); }
        100% { opacity: 0; transform: scale(0.2); }
    }

    @keyframes burstEffect {
        0% { transform: translate(-50%, -50%) scale(0); opacity: 0.8; }
        100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
    }

    @keyframes rippleEffect {
        0% { transform: scale(0); opacity: 0.6; }
        100% { transform: scale(1); opacity: 0; }
    }

    @keyframes sparkleOut {
        0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
        50% { transform: translateY(-15px) scale(1.2) rotate(180deg); opacity: 0.8; }
        100% { transform: translateY(-30px) scale(0.5) rotate(360deg); opacity: 0; }
    }

    /* 音符特殊动画 */
    @keyframes noteFloat {
        0% { transform: translateY(0) rotate(0deg) scale(1); }
        33% { transform: translateY(-10px) rotate(120deg) scale(1.1); }
        66% { transform: translateY(-5px) rotate(240deg) scale(0.9); }
        100% { transform: translateY(-20px) rotate(360deg) scale(1); }
    }

    @keyframes noteBounce {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-15px) scale(1.2); }
    }

    @keyframes noteWave {
        0% { transform: translateX(0) rotate(0deg); }
        25% { transform: translateX(5px) rotate(10deg); }
        50% { transform: translateX(0) rotate(0deg); }
        75% { transform: translateX(-5px) rotate(-10deg); }
        100% { transform: translateX(0) rotate(0deg); }
    }

    /* 增强的音符粒子系统 */
    .musical-particle {
        animation: noteFloat 3s ease-in-out infinite;
    }

    .musical-particle:nth-child(2n) {
        animation: noteBounce 2s ease-in-out infinite;
        animation-delay: 0.5s;
    }

    .musical-particle:nth-child(3n) {
        animation: noteWave 1.5s ease-in-out infinite;
        animation-delay: 1s;
    }

    .audio-active {
        animation-duration: 0.5s !important;
        filter: hue-rotate(90deg) saturate(1.5) !important;
    }

    .spring-theme .enhanced-bg { filter: hue-rotate(60deg); }
    .summer-theme .enhanced-bg { filter: hue-rotate(120deg); }
    .autumn-theme .enhanced-bg { filter: hue-rotate(30deg); }
    .winter-theme .enhanced-bg { filter: hue-rotate(240deg); }

    /* 鼠标音符轨迹增强 */
    @keyframes musicTrailEnhanced {
        0% { 
            opacity: 1; 
            transform: translate(-50%, -50%) scale(1) rotate(0deg);
            text-shadow: 0 0 20px currentColor;
        }
        30% { 
            opacity: 0.9; 
            transform: translate(-50%, -50%) scale(1.3) rotate(120deg);
            text-shadow: 0 0 25px currentColor;
        }
        70% { 
            opacity: 0.5; 
            transform: translate(-50%, -50%) scale(0.8) rotate(240deg);
            text-shadow: 0 0 15px currentColor;
        }
        100% { 
            opacity: 0; 
            transform: translate(-50%, -50%) scale(0.2) rotate(360deg);
            text-shadow: 0 0 5px currentColor;
        }
    }

    /* 特殊音符效果 */
    .note-treble-clef {
        font-family: 'Times New Roman', serif;
        font-weight: bold;
        animation: noteFloat 2s ease-in-out infinite;
    }

    .note-bass-clef {
        font-family: 'Times New Roman', serif;
        font-weight: bold;
        animation: noteBounce 1.8s ease-in-out infinite;
    }

    .note-sharp-flat {
        animation: noteWave 1.2s ease-in-out infinite;
        font-size: 0.9em;
    }

    /* 五线谱效果 */
    @keyframes staffFade {
        0% { 
            opacity: 0; 
            transform: translateY(-50%) scaleX(0);
        }
        50% { 
            opacity: 0.8; 
            transform: translateY(-50%) scaleX(1);
        }
        100% { 
            opacity: 0; 
            transform: translateY(-50%) scaleX(1);
        }
    }

    /* 特殊音符样式 */
    .special-note {
        font-size: 1.2em !important;
        animation: specialNoteGlow 2s ease-out forwards;
        filter: drop-shadow(0 0 8px currentColor) !important;
    }

    @keyframes specialNoteGlow {
        0% { 
            transform: translate(-50%, -50%) scale(0.5) rotate(0deg);
            opacity: 1;
            filter: drop-shadow(0 0 15px currentColor) brightness(1.5);
        }
        25% { 
            transform: translate(-50%, -50%) scale(1.4) rotate(90deg);
            opacity: 1;
            filter: drop-shadow(0 0 20px currentColor) brightness(1.8);
        }
        75% { 
            transform: translate(-50%, -50%) scale(1.1) rotate(270deg);
            opacity: 0.7;
            filter: drop-shadow(0 0 12px currentColor) brightness(1.2);
        }
        100% { 
            transform: translate(-50%, -50%) scale(0.3) rotate(360deg);
            opacity: 0;
            filter: drop-shadow(0 0 5px currentColor) brightness(1);
        }
    }

    /* 音符连接线效果 */
    .note-connection {
        position: fixed;
        height: 2px;
        background: linear-gradient(90deg, transparent, rgba(102, 126, 234, 0.5), transparent);
        pointer-events: none;
        z-index: 9997;
        animation: connectionLine 0.8s ease-out forwards;
    }

    @keyframes connectionLine {
        0% { 
            opacity: 0; 
            transform: scaleX(0);
        }
        50% { 
            opacity: 1; 
            transform: scaleX(1);
        }
        100% { 
            opacity: 0; 
            transform: scaleX(1);
        }
    }
`;

// 注入CSS样式
const styleElement = document.createElement('style');
styleElement.textContent = enhancedAnimations;
document.head.appendChild(styleElement);

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.enhancedEffects = new EnhancedEffects();
});

export default EnhancedEffects; 