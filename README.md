# AutoLeftPiano



## 使用方法

1. 启动应用：
```bash
python run.py
```

2. 在浏览器中访问 `http://localhost:5000`

3. 使用钢琴键盘：
   - 点击钢琴键或使用键盘按键
   - 观察美丽的卷帘窗动画效果
   - 按住Shift键可以演奏黑键

4. 记录和生成MIDI：
   - 点击"开始记录"按钮
   - 演奏钢琴
   - 点击"结束记录"生成MIDI文件

## 技术实现

- **前端**: HTML5, CSS3, JavaScript (ES6 Modules)
- **后端**: Flask (Python)
- **音频**: Tone.js
- **动画**: CSS3 Animations with cubic-bezier easing
- **响应式**: CSS Media Queries

## 钢琴卷帘窗技术细节

卷帘窗效果通过以下技术实现：
- CSS3 渐变背景和阴影效果
- transform 和 opacity 动画
- 模糊滤镜过渡
- JavaScript 动态位置计算
- 事件驱动的动画触发

## 安装依赖

```bash
pip install -r requirements.txt
```

## 项目结构

```
AutoLeftPiano/
├── app/
│   ├── static/
│   │   ├── css/
│   │   │   └── piano.css      # 钢琴和卷帘窗样式
│   │   └── js/
│   │       └── piano.js       # 钢琴功能和动画逻辑
│   └── templates/
│       └── index.html         # 主页模板
└── run.py                     # 应用启动文件
```

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
