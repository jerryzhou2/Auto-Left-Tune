#!/bin/bash

# AutoLeftPiano Docker 构建和运行脚本

set -e  # 遇到错误立即退出

echo "🎹 AutoLeftPiano Docker 部署脚本"
echo "================================"

# 创建必要的目录
echo "📁 创建数据目录..."
mkdir -p data/uploads
mkdir -p data/outputs  
mkdir -p data/models

# 设置权限
chmod 755 data/uploads
chmod 755 data/outputs
chmod 755 data/models

echo "✅ 数据目录创建完成"

# 构建Docker镜像
echo "🔨 开始构建Docker镜像..."
docker build -t autoleftpiano:latest .

if [ $? -eq 0 ]; then
    echo "✅ Docker镜像构建成功！"
else
    echo "❌ Docker镜像构建失败！"
    exit 1
fi

# 询问是否立即运行
echo ""
read -p "🚀 是否立即启动容器？(y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🏃 启动容器..."
    
    # 停止并删除现有容器（如果存在）
    docker stop autoleftpiano-app 2>/dev/null || true
    docker rm autoleftpiano-app 2>/dev/null || true
    
    # 使用docker-compose启动
    docker-compose up -d
    
    echo "✅ 容器启动完成！"
    echo "📱 应用地址: http://localhost:5000"
    echo "📋 查看日志: docker-compose logs -f"
    echo "🛑 停止服务: docker-compose down"
else
    echo "💡 稍后可以使用以下命令启动："
    echo "   docker-compose up -d"
fi

echo ""
echo "🎉 部署完成！" 