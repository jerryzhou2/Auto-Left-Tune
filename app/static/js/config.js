/**
 * 配置管理模块
 * 管理MIDI播放器的各种配置参数
 */

class MidiPlayerConfig {
    constructor() {
        // 默认配置
        this.defaultConfig = {
            leftHandVolumeRatio: 0.8, // 左手音量相对于右手的比例 (80%)
            debug: false,
            volume: 0.7
        };

        // 从localStorage加载配置或使用默认配置
        this.config = this.loadConfig();
    }

    // 从localStorage加载配置
    loadConfig() {
        try {
            const savedConfig = localStorage.getItem('midiPlayerConfig');
            if (savedConfig) {
                return { ...this.defaultConfig, ...JSON.parse(savedConfig) };
            }
        } catch (error) {
            console.warn('加载配置失败，使用默认配置:', error);
        }
        return { ...this.defaultConfig };
    }

    // 保存配置到localStorage
    saveConfig() {
        try {
            localStorage.setItem('midiPlayerConfig', JSON.stringify(this.config));
            console.log('配置已保存到localStorage');
        } catch (error) {
            console.error('保存配置失败:', error);
        }
    }

    // 获取左手音量比例
    getLeftHandVolumeRatio() {
        return this.config.leftHandVolumeRatio;
    }

    // 设置左手音量比例
    setLeftHandVolumeRatio(ratio) {
        const validRatio = Math.max(0, Math.min(1, ratio));
        this.config.leftHandVolumeRatio = validRatio;
        this.saveConfig();
        
        // 通知所有播放器更新配置
        this.notifyPlayersConfigChange();
        
        console.log(`左手音量比例已设置为: ${(validRatio * 100).toFixed(0)}%`);
        return validRatio;
    }

    // 获取完整配置
    getConfig() {
        return { ...this.config };
    }

    // 重置为默认配置
    resetToDefault() {
        this.config = { ...this.defaultConfig };
        this.saveConfig();
        this.notifyPlayersConfigChange();
        console.log('配置已重置为默认值');
    }

    // 通知播放器配置变化
    notifyPlayersConfigChange() {
        // 触发自定义事件，通知播放器配置已更新
        const event = new CustomEvent('midi-config-change', {
            detail: {
                config: this.getConfig()
            }
        });
        document.dispatchEvent(event);
    }

    // 获取百分比形式的左手音量比例（用于UI显示）
    getLeftHandVolumeRatioPercent() {
        return Math.round(this.config.leftHandVolumeRatio * 100);
    }

    // 从百分比设置左手音量比例
    setLeftHandVolumeRatioFromPercent(percent) {
        const ratio = Math.max(0, Math.min(100, percent)) / 100;
        return this.setLeftHandVolumeRatio(ratio);
    }
}

// 创建全局配置实例
window.midiPlayerConfig = new MidiPlayerConfig();

// 导出配置类（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MidiPlayerConfig;
} 