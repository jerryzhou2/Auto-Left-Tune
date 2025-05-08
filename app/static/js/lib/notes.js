const noteBaseUrl = '/static/notes/'

export const NotesMap = [
  { name: 'C2', file: 'a49.mp3' },
  { name: 'D2', file: 'a50.mp3' },
  { name: 'E2', file: 'a51.mp3' },
  { name: 'F2', file: 'a52.mp3' },
  { name: 'G2', file: 'a53.mp3' },
  { name: 'A2', file: 'a54.mp3' },
  { name: 'B2', file: 'a55.mp3' },
  { name: 'C3', file: 'a56.mp3' },
  { name: 'D3', file: 'a57.mp3' },
  { name: 'E3', file: 'a48.mp3' },
  { name: 'F3', file: 'a81.mp3' },
  { name: 'G3', file: 'a87.mp3' },
  { name: 'A3', file: 'a69.mp3' },
  { name: 'B3', file: 'a82.mp3' },
  { name: 'C4', file: 'a84.mp3' },
  { name: 'D4', file: 'a89.mp3' },
  { name: 'E4', file: 'a85.mp3' },
  { name: 'F4', file: 'a73.mp3' },
  { name: 'G4', file: 'a79.mp3' },
  { name: 'A4', file: 'a80.mp3' },
  { name: 'B4', file: 'a65.mp3' },
  { name: 'C5', file: 'a83.mp3' },
  { name: 'D5', file: 'a68.mp3' },
  { name: 'E5', file: 'a70.mp3' },
  { name: 'F5', file: 'a71.mp3' },
  { name: 'G5', file: 'a72.mp3' },
  { name: 'A5', file: 'a74.mp3' },
  { name: 'B5', file: 'a75.mp3' },
  { name: 'C6', file: 'a76.mp3' },
  { name: 'D6', file: 'a90.mp3' },
  { name: 'E6', file: 'a88.mp3' },
  { name: 'F6', file: 'a67.mp3' },
  { name: 'G6', file: 'a86.mp3' },
  { name: 'A6', file: 'a66.mp3' },
  { name: 'B6', file: 'a78.mp3' },
  { name: 'C7', file: 'a77.mp3' },

  { name: 'C#2', file: 'b49.mp3' },
  { name: 'D#2', file: 'b50.mp3' },
  { name: 'F#2', file: 'b52.mp3' },
  { name: 'G#2', file: 'b53.mp3' },
  { name: 'A#2', file: 'b54.mp3' },
  { name: 'C#3', file: 'b56.mp3' },
  { name: 'D#3', file: 'b57.mp3' },
  { name: 'F#3', file: 'b81.mp3' },
  { name: 'G#3', file: 'b87.mp3' },
  { name: 'A#3', file: 'b69.mp3' },
  { name: 'C#4', file: 'b84.mp3' },
  { name: 'D#4', file: 'b89.mp3' },
  { name: 'F#4', file: 'b73.mp3' },
  { name: 'G#4', file: 'b79.mp3' },
  { name: 'A#4', file: 'b80.mp3' },
  { name: 'C#5', file: 'b83.mp3' },
  { name: 'D#5', file: 'b68.mp3' },
  { name: 'F#5', file: 'b71.mp3' },
  { name: 'G#5', file: 'b72.mp3' },
  { name: 'A#5', file: 'b74.mp3' },
  { name: 'C#6', file: 'b76.mp3' },
  { name: 'D#6', file: 'b90.mp3' },
  { name: 'F#6', file: 'b67.mp3' },
  { name: 'G#6', file: 'b86.mp3' },
  { name: 'A#6', file: 'b66.mp3' }
]

// 通过音符名称查找文件
export function mapFile(name) {
  let file = ''
  NotesMap.forEach(note => {
    if (note.name === name) {
      file = note.file
    }
  })
  return file
} 