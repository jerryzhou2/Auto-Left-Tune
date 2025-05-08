## Quick Start
pip install -r requirements.txt

将app/utils/transform.py中的
```
def find_musescore_executable():
    # 在WSL中使用Linux路径格式
    return "/mnt/c/Program Files/MuseScore 4/bin/MuseScore4.exe"
...
if __name__=="__main__":
    musescore_exe = r"C:\Program Files\MuseScore 4\bin\MuseScore4.exe"
```
改为你本地电脑的MuseScore Studio 4.exe所在位置

python3 run.py

## 项目介绍
目前实现了传入midi文件→后端处理后，进行播放、导出钢琴谱pdf，以及下载的功能
### 各个文件夹介绍
config: 配置文件，里面存了一些路径的信息

static: 静态资源文件夹，包含CSS、JavaScript、音频样本和音符资源

templates: HTML模板文件夹，用于前端页面渲染

files: 文件存储目录，包含uploads(上传的MIDI文件)和outputs(生成的输出文件)子目录

utils: 工具函数目录，包含transform.py用于MIDI文件处理和PDF生成

models: 数据模型目录，包含session.py用于管理用户会话数据

routes: 路由处理目录，包含main.py定义了所有HTTP请求处理逻辑
