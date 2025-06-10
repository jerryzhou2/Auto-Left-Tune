import argparse
import mido
from mido import MidiFile, MidiTrack, MetaMessage
from mido import tick2second, second2tick

def parse_timecode(tc: str) -> float:
    """把 'MM:SS' 形式转换成秒（float）."""
    m, s = tc.split(':')
    return int(m) * 60 + float(s)

def slice_midi(input_path: str, output_path: str, start_tc: str, end_tc: str):
    # 1) 解析时间码
    start_sec = parse_timecode(start_tc)
    end_sec   = parse_timecode(end_tc)
    if end_sec <= start_sec:
        raise ValueError("结束时间必须大于起始时间。")

    # 2) 载入 MIDI，获取 ticks_per_beat
    mid = MidiFile(input_path)
    tpq = mid.ticks_per_beat

    # 3) 找到第一个 set_tempo，若无则使用默认 500000 μs/beat
    tempo = 500000
    for tr in mid.tracks:
        for msg in tr:
            if msg.type == 'set_tempo':
                tempo = msg.tempo
                break
        else:
            continue
        break

    # 4) 计算起止 tick
    start_tick = int(second2tick(start_sec, tpq, tempo))
    end_tick   = int(second2tick(end_sec, tpq, tempo))

    # 5) 对每条 track 做切片
    new_mid = MidiFile()
    new_mid.ticks_per_beat = tpq

    for old_tr in mid.tracks:
        abs_time = 0
        buf = []  # 存 (msg, abs_tick)
        # 累计绝对 tick
        for msg in old_tr:
            abs_time += msg.time
            buf.append((msg, abs_time))

        # 筛选出属于区间内的 msgs
        selected = []
        for msg, abs_tick in buf:
            # 保留所有 meta（比如 track_name） 或者在截取区间内的消息
            if msg.is_meta or (start_tick <= abs_tick < end_tick):
                selected.append((msg, abs_tick))

        # 构造新 track
        new_tr = MidiTrack()
        prev_tick = start_tick
        for msg, abs_tick in selected:
            # 对于 meta，保留原本的 delta
            if msg.is_meta:
                new_tr.append(msg.copy(time=msg.time))
            else:
                # 重新计算 delta = 当前绝对 tick - 上一次绝对 tick
                delta = abs_tick - prev_tick
                new_tr.append(msg.copy(time=delta))
                prev_tick = abs_tick
        new_mid.tracks.append(new_tr)

    # 6) 写出新文件
    new_mid.save(output_path)
    print(f"已生成截取文件：{output_path}")

if __name__ == "__main__":
    '''
    传入起始时刻和终止时刻，如（1：30-2：30），则自动生成一个midi文件，截取原始midi音乐的1：30-2：30
    '''
    timerange = '00:57-01:22'

    try:
        start_tc, end_tc = timerange.split('-')
        print(start_tc, end_tc)
    except ValueError:
        raise SystemExit("range 参数格式错误，应为 MM:SS-MM:SS")

    slice_midi('qingtian.mid', 'output.mid', start_tc, end_tc)