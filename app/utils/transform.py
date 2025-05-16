import subprocess
import os
import platform
from app.config.config import Config
def find_musescore_executable():
    if platform.system() == "Windows":
        return Config.MUSESCORE_PATH_WINDOWS
    else:
        return Config.MUSESCORE_PATH_LINUX

def split_midi(input_file, output_file, musescore_path=None):
    # 1) 检查输入文件是否存在
    if not os.path.isfile(input_file):
        print(f"❌ 输入文件不存在: {input_file}")
        return

    # 2) 确定 MuseScore CLI 路径
    mscore =find_musescore_executable()

    # 3) 构造命令列表，交给 subprocess.run 自动处理路径
    cmd = [
        mscore,
        "-o", output_file,
        input_file
    ]

    try:
        print(f"▶ 正在运行：{cmd}")
        # 不用 shell=True，直接 list 形式更可靠
        subprocess.run(cmd, shell=False, check=True)
        print(f"✅ 导出成功：{output_file}")
        return True
    except FileNotFoundError:
        print(f"❌ 找不到 MuseScore 可执行文件: {mscore}")
        return False
    except subprocess.CalledProcessError as e:
        print(f"❌ MuseScore 导出失败，错误码 {e.returncode}")
        return False

def export_pdf(input_file, output_file, musescore_path=None):
    """
    使用MuseScore将MIDI文件导出为PDF格式
    
    参数:
        input_file (str): 输入MIDI文件路径
        output_file (str): 输出PDF文件路径
        musescore_path (str, 可选): MuseScore可执行文件路径
    
    返回:
        bool: 成功返回True，失败返回False
    """
    # 1) 检查输入文件是否存在
    if not os.path.isfile(input_file):
        print(f"❌ 输入文件不存在: {input_file}")
        return False

    # 2) 确定 MuseScore CLI 路径
    mscore = musescore_path or find_musescore_executable()

    # 3) 构造命令列表
    cmd = [
        mscore,
        "-o", output_file,
        input_file
    ]

    try:
        print(f"▶ 正在导出PDF：{cmd}")
        subprocess.run(cmd, shell=False, check=True)
        print(f"✅ PDF导出成功：{output_file}")
        return True
    except FileNotFoundError:
        print(f"❌ 找不到 MuseScore 可执行文件: {mscore}")
        return False
    except subprocess.CalledProcessError as e:
        print(f"❌ MuseScore PDF导出失败，错误码 {e.returncode}")
        return False
