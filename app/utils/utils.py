import mido
import numpy as np
from collections import defaultdict



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