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
              <div class="piano-tip">+ 代表 shift 键</div>
            </div>
            <div class="piano-key-wrap" id="pianoKeyWrap">
              <!-- 白键和黑键将通过JavaScript动态生成 -->
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
    this.triggerKeyEffect = this.triggerKeyEffect.bind(this);
    this.triggerKeyByName = this.triggerKeyByName.bind(this);
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

    // 监听窗口大小变化，重新计算键盘尺寸
    window.addEventListener('resize', this.computeEleSize);
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
    const pianoWrap = document.getElementById('pianoWrap');
    const keysContainer = document.getElementById('piano-keys-container');
    
    // 设置钢琴键盘区域高度为固定高度200px
    pianoKeyWrap.style.height = '200px';
    keysContainer.style.height = '200px';
    
    // 设置黑键高度为固定高度的65%
    const bkeys = document.querySelectorAll('.bkey');
    bkeys.forEach(key => {
      key.style.height = '130px'; // 200px的65%
    });
    
    // 动态调整文字大小
    if (pianoWrap.offsetWidth < 800) {
      document.querySelectorAll('.wkey .keyname').forEach(elem => {
        elem.style.fontSize = '8px';
      });
      document.querySelectorAll('.wkey .notename').forEach(elem => {
        elem.style.fontSize = '7px';
      });
      document.querySelectorAll('.bkey .keyname').forEach(elem => {
        elem.style.fontSize = '6px';
      });
    }
  }

  // 渲染钢琴键 - 标准钢琴布局：白黑白黑白白黑白黑白黑白
  renderPianoKeys() {
    const pianoKeyWrap = document.getElementById('pianoKeyWrap');
    
    // 添加一个内部容器，用于放置钢琴键
    pianoKeyWrap.innerHTML = '<div id="piano-keys-container"></div>';
    const keysContainer = document.getElementById('piano-keys-container');
    
    let html = '';

    // 先绘制所有白键
    const whiteKeys = Notes.Piano.filter(note => note.type === 'white');
    html += whiteKeys.map(note => `
      <div class="piano-key wkey" data-keycode="${note.keyCode}" data-name="${note.name}">
        <div class="keytip">
          <div class="keyname" ${!this.showKeyName ? 'style="display:none"' : ''}>${note.key}</div>
          <div class="notename" ${!this.showNoteName ? 'style="display:none"' : ''}>${note.name}</div>
        </div>
      </div>
    `).join('');

    // 再绘制黑键，但排除C7组最后三个黑键（F#7, G#7, A#7）
    const blackKeys = Notes.Piano.filter(note => 
      note.type === 'black' && 
      !['F#7', 'G#7', 'A#7'].includes(note.name)
    );
    
    html += blackKeys.map(note => `
      <div class="piano-key bkey" data-keycode="${note.keyCode}" data-name="${note.name}">
        <div class="keytip">
          <div class="keyname" ${!this.showKeyName ? 'style="display:none"' : ''}>${note.key}</div>
        </div>
      </div>
    `).join('');

    // 添加到容器DOM
    keysContainer.innerHTML = html;

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

    // 验证黑白键布局
    console.log("已渲染键盘布局: 白键数量 =", whiteKeys.length, "黑键数量 =", blackKeys.length);
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
      
      // 释放Shift键，则禁用黑色按键
      if (keyCode == ShiftKeyCode) {
        this.enableBlackKey = false;
        return;
      }
      
      if (keyCode == this.lastKeyCode) {
        this.lastKeyCode = '';
      }
    });
  }

  // 通过键码获取音符对象
  getNoteByKeyCode(keyCode) {
    return Notes.Piano.find(note => note.keyCode == keyCode) || null;
  }

  // 通过音名获取音符对象
  getNoteByName(name = 'C4') {
    return Notes.Piano.find(note => note.name == name) || null;
  }

  // 触发按键视觉效果
  triggerKeyEffect(key, duration = 300) {
    if (!key) return;
    
    const keyClass = key.classList.contains('wkey') ? 'wkey' : 'bkey';
    key.classList.add(keyClass + '-active');
    
    // 指定时间后移除active样式
    setTimeout(() => {
      key.classList.remove(keyClass + '-active');
    }, duration);
  }

  // 点击钢琴键处理
  clickPianoKey(e, keyCode) {
    let target = e.target;
    // 确保我们点击的是钢琴键本身
    while (target && !target.classList.contains('piano-key')) {
      target = target.parentElement;
    }
    
    if (!target) return;
    
    // 添加视觉效果
    this.triggerKeyEffect(target);
    
    // 播放声音
    this.playNoteByKeyCode(keyCode);
  }

  // 通过键码播放音符
  async playNoteByKeyCode(keyCode) {
    const note = this.getNoteByKeyCode(keyCode);
    if (!note) return;
    
    // 添加视觉效果
    const key = document.querySelector(`.piano-key[data-keycode="${keyCode}"]`);
    this.triggerKeyEffect(key);
    
    // 播放音符
    try {
      await this.playNote(note.name);
    } catch (err) {
      console.error('播放音符失败:', err);
    }
  }

  // 根据音符名称触发键盘效果
  triggerKeyByName(noteName, duration = 300) {
    if (!noteName) return;
    
    const key = document.querySelector(`.piano-key[data-name="${noteName}"]`);
    this.triggerKeyEffect(key, duration);
  }

  // 播放音符
  async playNote(notename = 'C4', duration = '8n') {
    if (!this.audioLoaded || !this.synth) {
      console.warn('音频尚未加载完成');
      return;
    }
    
    try {
      // 确保AudioContext已启动
      await this.startAudioContext();
      
      // 触发键盘视觉效果
      this.triggerKeyByName(notename);
      
      // 播放音符
      this.synth.triggerAttackRelease(notename, duration);
    } catch(e) {
      console.error('播放音符错误:', e);
    }
  }
}

export default Piano; 