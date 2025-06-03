/**
 * MIDI 历史管理器 - 提供类似 VSCode 的撤销/重做功能
 */
const canvas = document.getElementById("pianoRoll");
const ctx = canvas.getContext("2d");
const noteHeight = 18;
const timeScale = 150;
const pitchBase = 21; // A0
const visibleRange = 88;

export class MidiHistoryManager {
    constructor(midi, allNotes, options = {}) {
        // 原始 MIDI 对象
        this.originalMidi = this._cloneMidi(midi || { tracks: [] });
        // 用于动态变化的当前midi对象
        this.currentMidi = this._cloneMidi(this.originalMidi);

        // 历史记录相关
        this.history = [];
        this.pointer = -1;
        this.batchGroup = null;

        // 配置项
        this.maxHistorySize = options.maxHistorySize || 100;
        this.mergeThreshold = options.mergeThreshold || 500;

        // 事件系统
        this.EVENTS = {
            CHANGE: 'change',
            UNDO: 'undo',
            REDO: 'redo',
            BATCH_START: 'batchStart',
            BATCH_END: 'batchEnd'
        };

        this.listeners = {
            [this.EVENTS.CHANGE]: [],
            [this.EVENTS.UNDO]: [],     // 可以高亮显示，触发提示，重绘画布等
            [this.EVENTS.REDO]: [],
            [this.EVENTS.BATCH_START]: [],
            [this.EVENTS.BATCH_END]: []         // 可以统计修改数量等
        };

        // 保存点管理
        this.savePoints = new Set();
        this.shortcuts = {
            undo: ['Ctrl+Z', 'Command+Z'],
            redo: ['Ctrl+Y', 'Command+Y', 'Ctrl+Shift+Z']
        };
    }

    // 深克隆方法，初始化使用
    _cloneMidi(midi) {
        return JSON.parse(JSON.stringify(midi));
    }

    // 触发事件
    _trigger(event, data = {}) {
        const listeners = this.listeners[event];
        console.log("_trigger function invoked");
        console.log(event, listeners.length);
        listeners.forEach(listener => {
            if (typeof listener === 'function') {
                listener(this.currentMidi);
            }
        });
    }

    // 注册事件监听器
    on(event, listener) {
        if (!this.EVENTS[event] || typeof listener !== 'function') {
            return;
        }

        const _event = this.EVENTS[event];       // 小写的事件名

        if (!this.listeners[_event]) {
            this.listeners[_event] = [];
        }

        this.listeners[_event].push(listener);
        return () => {
            this.listeners[_event] = this.listeners[_event].filter(l => l !== listener);
        };
    }

    // 批量操作优化
    beginBatch(label = "批量操作") {
        if (this.batchGroup) {
            this.batchGroup = {
                ...this.batchGroup,     // 将对象展开并合成新的对象
                parent: this.batchGroup,
                label,
                changes: [],
                timestamp: new Date()
            };
        } else {
            this.batchGroup = {
                label,
                changes: [],
                timestamp: new Date()
            };
        }

        this._trigger(this.EVENTS.BATCH_START, { label });
    }

    // 结束批量操作
    endBatch() {
        if (!this.batchGroup) return;

        const batchChanges = this.batchGroup.changes;
        if (batchChanges.length > 0) {
            this._addHistoryEntry({
                type: "batch",
                label: this.batchGroup.label,
                changes: batchChanges,
                timestamp: new Date()
            });
        }

        // 恢复上层批量操作或清空
        this.batchGroup = this.batchGroup.parent;
        this._trigger(this.EVENTS.BATCH_END, { label: this.batchGroup?.label });
    }

    // 添加历史记录 --> pointer用于指向当前所在的历史位置
    _addHistoryEntry(entry) {
        console.log("_addHistoryEntry triggered");

        // 防御性拷贝
        const safeEntry = this._cloneMidi(entry);

        // 清除未来历史
        if (this.pointer < this.history.length - 1) {
            this.history = this.history.slice(0, this.pointer + 1);
        }

        // 智能合并
        if (this._canMerge(safeEntry)) {
            this._mergeLastEntry(safeEntry);
            this._trigger(this.EVENTS.CHANGE, this.getStatus());
            return;
        }

        // 添加新记录
        this.history.push(safeEntry);
        this.pointer = this.history.length - 1;

        print(`In _addHistoryEntry, pointer = ${this.pointer}`);

        while (this.history.length > this.maxHistorySize) {
            this.savePoints.delete(0); // 删除最早保存点
            this.history.shift();
            this.pointer--;
        }

        this._trigger(this.EVENTS.CHANGE, this.getStatus());
    }

    // 检查是否可以合并操作 --> 连续修改同一个音符时，直接合并
    _canMerge(newEntry) {
        if (this.history.length === 0) return false;

        const lastEntry = this.history[this.pointer];
        const isSameType = lastEntry.type === newEntry.type;
        const isRecent = new Date() - lastEntry.timestamp < this.mergeThreshold;

        // 支持修改、添加、删除操作合并
        const supportedTypes = ['modify', 'add', 'delete', 'modifyTime', 'dragNote'];
        return isSameType && supportedTypes.includes(newEntry.type) && isRecent;
    }

    // 合并最后一条记录
    _mergeLastEntry(newEntry) {
        console.log("_mergeLastEntry triggered");

        const lastEntry = this.history[this.pointer];

        // 合并逻辑示例（以修改操作为例）
        if (lastEntry.type === 'modify' && newEntry.type === 'modify') {
            lastEntry.changes = lastEntry.changes.concat(newEntry.changes);
            lastEntry.timestamp = newEntry.timestamp;
            lastEntry.label = `合并操作: ${lastEntry.label} 和 ${newEntry.label}`;
        } else if (lastEntry.type === 'modifyTime' && newEntry.type === 'modifyTime') {
            // 合并时间修改操作
            lastEntry.changes = lastEntry.changes.concat(newEntry.changes);
            lastEntry.timestamp = newEntry.timestamp;
            lastEntry.label = `合并时间修改: ${lastEntry.label}`;
        }
    }

    // 状态获取
    getStatus() {
        return {
            canUndo: this.pointer >= 0,
            canRedo: this.pointer < (this.history.length - 1),
            currentStep: this.pointer,
            totalSteps: this.history.length,
            hasUnsavedChanges: this._hasUnsavedChanges(),
            currentSavePoint: this.savePoints.size ? [...this.savePoints][0] : null,
            history: this.history.map((entry, index) => ({
                ...entry,
                isCurrent: index === this.pointer,
                isSavePoint: this.savePoints.has(index)
            }))
        };
    }

    // 检查是否有未保存的更改
    _hasUnsavedChanges() {
        // 简单比较，实际应用中可能需要更复杂的比较逻辑
        return this.pointer !== -1;
    }

    // 设置保存点
    setSavePoint() {
        if (this.history.length === 0 || this.pointer < 0) return;

        // 最多保留3个保存点
        this.savePoints.add(this.pointer);
        while (this.savePoints.size > 3) {
            this.savePoints.delete(Math.min(...this.savePoints));
        }

        this._trigger(this.EVENTS.CHANGE, this.getStatus());
    }

    // 重置操作
    reset() {
        this.currentMidi = this._cloneMidi(this.originalMidi);
        this.history = [];
        this.pointer = -1;
        this.batchGroup = null;
        this.savePoints.clear();
        this._trigger(this.EVENTS.CHANGE, this.getStatus());
    }

    // 重做操作
    redo() {
        if (this.pointer >= this.history.length - 1 || this.history.length === 0) return false;

        try {
            this.pointer++;
            const entry = this.history[this.pointer];
            this._applyChanges(entry.changes, 'redo');
            this._trigger(this.EVENTS.REDO, entry);
            return true;
        } catch (error) {
            console.error('重做操作失败:', error);
            this.pointer--;
            return false;
        }
    }

    // 撤销操作
    undo() {
        if (this.pointer < 0 || this.history.length === 0) {
            console.warn(`undo操作异常, pointer = ${this.pointer}, history.length = ${this.history.length}`);
            return false;
        }

        try {
            console.log("Undo triggered!");
            const entry = this.history[this.pointer];
            this._applyChanges(entry.changes.reverse(), 'undo');        // reverse确保撤销按照正确顺序回滚
            this.pointer--;

            // 需要传输midi文件来重绘画布
            this._trigger(this.EVENTS.UNDO, this.currentMidi);
            return true;
        } catch (error) {
            console.error('撤销操作失败:', error);
            return false;
        }
    }

    // 应用变更通用方法，direction为调用这个函数的位置对应的标志？
    _applyChanges(changes, direction) {
        changes.forEach(change => {
            switch (change.type) {
                case 'modify':
                    this._applyModify(change, direction);
                    break;
                case 'add':
                    if (direction === 'undo') {
                        this._applyDelete(change, direction);
                    }
                    else if (direction === 'redo') {
                        this._applyAdd(change, direction);
                    }
                    break;
                case 'delete':
                    // undo撤销操作
                    if (direction === 'undo') {
                        this._applyAdd(change, direction);
                    }
                    // redo重新执行被撤销的操作
                    else if (direction === 'redo') {
                        this._applyDelete(change, direction);
                    }
                    break;
                case 'modifyTime':
                    this._applyModifyTime(change, direction);
                    break;
                case 'dragNote':
                    this._applyDragNote(change, direction);
                    break;
                case 'toggleTrackVisibility':
                    this._applyTrackVisibility(change, direction);
                    break;
                // 其他操作类型扩展
            }
        });
        this._trigger(this.EVENTS.CHANGE, this.getStatus());
    }

    // 应用修改操作
    _applyModify(change, direction) {
        const track = this.currentMidi.tracks[change.trackIndex];
        if (!track || !track.notes[change.noteIndex]) return;

        track.notes[change.noteIndex] = (direction === 'undo')
            ? change.originalValue
            : change.newValue;
    }

    // 应用添加操作
    _applyAdd(change, direction) {
        const track = this.currentMidi.tracks[change.trackIndex];
        if (!track) return;

        console.log("Apply add invoked.");

        track.notes.splice(0, 0, change.note);
        track.notes.sort((a, b) => a.time - b.time);
    }

    // 应用删除操作
    _applyDelete(change, direction) {
        const track = this.currentMidi.tracks[change.trackIndex];
        if (!track) return;

        track.notes.splice(change.noteIndex, 1);
    }

    // 应用修改时间操作
    _applyModifyTime(change, direction) {
        const track = this.currentMidi.tracks[change.trackIndex];
        if (!track || !track.notes[change.noteIndex]) return;

        track.notes[change.noteIndex].time = direction === 'undo'
            ? change.originalValue.time
            : change.newValue.time;
    }

    // 应用拖拽音符操作
    _applyDragNote(change, direction) {
        const track = this.currentMidi.tracks[change.trackIndex];
        if (!track) return;

        // 找到对应的音符
        const noteIndex = track.notes.findIndex(n =>
            n.time === change.originalValue.time &&
            n.midi === change.originalValue.midi
        );

        if (noteIndex === -1) return;

        // 恢复或应用新值
        track.notes[noteIndex] = (direction === 'undo')
            ? change.originalValue
            : change.newValue;
    }

    // 应用轨道可见性变更
    _applyTrackVisibility(change, direction) {
        const track = this.currentMidi.tracks[change.trackIndex];
        if (!track) return;

        track._isVisible = direction === 'undo'
            ? change.originalValue
            : change.newValue;
    }

    // 音符修改操作
    modifyNote(trackIndex, noteIndex, newValues) {
        if (!this.currentMidi.tracks[trackIndex] || !this.currentMidi.tracks[trackIndex].notes[noteIndex]) return false;

        const originalValue = this._cloneMidi(this.currentMidi.tracks[trackIndex].notes[noteIndex]);
        const newValue = { ...originalValue, ...newValues };

        // 更新音符值
        this.currentMidi.tracks[trackIndex].notes[noteIndex] = newValue;

        // 记录变更
        const change = {
            type: 'modify',
            trackIndex,
            noteIndex,
            originalValue,
            newValue,
            timestamp: new Date()
        };

        // 添加到历史记录
        if (this.batchGroup) {
            this.batchGroup.changes.push(change);
        } else {
            this._addHistoryEntry({
                type: 'modify',
                label: `修改音符 (轨道 ${trackIndex + 1}, 音符 ${noteIndex + 1})`,
                changes: [change],
                timestamp: new Date()
            });
        }

        return true;
    }

    // 添加音符
    addNote(trackIndex, note, position = -1) {
        if (!this.currentMidi.tracks[trackIndex]) return false;

        const track = this.currentMidi.tracks[trackIndex];

        // 如果未指定位置，则添加到末尾
        if (position === -1) {
            position = track.notes.length;
        }

        // 添加音符
        track.notes.splice(position, 0, note);

        // 记录变更
        const change = {
            type: 'add',
            trackIndex,
            noteIndex: position,
            note: this._cloneMidi(note),
            timestamp: new Date()
        };

        // 添加到历史记录
        if (this.batchGroup) {
            this.batchGroup.changes.push(change);
        } else {
            this._addHistoryEntry({
                type: 'add',
                label: `添加音符 (轨道 ${trackIndex + 1})`,
                changes: [change],
                timestamp: new Date()
            });
        }

        return true;
    }

    // 删除音符
    deleteNote(trackIndex, noteIndex) {
        if (!this.currentMidi.tracks[trackIndex]) {
            console.warn("Track index not exists, or deleted note is undefined!");
            console.warn(`Track index = ${trackIndex}`);
            return false;
        }

        console.log("deleteNote triggered.");

        const track = this.currentMidi.tracks[trackIndex];
        const deletedNote = track.notes[noteIndex];

        // 删除音符
        track.notes.splice(noteIndex, 1);

        // 记录变更
        const change = {
            type: 'delete',
            trackIndex,
            note: deletedNote,
            timestamp: new Date()
        };

        // 添加到历史记录
        if (this.batchGroup) {
            this.batchGroup.changes.push(change);
        } else {
            this._addHistoryEntry({
                type: 'delete',
                label: `删除音符 (轨道 ${trackIndex + 1}, 音符 ${noteIndex + 1})`,
                changes: [change],
                timestamp: new Date()
            });
        }

        return true;
    }

    // 修改音符时间
    modifyNoteTime(trackIndex, noteIndex, newTime) {
        if (!this.currentMidi.tracks[trackIndex] || !this.currentMidi.tracks[trackIndex].notes[noteIndex]) return false;

        const originalValue = this._cloneMidi(this.currentMidi.tracks[trackIndex].notes[noteIndex]);
        const newValue = { ...originalValue, time: newTime };

        // 更新音符时间
        this.currentMidi.tracks[trackIndex].notes[noteIndex].time = newTime;

        // 记录变更
        const change = {
            type: 'modifyTime',
            trackIndex,
            noteIndex,
            originalValue,
            newValue,
            timestamp: new Date()
        };

        // 添加到历史记录
        if (this.batchGroup) {
            this.batchGroup.changes.push(change);
        } else {
            this._addHistoryEntry({
                type: 'modifyTime',
                label: `修改音符时间 (轨道 ${trackIndex + 1}, 音符 ${noteIndex + 1})`,
                changes: [change],
                timestamp: new Date()
            });
        }

        return true;
    }

    // 记录音符拖拽操作
    recordNoteDrag(trackIndex, noteIndex, originalValue, newValue) {
        if (!this.currentMidi.tracks[trackIndex] || !this.currentMidi.tracks[trackIndex].notes[noteIndex]) return false;

        // 记录变更
        const change = {
            type: 'dragNote',
            trackIndex,
            noteIndex,
            originalValue,
            newValue,
            timestamp: new Date()
        };

        // 添加到历史记录
        if (this.batchGroup) {
            this.batchGroup.changes.push(change);
            // 如何修改currentMidi？
            this._applyDragNote();
        } else {
            this._addHistoryEntry({
                type: 'dragNote',
                label: `拖拽音符 (轨道 ${trackIndex + 1}, 音符 ${noteIndex + 1})`,
                changes: [change],
                timestamp: new Date()
            });
        }

        return true;
    }

    // 切换轨道可见性
    toggleTrackVisibility(trackIndex, isVisible) {
        if (!this.currentMidi.tracks[trackIndex]) return false;

        const originalValue = this.currentMidi.tracks[trackIndex]._isVisible ?? true;
        this.currentMidi.tracks[trackIndex]._isVisible = isVisible;

        // 记录变更
        const change = {
            type: 'toggleTrackVisibility',
            trackIndex,
            originalValue,
            newValue: isVisible,
            timestamp: new Date()
        };

        // 添加到历史记录
        if (this.batchGroup) {
            this.batchGroup.changes.push(change);
        } else {
            this._addHistoryEntry({
                type: 'toggleTrackVisibility',
                label: `${isVisible ? '显示' : '隐藏'}轨道 (轨道 ${trackIndex + 1})`,
                changes: [change],
                timestamp: new Date()
            });
        }

        return true;
    }

    // 处理快捷键
    handleShortcut(event) {
        const keyCombination = `${event.ctrlKey || event.metaKey ? 'Ctrl+' : ''}${event.shiftKey ? 'Shift+' : ''}${event.key}`;

        if (this.shortcuts.undo.includes(keyCombination)) {
            event.preventDefault();
            this.undo();
            return true;
        }

        if (this.shortcuts.redo.includes(keyCombination)) {
            event.preventDefault();
            this.redo();
            return true;
        }

        return false;
    }
}    