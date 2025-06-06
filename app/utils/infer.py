import torch
import mido
# 改为相对导入
try:
    # 当作为模块导入时使用相对导入
    from .music_transformer import Seq2SeqTransformer
    from .utils import midi_to_event, event_to_midi ,event_to_num, num_to_event, build_vocab
    from ..config.config import Config
except ImportError:
    # 当直接运行时使用直接导入
    from music_transformer import Seq2SeqTransformer
    from utils import midi_to_event, event_to_midi ,event_to_num, num_to_event, build_vocab
    from ..config.config import Config
import os

my_dict, dict_list = build_vocab()

# ========== Softmax Temperature Sampling ==========
def temperature_sample(logits, temperature=1.0):
    logits = logits / temperature
    probs = torch.softmax(logits, dim=-1)
    token = torch.multinomial(probs, num_samples=1)
    return token.item()

# ========== 逐 token 采样生成 ==========
@torch.no_grad()
def sample_generate(model, src, bos_id, eos_id, pad_id, max_len=8000, temperature=1.0):
    model.eval()
    memory = model.encoder(model.src_pos_encoder(model.src_embedding(src)))
    ys = torch.tensor([[bos_id]], dtype=torch.long).to(src.device)
    generated = []

    for _ in range(max_len):
        print(_)
        tgt_emb = model.tgt_pos_encoder(model.tgt_embedding(ys))
        out = tgt_emb
        for layer in model.decoder_layers:
            out = layer(out, memory, tgt_mask=None, memory_mask=None,
                        tgt_key_padding_mask=(ys == pad_id), memory_key_padding_mask=(src == pad_id))
        logits = model.output_layer(out[:, -1])  # 最后一个位置的预测
        next_token = temperature_sample(logits.squeeze(0), temperature=temperature)

        ys = torch.cat([ys, torch.tensor([[next_token]], device=src.device)], dim=1)
        if next_token == eos_id:
            break
        generated.append(next_token)

    return generated
@torch.no_grad()
def infer(input_path,output_path,model_name='music_trans_5_20.pt',vocab_size=410,bos_id= 0,eos_id = 1,pad_id = 2,max_len = 4000,temperature = 0.9):
    global my_dict
    global dict_list
    try:
        model_path = os.path.join(Config.MODEL_PATH,model_name)
        print(f"正在加载模型: {model_path}")
        
        # 检查模型文件是否存在
        if not os.path.exists(model_path):
            print(f"错误: 模型文件不存在 - {model_path}")
            return False
            
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"使用设备: {device}")
        
        # ========== 1. 加载模型 ==========
        model = Seq2SeqTransformer(vocab_size=vocab_size, max_len=max_len).to(device)
        
        try:
            checkpoint = torch.load(model_path, map_location=device)
            model.load_state_dict(checkpoint['model_state_dict'])
            model.eval()
            print("模型加载成功")
        except Exception as e:
            print(f"模型加载失败: {str(e)}")
            return False

        # ========== 2. 加载右手 MIDI ==========
        try:
            midi_file = mido.MidiFile(input_path)
            if len(midi_file.tracks) == 0:
                print("错误: MIDI文件没有音轨")
                return False
                
            right_events = midi_to_event(midi_file.tracks[0])
            right_tokens = event_to_num(right_events, mydict=my_dict)[:max_len]
            
            if len(right_tokens) == 0:
                print("错误: 无法从MIDI文件提取有效的音符事件")
                return False
                
            src_tensor = torch.tensor(right_tokens, dtype=torch.long).unsqueeze(0).to(device)
            print(f"MIDI文件加载成功，提取到 {len(right_tokens)} 个事件")
        except Exception as e:
            print(f"MIDI文件处理失败: {str(e)}")
            return False

        # ========== 3. 生成左手 ==========
        try:
            generated_tokens = sample_generate(model, src_tensor, bos_id=bos_id, eos_id=eos_id,
                                            pad_id=pad_id, max_len=max_len, temperature=temperature)
            print(f"左手生成成功，生成了 {len(generated_tokens)} 个音符事件")
        except Exception as e:
            print(f"左手生成失败: {str(e)}")
            return False

        # ========== 4. 转换为 MIDI ==========
        try:
            left_events = num_to_event(generated_tokens, dict_list=dict_list)
            left_track = event_to_midi(left_events)
        except Exception as e:
            print(f"左手MIDI转换失败: {str(e)}")
            return False

        # ========== 5. 合并并保存 ==========
        try:
            output_midi = mido.MidiFile()
            output_midi.ticks_per_beat = midi_file.ticks_per_beat
            output_midi.tracks.append(event_to_midi(right_events))  # 右手
            output_midi.tracks.append(left_track)                   # 左手
            output_midi.save(output_path)
            
            # 验证输出文件是否成功创建
            if not os.path.exists(output_path):
                print("错误: 输出文件创建失败")
                return False
                
            print(f"✅ 采样生成完成：{output_path}")
            return True
        except Exception as e:
            print(f"MIDI文件保存失败: {str(e)}")
            return False
            
    except Exception as e:
        print(f"推理过程发生未预期的错误: {str(e)}")
        return False
if __name__=='__main__':
    pass
