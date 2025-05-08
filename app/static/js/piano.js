/**
 * 钢琴组件JavaScript
 * 实现钢琴键盘的交互和音符播放功能
 */

import { Notes } from './lib/notes.js';
import SampleLibrary from './lib/ToneInstruments.js';

class Piano {
  constructor() {
    this.pianoHTML = `
      <div class="piano-component" id="pianoComponent">
        <div class="piano-scroll-wrap">
          <div class="piano-wrap" id="pianoWrap">
            <div class="piano-band">
              <div class="piano-tip">⇧ 代表 shift 键</div>
            </div>
            <div class="piano-key-wrap" id="pianoKeyWrap">
              <!-- 白键将通过JavaScript动态生成 -->
              <!-- 黑键将通过JavaScript动态生成 -->
            </div>
          </div>
        </div>

        <div class="piano-options">
          <div class="option-item-wrap">
            <div class="option-item">
              <label class="label">
                显示按键提示
                <input type="checkbox" id="keyname" checked />
                <i></i>
              </label>
            </div>

            <div class="option-item">
              <label class="label">
                显示音名
                <input type="checkbox" id="notename" />
                <i></i>
              </label>
            </div>
          </div>
        </div>

        <canvas id="audioEffectCanvas"></canvas>
      </div>
    `;

    // 配置参数
    this.pianoShow = false;
    this.enableBlackKey = false; // 启用黑色按键
    this.showKeyName = true; // 显示键名
    this.showNoteName = false; // 显示音符名
    this.synth = null;
    this.keydownTimer = null;
    this.keyLock = false;
    this.lastKeyCode = '';
    this.audioContextStarted = false;
    this.audioLoaded = false;
    
    // 绑定方法的this
    this.init = this.init.bind(this);
    this.initPiano = this.initPiano.bind(this);
    this.computeEleSize = this.computeEleSize.bind(this);
    this.renderPianoKeys = this.renderPianoKeys.bind(this);
    this.bindKeyboardEvent = this.bindKeyboardEvent.bind(this);
    this.clickPianoKey = this.clickPianoKey.bind(this);
    this.getNoteByKeyCode = this.getNoteByKeyCode.bind(this);
    this.getNoteByName = this.getNoteByName.bind(this);
    this.playNoteByKeyCode = this.playNoteByKeyCode.bind(this);
    this.playNote = this.playNote.bind(this);
    this.startAudioContext = this.startAudioContext.bind(this);
  }

  // 初始化，插入HTML并启动钢琴
  init(element) {
    // 将钢琴HTML插入到指定元素
    if (typeof element === 'string') {
      document.querySelector(element).insertAdjacentHTML('afterbegin', this.pianoHTML);
    } else if (element instanceof HTMLElement) {
      element.insertAdjacentHTML('afterbegin', this.pianoHTML);
    } else {
      document.body.insertAdjacentHTML('afterbegin', this.pianoHTML);
    }

    // 初始化钢琴
    this.initPiano();

    // 绑定开关事件
    document.getElementById('keyname').addEventListener('change', (e) => {
      this.showKeyName = e.target.checked;
      this.updateKeyDisplay();
    });

    document.getElementById('notename').addEventListener('change', (e) => {
      this.showNoteName = e.target.checked;
      this.updateKeyDisplay();
    });
  }

  // 启动AudioContext
  startAudioContext() {
    if (this.audioContextStarted) return Promise.resolve();
    
    return Tone.start().then(() => {
      console.log('AudioContext已启动');
      this.audioContextStarted = true;
    }).catch(err => {
      console.error('AudioContext启动失败:', err);
    });
  }

  // 更新键盘显示
  updateKeyDisplay() {
    const keyNameElements = document.querySelectorAll('.keyname');
    const noteNameElements = document.querySelectorAll('.notename');

    keyNameElements.forEach(elem => {
      elem.style.display = this.showKeyName ? 'block' : 'none';
    });

    noteNameElements.forEach(elem => {
      elem.style.display = this.showNoteName ? 'block' : 'none';
    });
  }

  // 钢琴初始化
  async initPiano() {
    this.renderPianoKeys();
    
    setTimeout(() => {
      this.computeEleSize();
      document.getElementById('pianoWrap').classList.add('visible');
      this.pianoShow = true;
    }, 300);
    
    this.bindKeyboardEvent();

    // 加载钢琴音色
    try {
      this.synth = SampleLibrary.load({
        instruments: "piano",
        onload: () => {
          console.log('音频加载完成');
          this.audioLoaded = true;
        }
      });
    } catch(e) {
      console.error('音频加载失败:', e);
    }
    
    // 在用户点击钢琴键时启动AudioContext
    document.addEventListener('click', this.startAudioContext, { once: true });
  }

  // 计算元素尺寸
  computeEleSize() {
    const pianoKeyWrap = document.getElementById('pianoKeyWrap');
    const wkeyWidth = pianoKeyWrap.offsetWidth / 36; // 36个白键
    const wkeyHeight = wkeyWidth * 6;  // 调整白键高度比例
    const bkeyHeight = wkeyHeight * 0.65;  // 黑键高度为白键的65%
    
    pianoKeyWrap.style.height = wkeyHeight + 'px';
    
    // 只设置黑键高度，不设置宽度（宽度由CSS控制）
    const bkeys = document.querySelectorAll('.bkey');
    bkeys.forEach(key => {
      key.style.height = bkeyHeight + 'px';
    });
  }

  // 渲染钢琴键
  renderPianoKeys() {
    const pianoKeyWrap = document.getElementById('pianoKeyWrap');
    let whiteKeysHTML = '';
    let blackKeysHTML = '';

    // 渲染白色按键
    Notes.Piano.filter(note => note.type === 'white').forEach(note => {
      whiteKeysHTML += `
        <div class="piano-key wkey" data-keycode="${note.keyCode}" data-name="${note.name}">
          <div class="keytip">
            <div class="keyname" ${!this.showKeyName ? 'style="display:none"' : ''}>${note.key}</div>
            <div class="notename" ${!this.showNoteName ? 'style="display:none"' : ''}>${note.name}</div>
          </div>
        </div>
      `;
    });

    // 渲染黑色按键 - 不再使用分组容器
    Notes.Piano.filter(note => note.type === 'black').forEach(note => {
      blackKeysHTML += `
        <div class="piano-key bkey" data-keycode="${note.keyCode}" data-name="${note.name}">
          <div class="keytip">
            <div class="keyname" ${!this.showKeyName ? 'style="display:none"' : ''}>${note.key}</div>
          </div>
        </div>
      `;
    });

    // 添加到DOM
    pianoKeyWrap.innerHTML = whiteKeysHTML + blackKeysHTML;

    // 绑定点击事件
    const pianoKeys = document.querySelectorAll('.piano-key');
    pianoKeys.forEach(key => {
      key.addEventListener('mousedown', async (e) => {
        // 确保点击时启动AudioContext
        await this.startAudioContext();
        
        const keyCode = key.getAttribute('data-keycode');
        this.clickPianoKey(e, keyCode);
      });
    });
  }

  // 键盘事件绑定
  bindKeyboardEvent() {
    const ShiftKeyCode = 16;
    
    document.addEventListener('keydown', async (e) => {
      // 确保按键时启动AudioContext
      await this.startAudioContext();
      
      let keyCode = e.keyCode;
      
      // 按住Shift键，则启用黑色按键
      if (keyCode == ShiftKeyCode) {
        this.enableBlackKey = true;
        return;
      }
      
      if (this.enableBlackKey) keyCode = 'b' + keyCode;

      if (keyCode == this.lastKeyCode) {
        // 连续触发同一个键时，应节流 + 延音
        if (!this.keyLock) {
          this.playNoteByKeyCode(keyCode);
          this.lastKeyCode = keyCode;
          this.keyLock = true;
        }
        
        if (this.keydownTimer) {
          clearTimeout(this.keydownTimer);
          this.keydownTimer = null;
        }
        
        this.keydownTimer = setTimeout(() => {
          this.keyLock = false;
        }, 120);
      } else {
        this.playNoteByKeyCode(keyCode);
        this.lastKeyCode = keyCode;
      }
    });

    document.addEventListener('keyup', (e) => {
      let keyCode = e.keyCode;
      
      // 松开Shift键，则禁用黑色按键
      if (keyCode == ShiftKeyCode) {
        this.enableBlackKey = false;
      }
      
      document.querySelectorAll('.wkey').forEach(key => {
        key.classList.remove('wkey-active');
      });
      
      document.querySelectorAll('.bkey').forEach(key => {
        key.classList.remove('bkey-active');
      });
    });
  }

  // 根据键码获取音符
  getNoteByKeyCode(keyCode) {
    for (let i = 0; i < Notes.Piano.length; i++) {
      if (Notes.Piano[i].keyCode == keyCode) {
        return Notes.Piano[i];
      }
    }
    return null;
  }

  // 根据音名获取音符
  getNoteByName(name = 'C4') {
    for (let i = 0; i < Notes.Piano.length; i++) {
      if (Notes.Piano[i].name == name) {
        return Notes.Piano[i];
      }
    }
    return null;
  }

  // 鼠标点击钢琴键
  clickPianoKey(e, keyCode) {
    const pressedNote = this.getNoteByKeyCode(keyCode);
    if (pressedNote) {
      this.playNote(pressedNote.name);
      
      const keyType = pressedNote.type;
      // 添加按键动画
      if (keyType === 'white') {
        const element = document.querySelector(`[data-keycode="${pressedNote.keyCode}"]`);
        element.classList.add('wkey-active');
        setTimeout(() => {
          element.classList.remove('wkey-active');
        }, 300);
      } else if (keyType === 'black') {
        const element = document.querySelector(`[data-keycode="${pressedNote.keyCode}"]`);
        element.classList.add('bkey-active');
        setTimeout(() => {
          element.classList.remove('bkey-active');
        }, 300);
      }
    }
  }

  // 根据键码播放音符
  async playNoteByKeyCode(keyCode) {
    const note = this.getNoteByKeyCode(keyCode);
    if (!note) return;
    
    // 确保 AudioContext 已启动
    if (!this.audioContextStarted) {
      await this.startAudioContext();
    }
    
    // 确保采样器已加载
    if (!this.audioLoaded) {
      console.log('等待音频加载完成...');
      return;
    }
    
    // 添加按键视觉反馈
    const element = document.querySelector(`[data-keycode="${keyCode}"]`);
    if (element) {
      if (note.type === 'white') {
        element.classList.add('wkey-active');
      } else if (note.type === 'black') {
        element.classList.add('bkey-active');
      }
      
      // 300ms后移除活动状态
      setTimeout(() => {
        element.classList.remove('wkey-active', 'bkey-active');
      }, 300);
    }
    
    this.playNote(note.name);
  }

  // 播放音符
  async playNote(notename = 'C4', duration = '8n') {
    if (!this.synth || !this.audioLoaded) {
      console.log('采样器未就绪');
      return;
    }
    
    try {
      // 设置适当的音量
      this.synth.volume.value = -12;
      
      // 使用 try-catch 确保音频播放不会因错误中断
      await this.synth.triggerAttackRelease(notename, duration);
      console.log(`播放音符: ${notename}`);
    } catch (error) {
      console.error('播放音符时出错:', error);
    }
  }
}

export default Piano; 