// 自定义哈希表
// 用于存储所有音符对象，在对音符进行操作时使用
export let allNotes = new Map();
export let noteInTrackMap = new Map();
// 将track.notes映射到对应坐标
export let noteToIndexMap = new Map();
// 将鼠标坐标二维映射到音符块
export let spatialIndex = new Map();  // pitch -> Map<xBlock, Set<note>>