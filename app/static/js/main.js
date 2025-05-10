// 导入所需的模块
import SampleLibrary from './lib/SampleLibrary.js';
import MidiPlayer from './midiPlayer.js';
import pdfViewer from './pdfViewer.js';

// 使用localStorage保存会话ID以保持状态
document.addEventListener('DOMContentLoaded', function() {
    console.log('页面加载完成，检查库的可用性');
    
    // 检查Tone.js和Midi.js是否正确加载
    if (typeof Tone === 'undefined') {
        console.error('错误: Tone.js未正确加载');
    } else {
        console.log('Tone.js已成功加载', Tone.version);
    }
    
    if (typeof Midi === 'undefined') {
        console.error('错误: Midi.js未正确加载');
    } else {
        console.log('Midi.js已成功加载');
    }
    
    // 初始化拖放区域
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const selectBtn = document.getElementById('select-file-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const selectedFileText = document.getElementById('selected-file');
    const uploadProgress = document.getElementById('upload-progress');
    const uploadStatus = document.getElementById('upload-status');
    const resultContainer = document.getElementById('result-container');
    
    // MIDI播放器元素
    const playPauseMidiBtn = document.getElementById('play-pause-midi-btn');
    const stopMidiBtn = document.getElementById('stop-midi-btn');
    const midiProgress = document.getElementById('midi-progress');
    const currentTimeDisplay = document.getElementById('current-time');
    const midiStatus = document.getElementById('midi-status');
    const playConvertedMidiBtn = document.getElementById('play-converted-midi-btn');
    const playOriginalMidiBtn = document.getElementById('play-original-midi-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeValue = document.getElementById('volume-value');
    
    // 原始MIDI PDF相关元素
    const viewOriginalPdfBtn = document.getElementById('view-original-pdf-btn');
    const downloadOriginalPdfBtn = document.getElementById('download-original-pdf-btn');
    
    // 隐藏原始MIDI PDF按钮，直到导出成功
    if (viewOriginalPdfBtn) viewOriginalPdfBtn.style.display = 'none';
    if (downloadOriginalPdfBtn) downloadOriginalPdfBtn.style.display = 'none';
    
    // 确保结果区域默认不显示
    resultContainer.style.display = 'none';
    
    // 存储拖放的文件
    let droppedFile = null;
    
    // 音频上下文是否已经启动
    let audioContextStarted = false;
    
    // 跟踪当前活动的播放按钮
    let activePlayButton = null;
    
    // 检查必要的库是否已加载
    function checkLibrariesLoaded() {
        // 检查Tone.js
        const toneLoaded = typeof Tone !== 'undefined';
        
        // 检查@tonejs/midi
        const midiLoaded = typeof Midi !== 'undefined' || typeof window.Midi !== 'undefined';
        
        console.log('库加载状态 - Tone.js:', toneLoaded, '@tonejs/midi:', midiLoaded);
        
        if (!toneLoaded || !midiLoaded) {
            midiStatus.textContent = `错误: ${!toneLoaded ? 'Tone.js ' : ''}${!midiLoaded ? '@tonejs/midi ' : ''}未加载`;
            midiStatus.className = 'status status-error';
            return false;
        }
        
        return true;
    }
    
    // 初始化MIDI播放器
    const midiPlayer = new MidiPlayer({
        onNotePlay: function(note) {
            // 当播放音符时的回调
            updateMidiProgress();
        },
        onMusicEnd: function() {
            // 当音乐结束时的回调
            resetPlayerUI();
            midiStatus.textContent = '播放完成';
            midiStatus.className = 'status status-success';
        },
        debug: true // 启用调试信息
    });
    
    // 音量滑块事件处理
    if (volumeSlider) {
        volumeSlider.addEventListener('input', function() {
            const volume = parseInt(this.value) / 100;
            volumeValue.textContent = `${this.value}%`;
            midiPlayer.setVolume(volume);
        });
    }
    
    // 确保音频上下文已启动
    function ensureAudioContext() {
        if (!audioContextStarted) {
            if (typeof Tone !== 'undefined') {
                return Tone.start()
                    .then(() => {
                        console.log('音频上下文已成功启动');
                        audioContextStarted = true;
                        midiPlayer.initAudio();
                        return true;
                    })
                    .catch(err => {
                        console.error('启动音频上下文失败:', err);
                        midiStatus.textContent = '错误: 无法启动音频系统，请确保在支持的浏览器中使用';
                        midiStatus.className = 'status status-error';
                        return false;
                    });
            } else {
                console.error('Tone.js 未加载');
                midiStatus.textContent = '错误: Tone.js未加载';
                midiStatus.className = 'status status-error';
                return Promise.resolve(false);
            }
        } else {
            return Promise.resolve(true);
        }
    }
    
    // 更新MIDI进度条
    function updateMidiProgress() {
        if (midiPlayer.currentMidiData && !midiPlayer.midiStop) {
            const now = +new Date();
            const playedTime = now - midiPlayer.startTime; // 毫秒
            
            // 计算总时长（取最后一个音符的时间+持续时间）
            let totalDuration = 0;
            if (midiPlayer.midiNotes.length > 0) {
                const lastNote = midiPlayer.midiNotes.reduce((prev, current) => {
                    return (prev.time + prev.duration > current.time + current.duration) ? prev : current;
                });
                totalDuration = (lastNote.time + lastNote.duration) * 1000; // 转换为毫秒
            }
            
            // 更新进度条
            if (totalDuration > 0) {
                const percentage = Math.min((playedTime / totalDuration) * 100, 100);
                midiProgress.style.width = `${percentage}%`;
                
                // 更新显示的时间
                const minutes = Math.floor(playedTime / 60000);
                const seconds = Math.floor((playedTime % 60000) / 1000);
                currentTimeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }
    }
    
    // 重置播放器UI
    function resetPlayerUI() {
        midiProgress.style.width = '0%';
        currentTimeDisplay.textContent = '00:00';
        
        // 重置按钮状态
        if (playPauseMidiBtn) {
            playPauseMidiBtn.disabled = droppedFile ? false : true;
            playPauseMidiBtn.dataset.state = 'play';
            playPauseMidiBtn.innerHTML = '<span class="btn-icon play-icon"></span><span class="btn-icon pause-icon"></span> 播放';
        }
        
        if (playConvertedMidiBtn) {
            playConvertedMidiBtn.disabled = localStorage.getItem('midi_session_id') ? false : true;
        }
        
        if (playOriginalMidiBtn) {
            playOriginalMidiBtn.disabled = localStorage.getItem('midi_session_id') ? false : true;
        }
        
        if (stopMidiBtn) {
            stopMidiBtn.disabled = true;
        }
    }
    
    // 更新播放器UI为播放状态
    function updateUIForPlayback(isPlaying) {
        if (playPauseMidiBtn) {
            if (isPlaying) {
                playPauseMidiBtn.dataset.state = 'pause';
                playPauseMidiBtn.innerHTML = '<span class="btn-icon play-icon"></span><span class="btn-icon pause-icon"></span> 暂停';
            } else {
                playPauseMidiBtn.dataset.state = 'play';
                playPauseMidiBtn.innerHTML = '<span class="btn-icon play-icon"></span><span class="btn-icon pause-icon"></span> 播放';
            }
            
            playPauseMidiBtn.disabled = false;
        }
        
        if (playConvertedMidiBtn) {
            playConvertedMidiBtn.disabled = true;
        }
        
        if (playOriginalMidiBtn) {
            playOriginalMidiBtn.disabled = true;
        }
        
        if (stopMidiBtn) {
            // 即使在暂停状态下也允许点击停止按钮，只要MIDI已加载
            const playbackInfo = midiPlayer.getPlaybackInfo();
            stopMidiBtn.disabled = !(isPlaying || playbackInfo.isPaused);
        }
    }
    
    // 文件选择按钮点击处理
    selectBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    // 文件输入变化处理
    fileInput.addEventListener('change', () => {
        handleFileSelect(fileInput.files);
    });
    
    // 拖放处理
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.add('highlight');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener('drop', () => {
            dropArea.classList.remove('highlight');
        }, false);
    });
    
    dropArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.name.toLowerCase().endsWith('.mid')) {
                droppedFile = file;
                selectedFileText.textContent = `已选择: ${file.name}`;
                uploadBtn.disabled = false;
                resultContainer.style.display = 'none';
                
                // 允许播放上传的MIDI文件
                if (playPauseMidiBtn) {
                    playPauseMidiBtn.disabled = false;
                }
                
                if (stopMidiBtn) {
                    stopMidiBtn.disabled = true;
                }
                
                midiStatus.textContent = '';
                midiStatus.className = 'status';
            } else {
                droppedFile = null;
                selectedFileText.textContent = `错误: 只支持MIDI文件`;
                uploadBtn.disabled = true;
                resultContainer.style.display = 'none';
                
                // 禁用播放按钮
                if (playPauseMidiBtn) {
                    playPauseMidiBtn.disabled = true;
                }
                
                if (stopMidiBtn) {
                    stopMidiBtn.disabled = true;
                }
            }
        }
    }, false);
    
    // 处理选择的文件
    function handleFileSelect(files) {
        if (files.length > 0) {
            const file = files[0];
            if (file.name.toLowerCase().endsWith('.mid')) {
                droppedFile = file;
                selectedFileText.textContent = `已选择: ${file.name}`;
                uploadBtn.disabled = false;
                resultContainer.style.display = 'none';
                
                // 允许播放上传的MIDI文件
                if (playPauseMidiBtn) {
                    playPauseMidiBtn.disabled = false;
                }
                
                if (stopMidiBtn) {
                    stopMidiBtn.disabled = true;
                }
                
                midiStatus.textContent = '';
                midiStatus.className = 'status';
                
                // 隐藏PDF按钮，因为还没有上传和处理
                if (viewOriginalPdfBtn) viewOriginalPdfBtn.style.display = 'none';
                if (downloadOriginalPdfBtn) downloadOriginalPdfBtn.style.display = 'none';
            } else {
                droppedFile = null;
                selectedFileText.textContent = `错误: 只支持MIDI文件`;
                uploadBtn.disabled = true;
                resultContainer.style.display = 'none';
                
                // 禁用播放按钮
                if (playPauseMidiBtn) {
                    playPauseMidiBtn.disabled = true;
                }
                
                if (stopMidiBtn) {
                    stopMidiBtn.disabled = true;
                }
            }
        }
    }
    
    // 播放/暂停逻辑
    if (playPauseMidiBtn) {
        playPauseMidiBtn.addEventListener('click', function() {
            // 根据当前按钮状态决定是播放还是暂停
            const isPlayState = this.dataset.state === 'play';
            
            if (isPlayState) {
                // 播放逻辑
                if (droppedFile) {
                    midiStatus.textContent = '正在检查必要的库...';
                    midiStatus.className = 'status';
                    
                    // 检查必要的库是否已加载
                    if (!checkLibrariesLoaded()) {
                        return;
                    }
                    
                    midiStatus.textContent = '正在启动音频系统...';
                    
                    // 确保音频上下文已启动
                    ensureAudioContext().then(success => {
                        if (success) {
                            // 获取当前播放状态
                            const playbackInfo = midiPlayer.getPlaybackInfo();
                            
                            // 如果当前正在播放转换后的文件，或播放的是不同的文件，先停止当前播放
                            if (playbackInfo.isConverted || (playbackInfo.fileId && playbackInfo.fileId !== droppedFile.name)) {
                                midiPlayer.resetPlayStatus();
                            } else if (playbackInfo.isPaused) {
                                // 如果是暂停状态，继续播放
                                midiPlayer.resumeMidiPlay();
                                updateUIForPlayback(true);
                                midiStatus.textContent = '继续播放原始MIDI文件...';
                                return;
                            }
                            
                            // 加载并播放MIDI文件，明确标记为原始文件(isConverted=false)
                            midiStatus.textContent = '正在加载MIDI文件...';
                            midiPlayer.loadMidiFileAndPlay(droppedFile, false);
                            
                            // 更新UI
                            updateUIForPlayback(true);
                            midiStatus.textContent = '正在播放原始MIDI文件...';
                        }
                    });
                }
            } else {
                // 暂停逻辑
                midiPlayer.pauseMidiPlay();
                updateUIForPlayback(false);
                midiStatus.textContent = '已暂停';
            }
        });
    }
    
    // 停止MIDI播放
    if (stopMidiBtn) {
        stopMidiBtn.addEventListener('click', () => {
            midiPlayer.stopMidiPlay();
            resetPlayerUI();
            midiStatus.textContent = '已停止';
        });
    }
    
    // 播放转换后的MIDI文件
    if (playConvertedMidiBtn) {
        playConvertedMidiBtn.addEventListener('click', () => {
            const sessionId = localStorage.getItem('midi_session_id');
            if (sessionId) {
                midiStatus.textContent = '正在检查必要的库...';
                midiStatus.className = 'status';
                
                // 检查必要的库是否已加载
                if (!checkLibrariesLoaded()) {
                    return;
                }
                
                midiStatus.textContent = '正在启动音频系统...';
                
                // 确保音频上下文已启动
                ensureAudioContext().then(success => {
                    if (success) {
                        const midiUrl = `/download/midi/${sessionId}`;
                        
                        // 获取当前播放状态
                        const playbackInfo = midiPlayer.getPlaybackInfo();
                        
                        // 如果当前播放的不是转换后的文件，或者是不同的URL，重置播放状态
                        if (!playbackInfo.isConverted || (playbackInfo.fileId && playbackInfo.fileId !== midiUrl)) {
                            midiPlayer.resetPlayStatus();
                        }
                        
                        midiStatus.textContent = '正在加载转换后的MIDI文件...';
                        
                        // 加载并播放MIDI文件，明确标记为转换后文件(isConverted=true)
                        midiPlayer.loadMidiAndPlay(midiUrl, true);
                        
                        // 更新UI
                        updateUIForPlayback(true);
                        midiStatus.textContent = '正在播放转换后的MIDI...';
                    }
                });
            } else {
                midiStatus.textContent = '错误: 未找到转换后的MIDI文件';
                midiStatus.className = 'status status-error';
            }
        });
    }
    
    // 播放转换前的MIDI文件
    if (playOriginalMidiBtn) {
        playOriginalMidiBtn.addEventListener('click', function() {
            const sessionId = localStorage.getItem('midi_session_id');
            if (sessionId) {
                midiStatus.textContent = '正在检查必要的库...';
                midiStatus.className = 'status';
                
                // 检查必要的库是否已加载
                if (!checkLibrariesLoaded()) {
                    return;
                }
                
                midiStatus.textContent = '正在启动音频系统...';
                
                // 确保音频上下文已启动
                ensureAudioContext().then(success => {
                    if (success) {
                        const midiUrl = `/download/original-midi/${sessionId}`;
                        
                        // 获取当前播放状态
                        const playbackInfo = midiPlayer.getPlaybackInfo();
                        
                        // 如果当前播放的不是转换前的文件，或者是不同的URL，重置播放状态
                        if (playbackInfo.isConverted || (playbackInfo.fileId && playbackInfo.fileId !== midiUrl)) {
                            midiPlayer.resetPlayStatus();
                        }
                        
                        midiStatus.textContent = '正在加载转换前的MIDI文件...';
                        
                        // 加载并播放MIDI文件，明确标记为转换前文件(isConverted=false)
                        midiPlayer.loadMidiAndPlay(midiUrl, false);
                        
                        // 更新UI
                        updateUIForPlayback(true);
                        midiStatus.textContent = '正在播放转换前的MIDI...';
                    }
                });
            } else {
                midiStatus.textContent = '错误: 未找到转换前的MIDI文件';
                midiStatus.className = 'status status-error';
            }
        });
    }
    
    // 上传按钮点击处理
    uploadBtn.addEventListener('click', () => {
        let file;
        if (droppedFile) {
            file = droppedFile;
        } else if (fileInput.files.length > 0) {
            file = fileInput.files[0];
        } else {
            return;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        uploadBtn.disabled = true;
        uploadProgress.style.width = '0%';
        uploadStatus.textContent = '上传并处理中...';
        uploadStatus.className = 'status';
        
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            uploadProgress.style.width = '100%';
            return response.json();
        })
        .then(data => {
            if (data.success) {
                localStorage.setItem('midi_session_id', data.session_id);
                
                uploadStatus.textContent = data.message;
                uploadStatus.className = 'status status-success';
                
                document.getElementById('result-container').style.display = 'block';
                
                // 更新转换后的文件名显示
                document.getElementById('converted-midi-filename').textContent = data.converted_midi_name;
                document.getElementById('converted-pdf-filename').textContent = data.converted_pdf_name;
                
                // 启用播放转换后的MIDI按钮和播放转换前的MIDI按钮
                if (playConvertedMidiBtn) playConvertedMidiBtn.disabled = false;
                if (playOriginalMidiBtn) playOriginalMidiBtn.disabled = false;
                
                document.getElementById('download-midi-btn').onclick = () => downloadFile('midi', data.session_id);
                document.getElementById('download-pdf-btn').onclick = () => downloadFile('pdf', data.session_id);
                document.getElementById('view-pdf-btn').onclick = () => viewPdf(data.session_id);
                
                // 自动导出并显示原始MIDI文件的PDF
                exportOriginalPDF(data.session_id);
            } else {
                uploadStatus.textContent = data.error || '上传失败';
                uploadStatus.className = 'status status-error';
                uploadBtn.disabled = false;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            uploadStatus.textContent = '上传失败: ' + error.message;
            uploadStatus.className = 'status status-error';
            uploadBtn.disabled = false;
        });
    });
    
    // 尝试预初始化音频系统
    document.body.addEventListener('click', function initAudioOnFirstClick() {
        ensureAudioContext();
        checkLibrariesLoaded();
        // 移除这个一次性事件监听器
        document.body.removeEventListener('click', initAudioOnFirstClick);
    }, { once: true });
    
    // 页面加载完成后检查库的加载状态
    window.addEventListener('load', function() {
        setTimeout(checkLibrariesLoaded, 500);
    });

    // 下载和查看PDF按钮
    const downloadMidiBtn = document.getElementById('download-midi-btn');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    const viewPdfBtn = document.getElementById('view-pdf-btn');
    
    if (downloadMidiBtn) {
        downloadMidiBtn.addEventListener('click', function() {
            const sessionId = localStorage.getItem('midi_session_id');
            if (sessionId) {
                downloadFile('midi', sessionId);
            }
        });
    }
    
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', function() {
            const sessionId = localStorage.getItem('midi_session_id');
            if (sessionId) {
                downloadFile('pdf', sessionId);
            }
        });
    }
    
    if (viewPdfBtn) {
        viewPdfBtn.addEventListener('click', function() {
            const sessionId = localStorage.getItem('midi_session_id');
            if (sessionId) {
                viewPdf(sessionId);
            }
        });
    }
    
    // 查看和下载原始PDF按钮事件处理
    if (viewOriginalPdfBtn) {
        viewOriginalPdfBtn.addEventListener('click', function() {
            const sessionId = localStorage.getItem('midi_session_id');
            if (sessionId) {
                viewOriginalPdf(sessionId);
            }
        });
    }
    
    if (downloadOriginalPdfBtn) {
        downloadOriginalPdfBtn.addEventListener('click', function() {
            const sessionId = localStorage.getItem('midi_session_id');
            if (sessionId) {
                downloadOriginalPdf(sessionId);
            }
        });
    }
    
    // 修改viewPdf函数，在PDF查看器中加载转换后的PDF
    function viewPdf(sessionId) {
        loadPdfToViewer(`/view-pdf/${sessionId}`);
    }
    
    // 在PDF查看器中加载原始MIDI的PDF
    function viewOriginalPdf(sessionId) {
        loadPdfToViewer(`/view-original-pdf/${sessionId}`);
    }
    
    // 加载PDF到查看器中
    function loadPdfToViewer(url) {
        // 检查pdfViewer是否可用
        if (!pdfViewer) {
            console.error('PDF查看器未初始化');
            return;
        }
        
        const pdfViewContainer = document.getElementById('pdf-view-container');
        const togglePdfBtn = document.getElementById('toggle-pdf-btn');
        
        if (pdfViewContainer) {
            // 自动展开PDF查看器
            pdfViewContainer.classList.remove('collapsed');
            if (togglePdfBtn) {
                togglePdfBtn.textContent = '收起';
            }
            
            pdfViewContainer.scrollIntoView({ behavior: 'smooth' });
        }
        
        // 开始加载PDF
        pdfViewer.loadPdfFromUrl(url)
            .then(success => {
                if (success) {
                    console.log('PDF加载成功');
                    // 触发PDF生成完成事件
                    document.dispatchEvent(new CustomEvent('pdf-generation-complete'));
                } else {
                    console.error('PDF加载失败');
                    // 即使加载失败也触发完成事件，以隐藏加载指示器
                    document.dispatchEvent(new CustomEvent('pdf-generation-complete'));
                }
            })
            .catch(error => {
                console.error('加载PDF发生错误:', error);
                // 发生错误时也触发完成事件
                document.dispatchEvent(new CustomEvent('pdf-generation-complete'));
            });
    }
    
    // 实现自动导出原始MIDI文件的PDF
    function exportOriginalPDF(sessionId) {
        // 显示状态信息
        const pdfStatus = document.getElementById('pdf-status');
        pdfStatus.textContent = '正在生成原始MIDI的PDF...';
        pdfStatus.className = 'status status-info';
        
        // 调用后端API导出原始MIDI的PDF
        fetch(`/export-original-pdf/${sessionId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    pdfStatus.textContent = data.message;
                    pdfStatus.className = 'status status-success';
                    
                    // 显示查看和下载按钮
                    viewOriginalPdfBtn.style.display = 'inline-block';
                    downloadOriginalPdfBtn.style.display = 'inline-block';
                    
                    // 确保播放转换前的MIDI按钮也启用
                    if (playOriginalMidiBtn) {
                        playOriginalMidiBtn.disabled = false;
                    }
                    
                    // 自动显示原始PDF
                    loadPdfToViewer(`/view-original-pdf/${sessionId}`);
                    
                    // 如果没有由loadPdfToViewer触发事件（例如PDF加载失败），
                    // 我们仍然需要触发PDF生成完成事件
                    setTimeout(() => {
                        document.dispatchEvent(new CustomEvent('pdf-generation-complete'));
                    }, 5000);
                } else {
                    pdfStatus.textContent = data.error || '生成PDF失败';
                    pdfStatus.className = 'status status-error';
                    // PDF生成失败，也触发完成事件以隐藏加载提示
                    document.dispatchEvent(new CustomEvent('pdf-generation-complete'));
                }
            })
            .catch(error => {
                console.error('导出原始MIDI的PDF失败:', error);
                pdfStatus.textContent = '导出原始MIDI的PDF失败';
                pdfStatus.className = 'status status-error';
                // 出错时也触发完成事件以隐藏加载提示
                document.dispatchEvent(new CustomEvent('pdf-generation-complete'));
            });
    }

    // 添加PDF展开/收起功能
    const togglePdfBtn = document.getElementById('toggle-pdf-btn');
    const pdfViewContainer = document.getElementById('pdf-view-container');
    
    if (togglePdfBtn && pdfViewContainer) {
        togglePdfBtn.addEventListener('click', function() {
            if (pdfViewContainer.classList.contains('collapsed')) {
                // 展开
                pdfViewContainer.classList.remove('collapsed');
                togglePdfBtn.textContent = '收起';
            } else {
                // 收起
                pdfViewContainer.classList.add('collapsed');
                togglePdfBtn.textContent = '展开';
            }
        });
    }
});

// 修改全局函数，添加Global前缀避免与局部函数冲突
function downloadFile(type, sessionId) {
    window.open(`/download/${type}/${sessionId}`, '_blank');
}

function viewPdfGlobal(sessionId) {
    window.open(`/view-pdf/${sessionId}`, '_blank');
}

function viewOriginalPdfGlobal(sessionId) {
    window.open(`/view-original-pdf/${sessionId}`, '_blank');
}

function downloadOriginalPdf(sessionId) {
    window.open(`/download-original-pdf/${sessionId}`, '_blank');
}

// 导出MidiPlayer以便在其他文件中使用
export { MidiPlayer }; 