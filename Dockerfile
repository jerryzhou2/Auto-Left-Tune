# 使用Ubuntu 22.04作为基础镜像，默认包含Python 3.10
FROM ubuntu:22.04

# 设置环境变量
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# 安装系统依赖和Python 3.10
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3.10-dev \
    python3-pip \
    python3.10-venv \
    # MuseScore和Qt6相关依赖
    libasound2 \
    libsndfile1 \
    libqt6core6 \
    libqt6gui6 \
    libqt6widgets6 \
    libqt6network6 \
    libqt6svg6 \
    libqt6printsupport6 \
    libqt6qml6 \
    libqt6quick6 \
    libqt6dbus6 \
    libqt6core5compat6 \
    libqt6networkauth6 \
    libqt6websockets6 \
    libqt6opengl6 \
    libqt6statemachine6 \
    libqt6qmlmodels6 \
    # 音频库
    libflac8 \
    libvorbis0a \
    libvorbisenc2 \
    libopus0 \
    libogg0 \
    # 图形和字体库
    libgl1-mesa-glx \
    libegl1-mesa \
    libxkbcommon0 \
    libfontconfig1 \
    libfreetype6 \
    libx11-6 \
    libxcb1 \
    # ICU库（国际化组件）
    libicu70 \
    # 其他系统依赖
    libglib2.0-0 \
    libdbus-1-3 \
    libexpat1 \
    libpng16-16 \
    libbz2-1.0 \
    liblzma5 \
    libzstd1 \
    liblz4-1 \
    libgcrypt20 \
    libgpg-error0 \
    libbsd0 \
    libmd0 \
    libsystemd0 \
    libcap2 \
    libkrb5-3 \
    libgssapi-krb5-2 \
    libk5crypto3 \
    libkrb5support0 \
    libkeyutils1 \
    libcom-err2 \
    libbrotlidec1 \
    libbrotlicommon1 \
    libpcre2-8-0 \
    # X11相关库
    libxau6 \
    libxdmcp6 \
    # 清理apt缓存
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 确保python3指向python3.10
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.10 1

# 创建工作目录
WORKDIR /app

# 复制Python依赖文件
COPY requirements.txt .

# 升级pip并安装Python依赖
RUN python3 -m pip install --upgrade pip
RUN python3 -m pip install --no-cache-dir -r requirements.txt

# 安装gunicorn
RUN python3 -m pip install gunicorn==21.2.0

# 复制应用代码
COPY app/ ./app/
COPY run.py .

# 确保MuseScore可执行文件有执行权限
RUN chmod +x /app/app/utils/MuseScoreLinux/bin/mscore4portable

# 创建必要的目录
RUN mkdir -p /app/app/files/uploads /app/app/files/outputs /app/app/utils/model

# 设置目录权限
RUN chmod -R 755 /app/app/files

# 暴露端口
EXPOSE 5000

# 健康检查
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python3 -c "import requests; requests.get('http://localhost:5000/')" || exit 1

# 使用gunicorn启动应用
# --workers 4: 4个工作进程
# --timeout 300: 请求超时时间300秒（因为AI推理可能需要较长时间）
# --max-requests 1000: 每个worker处理1000个请求后重启
# --preload: 预加载应用代码
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "10", "--timeout", "300", "--max-requests", "1000", "--preload", "run:app"] 