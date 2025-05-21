// 导入所需的模块
import SampleLibrary from './lib/SampleLibrary.js';
import MidiPlayer from './midiPlayer.js';
import pdfViewer from './pdfViewer.js';

// 全局变量，用于跟踪PDF加载状态
let isPdfLoading = false;
// 跟踪当前加载的PDF URL
let currentPdfUrl = null;

// 使用localStorage保存会话ID以保持状态
document.addEventListener('DOMContentLoaded', function () {
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
    const midiProgressContainer = document.querySelector('.midi-progress-container');
    const midiProgressHandle = document.getElementById('midi-progress-handle');
    const midiProgressHover = document.getElementById('midi-progress-hover');
    const currentTimeDisplay = document.getElementById('current-time');
    const totalTimeDisplay = document.getElementById('total-time');
    const midiStatus = document.getElementById('midi-status');
    const playConvertedMidiBtn = document.getElementById('play-converted-midi-btn');
    const playOriginalMidiBtn = document.getElementById('play-original-midi-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeValue = document.getElementById('volume-value');

    // 其他功能按钮
    const downloadMidiBtn = document.getElementById('download-midi-btn');
    const viewPdfBtn = document.getElementById('view-pdf-btn');
    const viewOriginalPdfBtn = document.getElementById('view-original-pdf-btn');
    const downloadCurrentPdfBtn = document.getElementById('download-current-pdf-btn');

    // 隐藏原始MIDI PDF按钮，直到导出成功
    if (viewOriginalPdfBtn) viewOriginalPdfBtn.style.display = 'none';

    // 确保结果区域默认不显示
    resultContainer.style.display = 'none';

    // 存储拖放的文件
    let droppedFile = null;

    // 音频上下文是否已经启动
    let audioContextStarted = false;

    // 跟踪当前活动的播放按钮
    let activePlayButton = null;

    // 存储MIDI的总时长
    let midiTotalDuration = 0;

    // 存储是否正在拖动进度条
    let isDraggingProgress = false;
    let shouldUpdateProgress = true;

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
        onNotePlay: function (note) {
            // 当播放音符时的回调
            updateMidiProgress();
        },
        onMusicEnd: function () {
            // 当音乐结束时的回调
            resetPlayerUI();
            midiStatus.textContent = '播放完成';
            midiStatus.className = 'status status-success';
        },
        debug: true // 启用调试信息
    });

    // 音量滑块事件处理
    if (volumeSlider) {
        volumeSlider.addEventListener('input', function () {
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

            // 如果正在拖动进度条，则不更新UI
            if (!shouldUpdateProgress) return;

            // 计算总时长（取最后一个音符的时间+持续时间）
            let totalDuration = calculateTotalDuration();

            // 更新进度条
            if (totalDuration > 0) {
                const percentage = Math.min((playedTime / totalDuration) * 100, 100);
                updateProgressUI(percentage, playedTime, totalDuration);
            }
        }
    }

    // 计算MIDI文件总时长
    function calculateTotalDuration() {
        if (!midiPlayer.midiNotes || midiPlayer.midiNotes.length === 0) return 0;
        
        const lastNote = midiPlayer.midiNotes.reduce((prev, current) => {
            return (prev.time + prev.duration > current.time + current.duration) ? prev : current;
        });
        const totalDuration = (lastNote.time + lastNote.duration) * 1000; // 转换为毫秒
        
        // 保存总时长供其他地方使用
        midiTotalDuration = totalDuration;
        
        // 确保总时长显示更新
        const totalMinutes = Math.floor(totalDuration / 60000);
        const totalSeconds = Math.floor((totalDuration % 60000) / 1000);
        totalTimeDisplay.textContent = `${totalMinutes.toString().padStart(2, '0')}:${totalSeconds.toString().padStart(2, '0')}`;
        
        return totalDuration;
    }

    // 更新进度条UI
    function updateProgressUI(percentage, currentTimeMs, totalDurationMs) {
        // 更新进度条位置
        midiProgress.style.width = `${percentage}%`;
        midiProgressHandle.style.left = `${percentage}%`;
        
        // 更新显示的时间
        const currentMinutes = Math.floor(currentTimeMs / 60000);
        const currentSeconds = Math.floor((currentTimeMs % 60000) / 1000);
        currentTimeDisplay.textContent = `${currentMinutes.toString().padStart(2, '0')}:${currentSeconds.toString().padStart(2, '0')}`;
        
        // 更新总时长显示
        const totalMinutes = Math.floor(totalDurationMs / 60000);
        const totalSeconds = Math.floor((totalDurationMs % 60000) / 1000);
        totalTimeDisplay.textContent = `${totalMinutes.toString().padStart(2, '0')}:${totalSeconds.toString().padStart(2, '0')}`;
    }

    // 重置播放器UI
    function resetPlayerUI() {
        midiProgress.style.width = '0%';
        midiProgressHandle.style.left = '0%';
        currentTimeDisplay.textContent = '00:00';
        totalTimeDisplay.textContent = '00:00';

        // 重置文件名显示，但如果当前仍有文件信息则保留显示
        const currentFilenameElement = document.getElementById('current-midi-filename');
        if (currentFilenameElement) {
            const playbackInfo = midiPlayer.getPlaybackInfo();
            if (playbackInfo.fileId) {
                // 直接调用updateCurrentFilename函数以保持逻辑一致
                updateCurrentFilename();
            } else {
                currentFilenameElement.textContent = '未加载文件';
            }
        }

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
        
        // 检查"下载MIDI"按钮是否应该启用
        const downloadCurrentMidiBtn = document.getElementById('download-current-midi-btn');
        if (downloadCurrentMidiBtn) {
            // 即使停止播放，如果有文件也保持下载按钮可用
            const playbackInfo = midiPlayer.getPlaybackInfo();
            downloadCurrentMidiBtn.disabled = !playbackInfo.fileId;
        }
    }

    // 更新播放器UI为播放状态
    function updateUIForPlayback(isPlaying) {
        if (playPauseMidiBtn) {
            if (isPlaying) {
                playPauseMidiBtn.dataset.state = 'pause';
                playPauseMidiBtn.innerHTML = '<span class="btn-icon play-icon"></span><span class="btn-icon pause-icon"></span> 暂停';
                stopMidiBtn.disabled = false;
                // 启用下载当前MIDI按钮
                if (document.getElementById('download-current-midi-btn')) {
                    document.getElementById('download-current-midi-btn').disabled = false;
                }
                
                // 更新文件名显示
                updateCurrentFilename();
            } else {
                playPauseMidiBtn.dataset.state = 'play';
                playPauseMidiBtn.innerHTML = '<span class="btn-icon play-icon"></span><span class="btn-icon pause-icon"></span> 播放';
                // 不禁用下载按钮，允许用户下载当前加载的MIDI
            }
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

    // 更新当前文件名显示
    function updateCurrentFilename() {
        const currentFilenameElement = document.getElementById('current-midi-filename');
        if (!currentFilenameElement) return;
        
        const playbackInfo = midiPlayer.getPlaybackInfo();
        if (playbackInfo.fileId) {
            let displayName = "";
            
            // 处理转换后的文件，尝试获取更友好的文件名
            if (playbackInfo.isConverted) {
                // 尝试从页面中获取转换后的文件名
                const convertedFileElement = document.getElementById('converted-midi-filename');
                if (convertedFileElement && convertedFileElement.textContent) {
                    displayName = convertedFileElement.textContent;
                } else {
                    // 如果无法获取，从URL中提取并添加标识
                    displayName = decodeURIComponent(playbackInfo.fileId);
                    if (displayName.includes('/')) {
                        displayName = displayName.split('/').pop();
                    }
                    
                    // 如果是UUID格式，尝试使用更友好的名称
                    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(displayName)) {
                        const sessionId = localStorage.getItem('midi_session_id');
                        if (sessionId === displayName) {
                            // 尝试获取原始文件名
                            const fileInput = document.getElementById('file-input');
                            if (fileInput && fileInput.files.length > 0) {
                                let originalName = fileInput.files[0].name;
                                // 移除扩展名
                                const extIndex = originalName.lastIndexOf('.');
                                if (extIndex > 0) {
                                    originalName = originalName.substring(0, extIndex);
                                }
                                displayName = originalName + "-转换后.mid";
                            } else if (droppedFile) {
                                let originalName = droppedFile.name;
                                // 移除扩展名
                                const extIndex = originalName.lastIndexOf('.');
                                if (extIndex > 0) {
                                    originalName = originalName.substring(0, extIndex);
                                }
                                displayName = originalName + "-转换后.mid";
                            } else {
                                displayName = "转换后的MIDI文件";
                            }
                        }
                    }
                }
                
                // 添加标识
                if (!playbackInfo.isPlaying && playbackInfo.isPaused) {
                    displayName += ' (已暂停)';
                } else if (!playbackInfo.isPlaying && !playbackInfo.isPaused) {
                    displayName += ' (已停止播放)';
                }
            } else {
                // 原始文件处理
                displayName = decodeURIComponent(playbackInfo.fileId);
                
                // 如果是URL，只显示文件名部分
                if (displayName.includes('/')) {
                    displayName = displayName.split('/').pop();
                }
                
                // 如果是UUID格式，尝试使用更友好的名称
                if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(displayName)) {
                    // 对于原始文件，检查是否有上传的文件名
                    if (droppedFile) {
                        displayName = droppedFile.name;
                    } else {
                        displayName = "原始MIDI文件";
                    }
                }
                
                // 添加标识
                if (!playbackInfo.isPlaying && playbackInfo.isPaused) {
                    displayName += ' (已暂停)';
                } else if (!playbackInfo.isPlaying && !playbackInfo.isPaused) {
                    displayName += ' (已停止播放)';
                }
            }
            
            currentFilenameElement.textContent = displayName;
        } else {
            currentFilenameElement.textContent = '未加载文件';
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
        playPauseMidiBtn.addEventListener('click', () => {
            const playState = playPauseMidiBtn.dataset.state;
            
            // 检查必要的库是否已加载
            if (!checkLibrariesLoaded()) {
                return;
            }
            
            // 确保音频上下文已启动
            ensureAudioContext().then(success => {
                if (success) {
                    if (playState === 'play') {
                        // 当前状态是"播放"，应切换为"暂停"
                        if (!midiPlayer.currentMidiData) {
                            // 如果还没有当前MIDI数据，则从文件加载
                            if (droppedFile) {
                                midiPlayer.loadMidiFileAndPlay(droppedFile);
                                midiStatus.textContent = '播放中...';
                                updateUIForPlayback(true);
                                // 在加载完成后显示总时长
                                setTimeout(displayMidiTotalDuration, 500);
                                // 更新文件名显示
                                setTimeout(updateCurrentFilename, 500);
                            }
                        } else if (midiPlayer.isPaused) {
                            // 如果是暂停状态，则恢复播放
                            midiPlayer.resumeMidiPlay();
                            midiStatus.textContent = '恢复播放...';
                            updateUIForPlayback(true);
                        } else {
                            // 重新开始播放当前MIDI
                            midiPlayer.resetPlayStatus();
                            if (droppedFile) {
                                midiPlayer.loadMidiFileAndPlay(droppedFile);
                                midiStatus.textContent = '重新播放...';
                                updateUIForPlayback(true);
                                // 在加载完成后显示总时长
                                setTimeout(displayMidiTotalDuration, 500);
                                // 更新文件名显示
                                setTimeout(updateCurrentFilename, 500);
                            }
                        }
                    } else {
                        // 当前状态是"暂停"，暂停播放
                        midiPlayer.pauseMidiPlay();
                        midiStatus.textContent = '已暂停';
                        updateUIForPlayback(false);
                    }
                }
            });
        });
    }

    // 停止MIDI播放
    if (stopMidiBtn) {
        stopMidiBtn.addEventListener('click', () => {
            // 先保存当前文件ID，因为stopMidiPlay会重置一些状态
            const currentFileId = midiPlayer.currentFileId;
            const isConvertedFile = midiPlayer.isConvertedFile;
            
            midiPlayer.stopMidiPlay();
            
            // 恢复文件ID，确保下载功能仍然可用
            midiPlayer.currentFileId = currentFileId;
            midiPlayer.isConvertedFile = isConvertedFile;
            
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
                        
                        // 在加载完成后显示总时长
                        setTimeout(displayMidiTotalDuration, 500);
                        
                        // 更新文件名显示
                        setTimeout(updateCurrentFilename, 500);
                    }
                });
            } else {
                midiStatus.textContent = '错误: 未找到转换后的MIDI文件';
                midiStatus.className = 'status status-error';
            }
        });
    }

    // 播放原始MIDI文件
    if (playOriginalMidiBtn) {
        playOriginalMidiBtn.addEventListener('click', () => {
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

                        // 如果当前播放的是转换后的文件，或者是不同的URL，重置播放状态
                        if (playbackInfo.isConverted || (playbackInfo.fileId && playbackInfo.fileId !== midiUrl)) {
                            midiPlayer.resetPlayStatus();
                        }

                        midiStatus.textContent = '正在加载原始MIDI文件...';

                        // 加载并播放MIDI文件，明确标记为原始文件(isConverted=false)
                        midiPlayer.loadMidiAndPlay(midiUrl, false);

                        // 更新UI
                        updateUIForPlayback(true);
                        midiStatus.textContent = '正在播放原始MIDI...';
                        
                        // 在加载完成后显示总时长
                        setTimeout(displayMidiTotalDuration, 500);
                        
                        // 更新文件名显示
                        setTimeout(updateCurrentFilename, 500);
                    }
                });
            } else {
                midiStatus.textContent = '错误: 未找到原始MIDI文件';
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

                    // 启用所有功能按钮
                    if (playConvertedMidiBtn) playConvertedMidiBtn.disabled = false;
                    if (playOriginalMidiBtn) playOriginalMidiBtn.disabled = false;
                    
                    // 启用下载和查看按钮
                    if (downloadMidiBtn) downloadMidiBtn.disabled = false;
                    if (viewPdfBtn) viewPdfBtn.disabled = false;
                    
                    // 设置按钮点击事件
                    if (downloadMidiBtn) downloadMidiBtn.onclick = () => downloadFile('midi', data.session_id);
                    if (viewPdfBtn) viewPdfBtn.onclick = () => viewPdf(data.session_id);

                    // 显示和启用原始PDF按钮
                    if (viewOriginalPdfBtn) {
                        viewOriginalPdfBtn.style.display = 'inline-block';
                        viewOriginalPdfBtn.disabled = false;
                        viewOriginalPdfBtn.onclick = () => viewOriginalPdf(data.session_id);
                    }

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
    window.addEventListener('load', function () {
        setTimeout(checkLibrariesLoaded, 500);
    });

    // 为按钮添加事件处理
    if (downloadMidiBtn) {
        downloadMidiBtn.addEventListener('click', function () {
            const sessionId = localStorage.getItem('midi_session_id');
            if (sessionId) {
                downloadFile('midi', sessionId);
            }
        });
    }

    if (viewPdfBtn) {
        viewPdfBtn.addEventListener('click', function () {
            const sessionId = localStorage.getItem('midi_session_id');
            if (sessionId) {
                viewPdf(sessionId);
            }
        });
    }

    // 查看原始PDF按钮事件处理
    if (viewOriginalPdfBtn) {
        viewOriginalPdfBtn.addEventListener('click', function () {
            const sessionId = localStorage.getItem('midi_session_id');
            if (sessionId) {
                viewOriginalPdf(sessionId);
            }
        });
    }

    // 初始禁用下载当前PDF按钮，因为还没有PDF加载
    if (downloadCurrentPdfBtn) {
        downloadCurrentPdfBtn.disabled = true;
        
        // 添加点击事件处理
        downloadCurrentPdfBtn.addEventListener('click', function() {
            if (currentPdfUrl) {
                // 从URL提取会话ID，例如 /view-pdf/abc123 或 /view-original-pdf/abc123
                let urlParts = currentPdfUrl.split('/');
                let sessionId = urlParts[urlParts.length - 1];
                let isPdfOriginal = currentPdfUrl.includes('original');
                
                if (sessionId) {
                    if (isPdfOriginal) {
                        window.open(`/download-original-pdf/${sessionId}`, '_blank');
                    } else {
                        window.open(`/download/pdf/${sessionId}`, '_blank');
                    }
                }
            }
        });
    }

    // 添加播放器中新下载按钮的事件处理
    const downloadCurrentMidiBtn = document.getElementById('download-current-midi-btn');
    if (downloadCurrentMidiBtn) {
        downloadCurrentMidiBtn.disabled = true; // 初始禁用
        
        downloadCurrentMidiBtn.addEventListener('click', function() {
            // 获取当前播放文件的信息
            const playbackInfo = midiPlayer.getPlaybackInfo();
            if (playbackInfo.fileId) {
                // 根据是否是转换后的文件决定下载URL
                if (playbackInfo.isConverted) {
                    // 下载转换后的MIDI文件
                    const sessionId = localStorage.getItem('midi_session_id');
                    if (sessionId) {
                        downloadFile('midi', sessionId);
                    }
                } else {
                    // 下载原始MIDI文件
                    const sessionId = localStorage.getItem('midi_session_id');
                    if (sessionId) {
                        window.open(`/download/original-midi/${sessionId}`, '_blank');
                    }
                }
            } else {
                // 如果是从本地文件播放的，找不到服务器端的URL，显示提示
                alert('无法下载当前播放的MIDI文件');
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
    function loadPdfToViewer(url, forceLoad = false) {
        // 如果已经在加载中，而且不是强制模式，则跳过
        if (isPdfLoading && !forceLoad) {
            console.log('已有PDF正在加载，跳过此次加载请求');
            return;
        }

        // 设置加载状态标志
        isPdfLoading = true;
        // 保存当前PDF URL
        currentPdfUrl = url;

        // 检查pdfViewer是否可用
        if (!pdfViewer) {
            console.error('PDF查看器未初始化');
            isPdfLoading = false;
            return;
        }

        // 设置加载状态
        const pdfViewContainer = document.getElementById('pdf-view-container');
        if (!pdfViewContainer) {
            console.error('找不到PDF查看器容器元素');
            isPdfLoading = false;
            return;
        }

        // 日志记录调用堆栈，便于调试
        console.log('PDF加载请求:', url, '调用来源:', new Error().stack);

        // 显示独立的全局加载指示器
        showPdfLoadingIndicator();

        // 自动展开PDF查看器
        const togglePdfBtn = document.getElementById('toggle-pdf-btn');
        pdfViewContainer.classList.remove('collapsed');
        if (togglePdfBtn) {
            togglePdfBtn.textContent = '收起';
        }

        pdfViewContainer.scrollIntoView({ behavior: 'smooth' });

        // 使用单独的Promise和超时处理来确保加载完成
        console.log('开始加载PDF:', url);

        // 开始加载PDF
        pdfViewer.loadPdfFromUrl(url)
            .then(success => {
                // 隐藏加载指示器
                hidePdfLoadingIndicator();

                // 重置加载状态标志
                isPdfLoading = false;

                if (success) {
                    console.log('PDF加载成功');
                    // 启用下载当前PDF按钮
                    if (downloadCurrentPdfBtn) {
                        downloadCurrentPdfBtn.disabled = false;
                    }
                    // 触发PDF生成完成事件
                    document.dispatchEvent(new CustomEvent('pdf-generation-complete'));
                } else {
                    console.error('PDF加载失败');
                    // 在PDF查看器中显示错误信息
                    const pdfViewer = document.getElementById('pdf-viewer');
                    if (pdfViewer && pdfViewer.childElementCount === 0) {
                        const errorMsg = document.createElement('p');
                        errorMsg.className = 'error';
                        errorMsg.textContent = '无法加载PDF';
                        pdfViewer.appendChild(errorMsg);
                    }

                    // 禁用下载当前PDF按钮
                    if (downloadCurrentPdfBtn) {
                        downloadCurrentPdfBtn.disabled = true;
                    }

                    // 即使加载失败也触发完成事件，以隐藏加载指示器
                    document.dispatchEvent(new CustomEvent('pdf-generation-complete'));
                }
            })
            .catch(error => {
                // 隐藏加载指示器
                hidePdfLoadingIndicator();

                // 重置加载状态标志
                isPdfLoading = false;

                console.error('加载PDF发生错误:', error);

                // 在PDF查看器中显示错误信息
                const pdfViewer = document.getElementById('pdf-viewer');
                if (pdfViewer) {
                    const errorMsg = document.createElement('p');
                    errorMsg.className = 'error';
                    errorMsg.textContent = `加载PDF失败: ${error.message}`;
                    pdfViewer.appendChild(errorMsg);
                }

                // 禁用下载当前PDF按钮
                if (downloadCurrentPdfBtn) {
                    downloadCurrentPdfBtn.disabled = true;
                }

                // 发生错误时也触发完成事件
                document.dispatchEvent(new CustomEvent('pdf-generation-complete'));
            });
    }

    // 显示PDF加载指示器
    function showPdfLoadingIndicator() {
        // 移除可能已存在的加载指示器
        removePdfLoadingIndicator();

        // 创建新的加载指示器
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'pdf-global-loading';
        loadingIndicator.className = 'pdf-loading-overlay';

        const spinner = document.createElement('div');
        spinner.className = 'spinner';

        const loadingText = document.createElement('p');
        loadingText.textContent = '正在加载PDF...';

        loadingIndicator.appendChild(spinner);
        loadingIndicator.appendChild(loadingText);

        // 添加到PDF容器
        const pdfContainer = document.getElementById('pdf-container');
        if (pdfContainer) {
            pdfContainer.appendChild(loadingIndicator);
        }
    }

    // 隐藏PDF加载指示器
    function hidePdfLoadingIndicator() {
        removePdfLoadingIndicator();
    }

    // 移除PDF加载指示器
    function removePdfLoadingIndicator() {
        const existingIndicator = document.getElementById('pdf-global-loading');
        if (existingIndicator && existingIndicator.parentNode) {
            existingIndicator.parentNode.removeChild(existingIndicator);
        }
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

                    // 显示查看按钮
                    if (viewOriginalPdfBtn) {
                        viewOriginalPdfBtn.style.display = 'inline-block';
                    }

                    // 确保播放转换前的MIDI按钮也启用
                    if (playOriginalMidiBtn) {
                        playOriginalMidiBtn.disabled = false;
                    }

                    // 自动显示原始PDF - 使用强制加载模式
                    loadPdfToViewer(`/view-original-pdf/${sessionId}`, true);

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

                    // 确保重置加载状态
                    isPdfLoading = false;
                }
            })
            .catch(error => {
                console.error('导出原始MIDI的PDF失败:', error);
                pdfStatus.textContent = '导出原始MIDI的PDF失败';
                pdfStatus.className = 'status status-error';
                // 出错时也触发完成事件以隐藏加载提示
                document.dispatchEvent(new CustomEvent('pdf-generation-complete'));

                // 确保重置加载状态
                isPdfLoading = false;
            });
    }

    // 添加PDF展开/收起功能
    const togglePdfBtn = document.getElementById('toggle-pdf-btn');
    const pdfViewContainer = document.getElementById('pdf-view-container');

    if (togglePdfBtn && pdfViewContainer) {
        togglePdfBtn.addEventListener('click', function () {
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

    // 初始化进度条拖动功能
    if (midiProgressContainer) {
        // 点击进度条跳转到指定位置
        midiProgressContainer.addEventListener('click', function(event) {
            if (isDraggingProgress) return; // 如果正在拖动，则忽略点击事件
            
            // 获取点击的位置占总宽度的百分比
            const progressRect = midiProgressContainer.getBoundingClientRect();
            const clickX = event.clientX - progressRect.left;
            const percentage = (clickX / progressRect.width) * 100;
            const seekPosition = Math.max(0, Math.min(100, percentage));
            
            // 只有当有MIDI数据且不是正在拖拽时才执行跳转
            if (midiPlayer.currentMidiData) {
                seekToPosition(seekPosition);
            }
        });

        // 鼠标悬停在进度条上时显示悬停位置
        midiProgressContainer.addEventListener('mousemove', function(event) {
            // 获取鼠标位置占总宽度的百分比
            const progressRect = midiProgressContainer.getBoundingClientRect();
            const mouseX = event.clientX - progressRect.left;
            const percentage = (mouseX / progressRect.width) * 100;
            
            // 更新悬停指示器
            midiProgressHover.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
        });

        // 鼠标离开进度条时隐藏悬停指示器
        midiProgressContainer.addEventListener('mouseleave', function() {
            midiProgressHover.style.width = '0%';
        });

        // 拖动进度条手柄
        midiProgressHandle.addEventListener('mousedown', function(event) {
            event.preventDefault();
            isDraggingProgress = true;
            shouldUpdateProgress = false;
            
            // 添加active类以保持手柄可见
            midiProgressHandle.classList.add('active');
            
            // 添加全局鼠标移动和释放事件
            document.addEventListener('mousemove', handleProgressDrag);
            document.addEventListener('mouseup', handleProgressRelease);
        });
    }

    // 处理进度条拖动
    function handleProgressDrag(event) {
        if (!isDraggingProgress) return;
        
        // 获取拖动的位置占总宽度的百分比
        const progressRect = midiProgressContainer.getBoundingClientRect();
        const dragX = event.clientX - progressRect.left;
        const percentage = (dragX / progressRect.width) * 100;
        
        // 限制在0-100%范围内
        const seekPosition = Math.max(0, Math.min(100, percentage));
        
        // 更新UI（但不触发音频跳转）
        midiProgress.style.width = `${seekPosition}%`;
        midiProgressHandle.style.left = `${seekPosition}%`;
        
        // 如果有总时长，计算并显示当前拖动到的时间
        if (midiTotalDuration > 0) {
            const dragTimeMs = (seekPosition / 100) * midiTotalDuration;
            const minutes = Math.floor(dragTimeMs / 60000);
            const seconds = Math.floor((dragTimeMs % 60000) / 1000);
            currentTimeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    // 处理进度条释放
    function handleProgressRelease(event) {
        if (!isDraggingProgress) return;
        
        // 获取最终位置占总宽度的百分比
        const progressRect = midiProgressContainer.getBoundingClientRect();
        const releaseX = event.clientX - progressRect.left;
        const percentage = (releaseX / progressRect.width) * 100;
        
        // 限制在0-100%范围内
        const seekPosition = Math.max(0, Math.min(100, percentage));
        
        // 执行音频跳转
        if (midiPlayer.currentMidiData) {
            seekToPosition(seekPosition);
        }
        
        // 清理
        isDraggingProgress = false;
        shouldUpdateProgress = true;
        midiProgressHandle.classList.remove('active');
        
        // 移除全局事件监听器
        document.removeEventListener('mousemove', handleProgressDrag);
        document.removeEventListener('mouseup', handleProgressRelease);
    }

    // 跳转到指定位置
    function seekToPosition(percentage) {
        if (!midiPlayer.currentMidiData || !midiPlayer.midiNotes.length) return;
        
        // 计算要跳转到的时间位置（毫秒）
        const totalDuration = calculateTotalDuration();
        const seekTimeMs = (percentage / 100) * totalDuration;
        
        // 保存当前的播放状态
        const wasPlaying = !midiPlayer.midiStop && !midiPlayer.isPaused;
        
        // 使用新的暂停方法，不清空MIDI数据
        const hasValidData = midiPlayer.pauseForSeek();
        if (!hasValidData) {
            console.error('跳转失败：无效的MIDI数据');
            return;
        }
        
        // 重置音符播放状态
        midiPlayer.midiNotes.forEach(note => {
            // 根据音符时间和设定的跳转时间，确定该音符的播放状态
            // note.time是以秒为单位，seekTimeMs是以毫秒为单位
            note.played = note.time < (seekTimeMs / 1000);
            if (note.played && midiPlayer.debug) {
                console.log(`标记音符已播放: ${note.name || note.midi}, 时间: ${note.time}秒 (跳转点: ${seekTimeMs/1000}秒)`);
            }
        });
        
        // 查找并显示总时长
        if (totalDuration > 0) {
            const totalMinutes = Math.floor(totalDuration / 60000);
            const totalSeconds = Math.floor((totalDuration % 60000) / 1000);
            totalTimeDisplay.textContent = `${totalMinutes.toString().padStart(2, '0')}:${totalSeconds.toString().padStart(2, '0')}`;
        }
        
        // 设置状态但不立即继续播放
        midiPlayer.startTime = (+new Date()) - seekTimeMs;
        midiPlayer.lastPlayedTime = seekTimeMs;
        midiPlayer.isPaused = !wasPlaying;
        
        // 更新UI展示
        updateProgressUI(percentage, seekTimeMs, totalDuration);
        
        // 如果之前在播放，则从新位置继续播放
        if (wasPlaying) {
            const resumed = midiPlayer.resumeFromSeek(seekTimeMs);
            if (resumed) {
                updateUIForPlayback(true);
                console.log('从新位置继续播放:', seekTimeMs, 'ms');
            } else {
                console.error('恢复播放失败');
                // 如果恢复失败，显示为暂停状态
                playPauseMidiBtn.dataset.state = 'play';
                playPauseMidiBtn.innerHTML = '<span class="btn-icon play-icon"></span><span class="btn-icon pause-icon"></span> 播放';
            }
        } else {
            // 否则显示为暂停状态，但确保停止按钮可用
            playPauseMidiBtn.dataset.state = 'play';
            playPauseMidiBtn.innerHTML = '<span class="btn-icon play-icon"></span><span class="btn-icon pause-icon"></span> 播放';
            stopMidiBtn.disabled = false;
            console.log('跳转到新位置并保持暂停:', seekTimeMs, 'ms');
        }
    }

    // 添加显示总时长的函数
    function displayMidiTotalDuration() {
        if (!midiPlayer.midiNotes || midiPlayer.midiNotes.length === 0) return;
        
        // 计算并显示总时长
        calculateTotalDuration();
    }
});

// 在页面加载完成后绑定事件
document.addEventListener('DOMContentLoaded', () => {
    const openEditorBtn = document.getElementById('open-editor-btn');
    if (openEditorBtn) {
        openEditorBtn.addEventListener('click', () => {
            // 跳转到 MidiEditor.html（注意路径是否正确）
            console.log("Load html");
            window.open('/MidiEditor', 'blank');
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