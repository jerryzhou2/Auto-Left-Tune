import os

class Config:
    # 基础目录
    BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    APP_DIR = os.path.join(BASE_DIR, 'app')
    
    # 文件上传配置
    UPLOAD_FOLDER = os.path.join(APP_DIR, 'files/uploads')
    OUTPUT_FOLDER = os.path.join(APP_DIR, 'files/outputs')
    SESSION_FILE = os.path.join(APP_DIR, 'files/session_data.json')
    
    # 静态文件和模板配置
    STATIC_FOLDER = os.path.join(APP_DIR, 'static')
    TEMPLATE_FOLDER = os.path.join(APP_DIR, 'templates')
    MUSESCORE_PATH_WINDOWS = os.path.join(APP_DIR, 'utils/MuseScoreWindows/bin/MuseScore4.exe')
    MUSESCORE_PATH_LINUX = os.path.join(APP_DIR, 'utils/MuseScoreLinux/bin/mscore4portable')

    MODEL_PATH=os.path.join(APP_DIR, 'utils','model')
    
    # MIDI播放器音量配置
    LEFT_HAND_VOLUME_RATIO = 0.8  # 左手音量相对于右手的比例 (80%)
    
    # 确保必要的目录存在
    @staticmethod
    def init_app():
        os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
        os.makedirs(Config.OUTPUT_FOLDER, exist_ok=True) 