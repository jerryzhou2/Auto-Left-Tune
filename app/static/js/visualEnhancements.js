/**
 * 视觉增强脚本 - 为界面添加更多炫酷效果
 */

class VisualEnhancements {
    constructor() {
        this.init();
    }

    init() {
        this.addSpecialButtonEffects();
        this.addAreaSpecificEffects();
        this.addScrollAnimations();
        this.addThemeToggle();
        this.addSoundFeedback();
        this.addLoadingAnimations();
    }

    /**
     * 为特定按钮添加特殊效果
     */
    addSpecialButtonEffects() {
        // 为主要功能按钮添加特殊类
        const uploadBtn = document.getElementById('upload-btn');
        if (uploadBtn) {
            uploadBtn.classList.add('btn-glow', 'btn-3d');
            
            uploadBtn.addEventListener('click', () => {
                uploadBtn.classList.add('btn-loading');
                this.createSuccessAnimation(uploadBtn);
            });
        }

        // 为播放按钮添加脉冲效果
        const playBtn = document.getElementById('play-pause-midi-btn');
        if (playBtn) {
            playBtn.classList.add('btn-pulse');
        }

        // 为下载按钮添加渐变边框
        document.querySelectorAll('[id*="download"]').forEach(btn => {
            btn.classList.add('btn-gradient-border');
        });
    }

    createSuccessAnimation(button) {
        setTimeout(() => {
            button.classList.remove('btn-loading');
            button.classList.add('btn-success-animation');
            
            // 创建成功粒子效果
            this.createSuccessParticles(button);
            
            setTimeout(() => {
                button.classList.remove('btn-success-animation');
            }, 600);
        }, 2000);
    }

    createSuccessParticles(element) {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        for (let i = 0; i < 10; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                particle.innerHTML = ['🎉', '✨', '⭐', '💫'][Math.floor(Math.random() * 4)];
                particle.style.cssText = `
                    position: fixed;
                    left: ${centerX}px;
                    top: ${centerY}px;
                    font-size: 20px;
                    pointer-events: none;
                    z-index: 10000;
                    animation: explodeParticle 1.5s ease-out forwards;
                    transform: translate(-50%, -50%);
                `;

                document.body.appendChild(particle);

                // 随机方向
                const angle = (Math.PI * 2 * i) / 10;
                const distance = 50 + Math.random() * 50;
                const deltaX = Math.cos(angle) * distance;
                const deltaY = Math.sin(angle) * distance;

                particle.style.setProperty('--deltaX', deltaX + 'px');
                particle.style.setProperty('--deltaY', deltaY + 'px');

                setTimeout(() => {
                    if (particle.parentNode) {
                        particle.parentNode.removeChild(particle);
                    }
                }, 1500);
            }, i * 50);
        }

        // 添加CSS动画
        if (!document.getElementById('particle-styles')) {
            const style = document.createElement('style');
            style.id = 'particle-styles';
            style.textContent = `
                @keyframes explodeParticle {
                    0% { 
                        transform: translate(-50%, -50%) scale(0) rotate(0deg);
                        opacity: 1;
                    }
                    50% { 
                        transform: translate(calc(-50% + var(--deltaX)), calc(-50% + var(--deltaY))) scale(1.2) rotate(180deg);
                        opacity: 1;
                    }
                    100% { 
                        transform: translate(calc(-50% + var(--deltaX)), calc(-50% + var(--deltaY))) scale(0) rotate(360deg);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * 为各个区域添加特定效果
     */
    addAreaSpecificEffects() {
        // PDF区域特效
        const pdfArea = document.getElementById('pdf-area');
        if (pdfArea) {
            this.addDocumentFlowEffect(pdfArea);
        }

        // MIDI播放器区域特效
        const playerArea = document.getElementById('player-area');
        if (playerArea) {
            this.addMusicVisualizationEffect(playerArea);
        }

        // 处理结果区域特效
        const resultArea = document.getElementById('buttons-area');
        if (resultArea) {
            this.addResultsSparkleEffect(resultArea);
        }

        // 上传区域特效
        const uploadArea = document.getElementById('upload-area');
        if (uploadArea) {
            this.addUploadPulseEffect(uploadArea);
        }
    }

    addDocumentFlowEffect(area) {
        const effect = document.createElement('div');
        effect.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50" font-size="20" fill="rgba(102,126,234,0.1)">📄</text></svg>') repeat;
            background-size: 50px 50px;
            animation: documentFlow 20s linear infinite;
            pointer-events: none;
            z-index: 1;
        `;

        area.appendChild(effect);

        // 添加CSS动画
        this.addStyleAnimation('documentFlow', `
            @keyframes documentFlow {
                0% { background-position: 0 0; }
                100% { background-position: 50px 50px; }
            }
        `);
    }

    addMusicVisualizationEffect(area) {
        const visualizer = document.createElement('div');
        visualizer.style.cssText = `
            position: absolute;
            bottom: 10px;
            left: 10px;
            right: 10px;
            height: 40px;
            background: linear-gradient(90deg, transparent 0%, rgba(168,237,234,0.3) 25%, rgba(168,237,234,0.5) 50%, rgba(168,237,234,0.3) 75%, transparent 100%);
            border-radius: 20px;
            animation: musicWave 2s ease-in-out infinite;
            pointer-events: none;
            z-index: 1;
        `;

        area.appendChild(visualizer);

        this.addStyleAnimation('musicWave', `
            @keyframes musicWave {
                0%, 100% { transform: scaleY(0.5); opacity: 0.5; }
                50% { transform: scaleY(1); opacity: 0.8; }
            }
        `);
    }

    addResultsSparkleEffect(area) {
        setInterval(() => {
            const sparkle = document.createElement('div');
            sparkle.innerHTML = '✨';
            sparkle.style.cssText = `
                position: absolute;
                top: ${Math.random() * 100}%;
                left: ${Math.random() * 100}%;
                font-size: 16px;
                color: rgba(255,129,119,0.7);
                pointer-events: none;
                z-index: 1;
                animation: sparkleFloat 3s ease-out forwards;
            `;

            area.appendChild(sparkle);

            setTimeout(() => {
                if (sparkle.parentNode) {
                    sparkle.parentNode.removeChild(sparkle);
                }
            }, 3000);
        }, 2000);

        this.addStyleAnimation('sparkleFloat', `
            @keyframes sparkleFloat {
                0% { transform: translateY(0) scale(0); opacity: 0; }
                10% { transform: translateY(-10px) scale(1); opacity: 1; }
                90% { transform: translateY(-50px) scale(1); opacity: 1; }
                100% { transform: translateY(-60px) scale(0); opacity: 0; }
            }
        `);
    }

    addUploadPulseEffect(area) {
        const dropArea = area.querySelector('.upload-area');
        if (dropArea) {
            // 添加拖拽视觉反馈
            ['dragenter', 'dragover'].forEach(eventName => {
                dropArea.addEventListener(eventName, () => {
                    dropArea.style.animation = 'uploadPulse 0.5s ease-in-out infinite';
                    dropArea.style.borderColor = '#f093fb';
                    dropArea.style.background = 'linear-gradient(135deg, rgba(240,147,251,0.1) 0%, rgba(74,172,254,0.1) 100%)';
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropArea.addEventListener(eventName, () => {
                    dropArea.style.animation = '';
                    dropArea.style.borderColor = '';
                    dropArea.style.background = '';
                });
            });
        }
    }

    /**
     * 添加滚动动画
     */
    addScrollAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.animation = 'slideInFromBottom 0.6s ease-out';
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.grid-item').forEach(item => {
            observer.observe(item);
        });

        this.addStyleAnimation('slideInFromBottom', `
            @keyframes slideInFromBottom {
                0% { transform: translateY(50px); opacity: 0; }
                100% { transform: translateY(0); opacity: 1; }
            }
        `);
    }

    /**
     * 添加主题切换功能
     */
    addThemeToggle() {
        const themeBtn = document.createElement('button');
        themeBtn.innerHTML = '🌙';
        themeBtn.className = 'theme-toggle btn btn-sm';
        themeBtn.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            border: none;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-size: 20px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
            transition: all 0.3s ease;
        `;

        themeBtn.addEventListener('click', this.toggleTheme.bind(this));
        document.body.appendChild(themeBtn);
    }

    toggleTheme() {
        const body = document.body;
        const isDark = body.classList.contains('dark-theme');

        if (isDark) {
            body.classList.remove('dark-theme');
            document.querySelector('.theme-toggle').innerHTML = '🌙';
        } else {
            body.classList.add('dark-theme');
            document.querySelector('.theme-toggle').innerHTML = '☀️';
        }

        // 添加暗色主题样式
        if (!document.getElementById('dark-theme-styles')) {
            const style = document.createElement('style');
            style.id = 'dark-theme-styles';
            style.textContent = `
                .dark-theme {
                    filter: hue-rotate(180deg) invert(1);
                }
                .dark-theme img, .dark-theme video, .dark-theme iframe {
                    filter: invert(1) hue-rotate(180deg);
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * 添加声音反馈（如果允许）
     */
    addSoundFeedback() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        const playTone = (frequency, duration = 200) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration / 1000);
        };

        // 为按钮添加声音反馈
        document.addEventListener('click', (e) => {
            if (e.target.matches('.btn')) {
                const frequency = e.target.classList.contains('btn-success') ? 440 : 
                                e.target.classList.contains('btn-warning') ? 392 : 
                                e.target.classList.contains('btn-danger') ? 330 : 523;
                playTone(frequency, 150);
            }
        });
    }

    /**
     * 添加加载动画
     */
    addLoadingAnimations() {
        const createLoadingOverlay = () => {
            const overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, rgba(102,126,234,0.9) 0%, rgba(118,75,162,0.9) 100%);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                animation: fadeIn 0.3s ease-out;
            `;

            const spinner = document.createElement('div');
            spinner.style.cssText = `
                width: 80px;
                height: 80px;
                border: 4px solid rgba(255,255,255,0.3);
                border-top: 4px solid white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            `;

            overlay.appendChild(spinner);
            return overlay;
        };

        // 为文件上传添加加载动画
        const uploadBtn = document.getElementById('upload-btn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                const overlay = createLoadingOverlay();
                document.body.appendChild(overlay);

                // 模拟处理完成后移除
                setTimeout(() => {
                    overlay.style.animation = 'fadeOut 0.3s ease-out forwards';
                    setTimeout(() => {
                        if (overlay.parentNode) {
                            overlay.parentNode.removeChild(overlay);
                        }
                    }, 300);
                }, 3000);
            });
        }

        this.addStyleAnimation('fadeIn', `
            @keyframes fadeIn {
                0% { opacity: 0; }
                100% { opacity: 1; }
            }
        `);

        this.addStyleAnimation('fadeOut', `
            @keyframes fadeOut {
                0% { opacity: 1; }
                100% { opacity: 0; }
            }
        `);

        this.addStyleAnimation('spin', `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `);
    }

    /**
     * 帮助方法：添加CSS动画样式
     */
    addStyleAnimation(name, keyframes) {
        if (!document.getElementById(`animation-${name}`)) {
            const style = document.createElement('style');
            style.id = `animation-${name}`;
            style.textContent = keyframes;
            document.head.appendChild(style);
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.visualEnhancements = new VisualEnhancements();
});

export default VisualEnhancements; 