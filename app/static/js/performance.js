/**
 * 演奏区专用JavaScript
 * 处理歌曲列表和界面切换功能
 */

// 歌曲数据缓存
let songsData = null;

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
    
    // 应用歌曲难度等级样式
    applySongLevelStyles();
    
    console.log('演奏区功能已初始化');
}

// 导出函数（如果使用模块化）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initPerformanceArea,
        initSongListFeature,
        loadSongsData,
        loadSongContent
    };
} 