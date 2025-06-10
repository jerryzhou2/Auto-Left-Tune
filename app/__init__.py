from flask import Flask
from app.config.config import Config
from app.routes.main import main

def create_app():
    app = Flask(__name__,
                static_folder=Config.STATIC_FOLDER,
                template_folder=Config.TEMPLATE_FOLDER)
    
    # 初始化配置
    Config.init_app()
    app.config.from_object(Config)
    
    # 注册蓝图
    app.register_blueprint(main)
    return app 