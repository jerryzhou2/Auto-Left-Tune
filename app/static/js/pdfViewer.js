// PDF查看器模块
class PdfViewer {
    constructor() {
        // 初始化PDF.js - 使用CDN
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        // DOM元素
        this.pdfViewer = document.getElementById('pdf-viewer');
        this.pdfContainer = document.getElementById('pdf-container');
        
        // 当前加载的PDF文档
        this.currentPdfDoc = null;
        
        // 当前是否有加载中的任务
        this.isLoading = false;
        
        // 存储渲染任务，以便在清理时取消
        this.renderTasks = [];
    }
    
    // 清理所有资源的方法
    async clearResources() {
        console.log('正在清理PDF资源...');
        
        try {
            // 停止所有可能的渲染任务
            if (this.renderTasks) {
                this.renderTasks.forEach(task => {
                    if (task && typeof task.cancel === 'function') {
                        try {
                            task.cancel();
                        } catch (e) {
                            console.error('取消渲染任务时出错:', e);
                        }
                    }
                });
                this.renderTasks = [];
            }
            
            // 清空DOM元素
            if (this.pdfViewer) {
                // 首先移除所有事件监听器
                const clonedViewer = this.pdfViewer.cloneNode(false);
                if (this.pdfViewer.parentNode) {
                    this.pdfViewer.parentNode.replaceChild(clonedViewer, this.pdfViewer);
                    this.pdfViewer = clonedViewer;
                }
                
                // 彻底清空内容
                this.pdfViewer.innerHTML = '';
            }
            
            // 释放当前PDF文档资源
            if (this.currentPdfDoc) {
                try {
                    await this.currentPdfDoc.destroy();
                    console.log('已释放PDF文档资源');
                } catch (error) {
                    console.error('释放PDF文档资源时出错:', error);
                }
                this.currentPdfDoc = null;
            }
            
            // 执行垃圾回收（建议）
            if (window.gc) {
                try {
                    window.gc();
                } catch (e) {
                    // 非标准API，可能不可用，忽略错误
                }
            }
            
            console.log('PDF资源清理完成');
        } catch (e) {
            console.error('清理PDF资源时发生错误:', e);
        }
    }
    
    // 从URL加载PDF
    async loadPdfFromUrl(url) {
        // 如果当前有加载中的任务，先中止
        if (this.isLoading) {
            console.log('已有PDF加载任务，正在中止...');
            await this.clearResources();
        }
        
        this.isLoading = true;
        
        try {
            console.log('开始加载新PDF:', url);
            
            // 确保PDF查看器DOM元素存在
            if (!this.pdfViewer || !this.pdfContainer) {
                console.error('PDF查看器DOM元素不存在');
                this.isLoading = false;
                return false;
            }
            
            // 清理所有现有资源
            await this.clearResources();
            
            // 创建加载指示文本
            const loadingText = document.createElement('p');
            loadingText.textContent = '正在加载PDF...';
            loadingText.className = 'pdf-loading-text';
            this.pdfViewer.appendChild(loadingText);
            
            // 加载新PDF文档
            console.log('初始化PDF加载任务...');
            const loadingTask = pdfjsLib.getDocument({ url });
            
            // 设置加载任务的取消处理
            loadingTask.onProgress = (progress) => {
                const percent = Math.round(progress.loaded / progress.total * 100);
                loadingText.textContent = `正在加载PDF... ${percent}%`;
            };
            
            console.log('等待PDF文档加载...');
            this.currentPdfDoc = await loadingTask.promise;
            
            // 移除加载指示文本
            if (loadingText.parentNode === this.pdfViewer) {
                this.pdfViewer.removeChild(loadingText);
            }
            
            // 显示加载的页面数量
            console.log(`PDF加载成功，共 ${this.currentPdfDoc.numPages} 页`);
            
            // 渲染所有页面
            for (let pageNum = 1; pageNum <= this.currentPdfDoc.numPages; pageNum++) {
                await this.renderPage(pageNum);
            }
            
            this.isLoading = false;
            return true;
        } catch (error) {
            console.error('加载PDF时出错:', error);
            
            // 清空查看器并显示错误信息
            await this.clearResources();
            
            if (this.pdfViewer) {
                const errorElement = document.createElement('p');
                errorElement.className = 'error';
                errorElement.textContent = `PDF加载失败: ${error.message}`;
                this.pdfViewer.appendChild(errorElement);
            }
            
            this.isLoading = false;
            return false;
        }
    }
    
    // 渲染单个PDF页面
    async renderPage(pageNumber) {
        try {
            console.log(`开始渲染页面 ${pageNumber}`);
            
            // 获取页面
            const page = await this.currentPdfDoc.getPage(pageNumber);
            
            // 计算缩放比例，使页面适合容器宽度
            const containerWidth = this.pdfContainer.clientWidth - 40; // 减去padding
            const originalViewport = page.getViewport({ scale: 1 });
            const scale = containerWidth / originalViewport.width;
            const viewport = page.getViewport({ scale });
            
            // 创建页面的canvas元素
            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-page';
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.setAttribute('data-page-number', pageNumber);
            
            // 检查PDF查看器是否还存在
            if (!this.pdfViewer || !this.pdfViewer.parentNode) {
                console.error(`渲染页面 ${pageNumber} 时PDF查看器已不存在`);
                return;
            }
            
            // 添加到查看器
            this.pdfViewer.appendChild(canvas);
            
            // 渲染页面到canvas
            const renderContext = {
                canvasContext: canvas.getContext('2d'),
                viewport: viewport
            };
            
            // 创建渲染任务并存储，方便后续取消
            const renderTask = page.render(renderContext);
            this.renderTasks.push(renderTask);
            
            // 等待渲染完成
            await renderTask.promise;
            
            // 渲染完成后从任务列表中移除
            const taskIndex = this.renderTasks.indexOf(renderTask);
            if (taskIndex !== -1) {
                this.renderTasks.splice(taskIndex, 1);
            }
            
            console.log(`页面 ${pageNumber} 渲染完成`);
        } catch (error) {
            console.error(`渲染页面 ${pageNumber} 时出错:`, error);
            
            // 添加错误标记
            if (this.pdfViewer && this.pdfViewer.parentNode) {
                const errorMsg = document.createElement('p');
                errorMsg.className = 'pdf-page-error';
                errorMsg.textContent = `页面 ${pageNumber} 加载失败: ${error.message}`;
                this.pdfViewer.appendChild(errorMsg);
            }
        }
    }
}

// 创建PDF查看器实例
const pdfViewer = new PdfViewer();

// 导出PDF查看器
export default pdfViewer; 