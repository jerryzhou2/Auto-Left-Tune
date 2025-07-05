#!/bin/bash

# AutoLeftPiano 环境设置脚本
# 此脚本将创建conda环境、安装依赖并运行setup.py

echo "=== AutoLeftPiano 环境设置脚本 ==="
echo "开始设置环境..."

# 检查conda是否已安装
if ! command -v conda &> /dev/null; then
    echo "错误: 未找到conda命令。请先安装Anaconda或Miniconda。"
    exit 1
fi

# 检查是否已存在同名环境
if conda env list | grep -q "autolefttune"; then
    echo "警告: 环境 'autolefttune' 已存在。"
    read -p "是否删除现有环境并重新创建? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "删除现有环境..."
        conda env remove -n autolefttune -y
    else
        echo "使用现有环境..."
    fi
fi

# 创建新的conda环境
echo "创建conda环境 'autolefttune'..."
conda create -n autolefttune python=3.10 -y

if [ $? -ne 0 ]; then
    echo "错误: 创建conda环境失败。"
    exit 1
fi

# 激活环境
echo "激活conda环境..."
source $(conda info --base)/etc/profile.d/conda.sh
conda activate autolefttune

if [ $? -ne 0 ]; then
    echo "错误: 激活conda环境失败。"
    exit 1
fi

# 检查requirements.txt是否存在
if [ ! -f "requirements.txt" ]; then
    echo "错误: 未找到requirements.txt文件。"
    exit 1
fi

# 安装依赖
echo "安装Python依赖包..."
pip install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "错误: 安装依赖包失败。"
    exit 1
fi

# 检查setup.py是否存在
if [ ! -f "setup.py" ]; then
    echo "错误: 未找到setup.py文件。"
    exit 1
fi

# 运行setup.py
echo "运行setup.py..."
python setup.py

if [ $? -ne 0 ]; then
    echo "错误: 运行setup.py失败。"
    exit 1
fi

echo "=== 环境设置完成 ==="
echo "环境名称: autolefttune"
echo "使用方法: conda activate autolefttune"
echo "运行应用: python run.py" 