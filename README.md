## Quick Start
### Platform
Windows 10+

ubuntu 20.04+
### Start APP
pip install -r requirements.txt

python3 run.py
## 项目介绍
### 各个文件夹介绍
config: 配置文件，里面存了一些路径的信息

static: 静态资源文件夹，包含CSS、JavaScript、音频样本和音符资源

templates: HTML模板文件夹，用于前端页面渲染

files: 文件存储目录，包含uploads(上传的MIDI文件)和outputs(生成的输出文件)子目录

utils: 工具函数目录，包含transform.py用于MIDI文件处理和PDF生成

models: 数据模型目录，包含session.py用于管理用户会话数据

routes: 路由处理目录，包含main.py定义了所有HTTP请求处理逻辑
