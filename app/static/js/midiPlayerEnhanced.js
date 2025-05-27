/**
 * 增强的MIDI播放器控制器
 * 提供进度条拖拽、音量控制面板和倍速控制功能
 */
class MidiPlayerEnhanced {
    constructor() {
        this.currentSpeed = 1;
        this.isDragging = false;
        this.isVolumeOpen = false;
        this.isSpeedOpen = false;
        this.pauseProgressUpdates = false; // 控制是否暂停进度更新
        
        this.initElements();
        this.bindEvents();
    }
    
    initElements() {
        // 进度条相关元素
        this.progressContainer = document.getElementById('midi-progress-container');
        this.progressBar = document.getElementById('midi-progress');
        this.progressThumb = document.getElementById('midi-progress-thumb');
        
        // 调试：检查进度条元素是否找到
        console.log('进度条元素检查:', {
            progressContainer: this.progressContainer,
            progressBar: this.progressBar,
            progressThumb: this.progressThumb
        });
        
        // 音量控制相关元素
        this.volumeBtn = document.getElementById('volume-btn');
        this.volumePanel = document.getElementById('volume-panel');
        this.volumeSlider = document.getElementById('volume-slider');
        this.volumeValue = document.getElementById('volume-value');
        
        // 倍速控制相关元素
        this.speedBtn = document.getElementById('speed-btn');
        this.speedPanel = document.getElementById('speed-panel');
        this.speedOptions = document.querySelectorAll('.speed-option');
        
        // 时间显示元素
        this.currentTimeDisplay = document.getElementById('current-time');
        this.totalTimeDisplay = document.getElementById('total-time');
    }
    
    bindEvents() {
        this.bindProgressEvents();
        this.bindVolumeEvents();
        this.bindSpeedEvents();
        this.bindDocumentEvents();
    }
    
    // 进度条事件绑定
    bindProgressEvents() {
        if (!this.progressContainer || !this.progressThumb) {
            console.warn('进度条元素未找到，跳过事件绑定:', {
                progressContainer: this.progressContainer,
                progressThumb: this.progressThumb
            });
            return;
        }
        
        console.log('绑定进度条事件...');
        
        // 鼠标悬停显示小圆点
        this.progressContainer.addEventListener('mouseenter', () => {
            console.log('鼠标进入进度条');
            this.updateThumbPosition();
        });
        
        // 鼠标移动时更新小圆点位置（悬停预览）
        this.progressContainer.addEventListener('mousemove', (e) => {
            if (!this.isDragging) {
                this.updateThumbPosition();
            }
        });
        
        // 鼠标离开时隐藏小圆点
        this.progressContainer.addEventListener('mouseleave', () => {
            if (!this.isDragging && !this.pauseProgressUpdates) {
                this.progressThumb.style.opacity = '0';
            }
        });
        
        // 点击进度条跳转
        this.progressContainer.addEventListener('click', (e) => {
            console.log('点击进度条');
            if (this.isDragging) return;
            
            // 如果点击的是小圆点本身，不处理
            if (e.target === this.progressThumb) return;
            
            this.handleProgressClick(e);
        });
        
        // 拖拽开始
        this.progressThumb.addEventListener('mousedown', (e) => {
            console.log('开始拖拽进度条');
            e.preventDefault();
            this.startDragging();
        });
        
        // 拖拽过程
        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.handleDragging(e);
            }
        });
        
        // 拖拽结束
        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.stopDragging();
            }
        });
        
        console.log('进度条事件绑定完成');
    }
    
    // 音量控制事件绑定
    bindVolumeEvents() {
        if (!this.volumeBtn || !this.volumePanel) return;
        
        // 音量按钮点击
        this.volumeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleVolumePanel();
        });
        
        // 音量滑块变化
        this.volumeSlider.addEventListener('input', (e) => {
            this.handleVolumeChange(e.target.value);
        });
        
        // 阻止面板点击事件冒泡
        this.volumePanel.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    // 倍速控制事件绑定
    bindSpeedEvents() {
        if (!this.speedBtn || !this.speedPanel) return;
        
        // 倍速按钮点击
        this.speedBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSpeedPanel();
        });
        
        // 倍速选项点击
        this.speedOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const speed = parseFloat(e.target.dataset.speed);
                this.setPlaybackSpeed(speed);
            });
        });
        
        // 阻止面板点击事件冒泡
        this.speedPanel.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    // 文档事件绑定
    bindDocumentEvents() {
        // 点击其他地方关闭面板
        document.addEventListener('click', () => {
            this.closeAllPanels();
        });
        
        // 监听MIDI播放器的进度更新
        document.addEventListener('midi-progress-update', (e) => {
            this.updateProgress(e.detail.currentTime, e.detail.totalTime);
        });
    }
    
    // 处理进度条点击
    handleProgressClick(e) {
        const rect = this.progressContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, clickX / rect.width));
        
        console.log(`点击进度条位置: ${(percentage * 100).toFixed(1)}%`);
        
        // 暂时阻止外部进度更新，避免被覆盖
        this.pauseProgressUpdates = true;
        
        // 立即强制更新视觉反馈
        this.forceUpdateProgressDisplay(percentage);
        
        // 发送跳转请求
        this.seekToPercentage(percentage);
        
        // 短暂延迟后恢复进度更新，给跳转操作时间完成
        setTimeout(() => {
            this.pauseProgressUpdates = false;
        }, 150);
    }
    
    // 强制更新进度显示（用于点击时的立即反馈）
    forceUpdateProgressDisplay(percentage) {
        const percentageValue = Math.max(0, Math.min(100, percentage * 100));
        
        console.log(`强制更新进度显示到: ${percentageValue.toFixed(1)}%`);
        
        // 强制更新进度条
        if (this.progressBar) {
            this.progressBar.style.width = `${percentageValue}%`;
            // 强制重绘
            this.progressBar.offsetHeight;
        }
        
        // 强制更新小圆点位置和显示
        if (this.progressThumb) {
            // 重要：小圆点的位置需要考虑transform: translate(-50%, -50%)的影响
            // 所以直接设置left为百分比值即可，CSS的transform会自动居中
            this.progressThumb.style.left = `${percentageValue}%`;
            this.progressThumb.style.opacity = '1';
            
            // 强制重绘，确保位置立即更新
            this.progressThumb.offsetHeight;
            
            // 临时移除transition，确保位置立即跳转
            const originalTransition = this.progressThumb.style.transition;
            this.progressThumb.style.transition = 'none';
            
            // 强制重新计算位置
            this.progressThumb.offsetLeft;
            
            // 恢复transition
            this.progressThumb.style.transition = originalTransition;
            
            // 添加一个临时的高亮效果，表示点击成功
            this.progressThumb.style.transform = 'translate(-50%, -50%) scale(1.2)';
            setTimeout(() => {
                this.progressThumb.style.transform = 'translate(-50%, -50%) scale(1)';
            }, 200);
        }
    }
    
    // 开始拖拽
    startDragging() {
        this.isDragging = true;
        this.progressThumb.classList.add('dragging');
        this.progressContainer.classList.add('dragging'); // 添加容器拖拽状态
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        
        // 暂停进度更新，避免拖拽时的冲突
        this.pauseProgressUpdates = true;
    }
    
    // 处理拖拽
    handleDragging(e) {
        const rect = this.progressContainer.getBoundingClientRect();
        const dragX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, dragX / rect.width));
        
        // 立即更新视觉显示
        this.updateProgressDisplay(percentage);
        
        // 实时发送跳转请求（可以考虑节流优化）
        this.seekToPercentage(percentage);
    }
    
    // 停止拖拽
    stopDragging() {
        this.isDragging = false;
        this.progressThumb.classList.remove('dragging');
        this.progressContainer.classList.remove('dragging'); // 移除容器拖拽状态
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        // 恢复进度更新
        this.pauseProgressUpdates = false;
        
        // 检查鼠标是否还在进度条上，决定是否隐藏小圆点
        const rect = this.progressContainer.getBoundingClientRect();
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        
        if (mouseX < rect.left || mouseX > rect.right || mouseY < rect.top || mouseY > rect.bottom) {
            this.progressThumb.style.opacity = '0';
        }
    }
    
    // 更新小圆点位置
    updateThumbPosition() {
        if (!this.progressBar || !this.progressThumb) return;
        
        const progressWidth = this.progressBar.style.width || '0%';
        const percentage = parseFloat(progressWidth) / 100;
        this.progressThumb.style.left = `${percentage * 100}%`;
        
        // 确保小圆点在悬停时显示
        this.progressThumb.style.opacity = '1';
        
        // 强制重绘确保位置更新
        this.progressThumb.offsetLeft;
    }
    
    // 更新进度显示
    updateProgressDisplay(percentage) {
        const percentageValue = Math.max(0, Math.min(100, percentage * 100));
        
        if (this.progressBar) {
            this.progressBar.style.width = `${percentageValue}%`;
            // 强制重绘确保进度条更新
            this.progressBar.offsetHeight;
        }
        if (this.progressThumb) {
            this.progressThumb.style.left = `${percentageValue}%`;
            
            // 强制重绘确保小圆点位置更新
            this.progressThumb.offsetLeft;
            
            // 小圆点显示逻辑：
            // 1. 拖拽时始终显示
            // 2. 点击操作时显示（pauseProgressUpdates为true）
            // 3. 鼠标悬停在进度条上时显示
            // 4. 自动播放时，如果鼠标在进度条上也显示
            if (this.isDragging || this.pauseProgressUpdates) {
                this.progressThumb.style.opacity = '1';
            } else {
                // 检查鼠标是否在进度条容器上
                const rect = this.progressContainer.getBoundingClientRect();
                const isMouseOver = this.progressContainer.matches(':hover');
                
                if (isMouseOver) {
                    this.progressThumb.style.opacity = '1';
                } else {
                    // 自动播放时不显示小圆点，除非鼠标悬停
                    this.progressThumb.style.opacity = '0';
                }
            }
        }
    }
    
    // 跳转到指定百分比位置
    seekToPercentage(percentage) {
        // 这里需要与实际的MIDI播放器集成
        // 发送自定义事件通知主播放器
        const event = new CustomEvent('midi-seek', {
            detail: { percentage }
        });
        document.dispatchEvent(event);
    }
    
    // 切换音量面板
    toggleVolumePanel() {
        this.isVolumeOpen = !this.isVolumeOpen;
        
        if (this.isVolumeOpen) {
            this.volumePanel.classList.remove('hidden');
            this.closeSpeedPanel();
        } else {
            this.volumePanel.classList.add('hidden');
        }
    }
    
    // 处理音量变化
    handleVolumeChange(value) {
        const volume = parseInt(value);
        this.volumeValue.textContent = `${volume}%`;
        
        // 更新音量按钮图标
        if (volume === 0) {
            this.volumeBtn.classList.add('muted');
            this.volumeBtn.textContent = '🔇';
        } else {
            this.volumeBtn.classList.remove('muted');
            if (volume < 30) {
                this.volumeBtn.textContent = '🔈';
            } else if (volume < 70) {
                this.volumeBtn.textContent = '🔉';
            } else {
                this.volumeBtn.textContent = '🔊';
            }
        }
        
        // 发送音量变化事件
        const event = new CustomEvent('midi-volume-change', {
            detail: { volume: volume / 100 }
        });
        document.dispatchEvent(event);
    }
    
    // 切换倍速面板
    toggleSpeedPanel() {
        this.isSpeedOpen = !this.isSpeedOpen;
        
        if (this.isSpeedOpen) {
            this.speedPanel.classList.remove('hidden');
            this.closeVolumePanel();
        } else {
            this.speedPanel.classList.add('hidden');
        }
    }
    
    // 设置播放倍速
    setPlaybackSpeed(speed) {
        this.currentSpeed = speed;
        this.speedBtn.textContent = `${speed}x`;
        
        // 更新活跃状态
        this.speedOptions.forEach(option => {
            option.classList.remove('active');
            if (parseFloat(option.dataset.speed) === speed) {
                option.classList.add('active');
            }
        });
        
        // 关闭面板
        this.closeSpeedPanel();
        
        // 发送倍速变化事件
        const event = new CustomEvent('midi-speed-change', {
            detail: { speed }
        });
        document.dispatchEvent(event);
    }
    
    // 关闭音量面板
    closeVolumePanel() {
        this.isVolumeOpen = false;
        if (this.volumePanel) {
            this.volumePanel.classList.add('hidden');
        }
    }
    
    // 关闭倍速面板
    closeSpeedPanel() {
        this.isSpeedOpen = false;
        if (this.speedPanel) {
            this.speedPanel.classList.add('hidden');
        }
    }
    
    // 关闭所有面板
    closeAllPanels() {
        this.closeVolumePanel();
        this.closeSpeedPanel();
    }
    
    // 更新播放进度（供外部调用）
    updateProgress(currentTime, totalTime) {
        // 拖拽时或暂停进度更新时不更新
        if (this.isDragging || this.pauseProgressUpdates) return;
        
        const percentage = totalTime > 0 ? currentTime / totalTime : 0;
        this.updateProgressDisplay(percentage);
        
        // 更新时间显示
        if (this.currentTimeDisplay) {
            this.currentTimeDisplay.textContent = this.formatTime(currentTime);
        }
        if (this.totalTimeDisplay) {
            this.totalTimeDisplay.textContent = this.formatTime(totalTime);
        }
    }
    
    // 格式化时间显示
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    // 获取当前音量
    getCurrentVolume() {
        return this.volumeSlider ? parseInt(this.volumeSlider.value) / 100 : 0.7;
    }
    
    // 获取当前倍速
    getCurrentSpeed() {
        return this.currentSpeed;
    }
    
    // 设置音量（供外部调用）
    setVolume(volume) {
        const volumePercent = Math.round(volume * 100);
        if (this.volumeSlider) {
            this.volumeSlider.value = volumePercent;
        }
        this.handleVolumeChange(volumePercent);
    }
    
    // 重置控制器状态
    reset() {
        this.updateProgressDisplay(0);
        if (this.currentTimeDisplay) {
            this.currentTimeDisplay.textContent = '00:00';
        }
        if (this.totalTimeDisplay) {
            this.totalTimeDisplay.textContent = '00:00';
        }
        this.closeAllPanels();
    }
}

// 导出类
export default MidiPlayerEnhanced; 