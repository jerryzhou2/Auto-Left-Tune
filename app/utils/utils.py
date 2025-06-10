import mido
import numpy as np
from collections import defaultdict
from mido import MidiFile, MidiTrack, MetaMessage
from mido import tick2second, second2tick


def build_vocab(max_time=1500,quantization=10):
    '''
    第0个是<bos>第1个是<eos>,2是<pad>
    dict键是元组（type，val），值是对应映射的整数（从0开始）
    list是列表，整数索引对应映射的元组
    max_time可能还需斟酌
    词表大小为410
    '''
    dict={}
    num_list=[]
    dict[("bos",0)]=0
    num_list.append(("bos",0))
    dict[("eos",0)]=1
    num_list.append(("eos",0))
    dict[("pad", 0)] = 2
    num_list.append(("pad", 0))
    id=3
    for i in range(max_time//quantization+1):
        t = ("shift_time",i)
        dict[t] = id
        num_list.append(t)
        id+=1
    for i in range(128):
        t = ("note_on",i)
        dict[t] = id
        num_list.append(t)
        id += 1
    for i in range(128):
        t = ("note_off",i)
        dict[t] = id
        num_list.append(t)
        id += 1
    return dict,num_list

def event_to_num(events,mydict):
    list_num=[]
    for t in events:
        list_num.append(mydict[t])
    return list_num
def num_to_event(list_num,dict_list):
    events=[]
    for num in list_num:
        events.append(dict_list[num])
    return events



my_dict, dict_list = build_vocab()

def midi_to_event(track, quantization=10,max_time=1500):
    """
        将 MIDI 文件转换为一个列表，列表中的每个元素为(type,val)
        type为"time_shift"时val表示相对时间间隔（基于quantization量化的）
        type为“note_on”或“note_off”时，val表示note的值
        type还可以是"bos" 或“eos”,"pad"
    """
    events=[]
    events.append(("bos",0))
    shift_time=0
    for msg in track:
        if msg.type in ["note_on","note_off"]:
            shift_time+=msg.time
            shift_time=min(shift_time//quantization,max_time//quantization)
            events.append(("shift_time",shift_time))
            if msg.velocity==0:
                events.append(("note_off", msg.note))
                shift_time = 0
            else:
                events.append((msg.type,msg.note))
                shift_time = 0

        else:
            shift_time+=msg.time
    events.append(("eos",0))
    return events

def event_to_midi(events,quantization=10):
    '''
    末尾加上end_of_track
    '''
    time=0
    track=mido.MidiTrack()
    for event in events:
        msg_type=event[0]
        msg_note=event[1]
        if msg_type=="shift_time":
            time=msg_note
        elif msg_type in ["bos","eos","pad"]:
            if msg_type=="eos":
                track.append(mido.MetaMessage("end_of_track",time=1))
                break
        else:
            if msg_type=="note_on":
                track.append(mido.Message(msg_type,note=msg_note,velocity=64,time=time*quantization))
            else:
                track.append(mido.Message(msg_type, note=msg_note, velocity=0, time=time*quantization))

    return track


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
