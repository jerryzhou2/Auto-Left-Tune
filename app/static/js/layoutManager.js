// 布局管理器 - 处理动态布局调整
class LayoutManager {
    constructor() {
        this.pdfArea = document.querySelector('.top-left');
        this.pdfContainer = document.getElementById('pdf-container');
        this.init();
    }

    init() {
        this.setupPDFAreaObserver();
        this.setupResizeHandler();
        this.checkPDFContent();
    }

    setupPDFAreaObserver() {
        // 观察PDF容器内容变化
        if (this.pdfContainer) {
            const observer = new MutationObserver(() => {
                this.checkPDFContent();
            });

            observer.observe(this.pdfContainer, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });
        }
    }

    setupResizeHandler() {
        // 响应窗口大小变化
        window.addEventListener('resize', () => {
            this.adjustLayout();
        });
    }

    checkPDFContent() {
        if (!this.pdfArea || !this.pdfContainer) return;

        const hasPDFContent = this.pdfContainer.children.length > 0 && 
                             !this.pdfContainer.classList.contains('empty');

        // 检查PDF查看器是否被手动收起
        const pdfViewContainer = document.getElementById('pdf-view-container');
        const isManuallyCollapsed = pdfViewContainer && pdfViewContainer.classList.contains('collapsed');

        // 如果被手动收起，不要自动展开
        if (isManuallyCollapsed) {
            return;
        }

        if (hasPDFContent) {
            this.expandPDFArea();
        } else {
            this.collapsePDFArea();
        }
    }

    expandPDFArea() {
        if (!this.pdfArea) return;
        
        this.pdfArea.classList.remove('empty-state');
        this.pdfArea.classList.add('has-content');
        
        // 添加展开动画
        this.pdfArea.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        
        // 在移动端调整为全宽
        if (window.innerWidth <= 992) {
            this.pdfArea.style.gridRow = '1 / 2';
        } else {
            this.pdfArea.style.gridRow = '1 / 3';
        }
    }

    collapsePDFArea() {
        if (!this.pdfArea) return;
        
        this.pdfArea.classList.remove('has-content');
        this.pdfArea.classList.add('empty-state');
        
        // 添加收缩动画
        this.pdfArea.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        this.pdfArea.style.gridRow = '1 / 2';
        
        // 添加空状态提示
        if (this.pdfContainer && !this.pdfContainer.classList.contains('empty')) {
            this.pdfContainer.classList.add('empty');
        }
    }

    adjustLayout() {
        // 根据屏幕尺寸调整布局
        const isMobile = window.innerWidth <= 992;
        
        if (isMobile) {
            this.adjustMobileLayout();
        } else {
            this.adjustDesktopLayout();
        }
    }

    adjustMobileLayout() {
        // 移动端布局调整
        const gridItems = document.querySelectorAll('.grid-item');
        gridItems.forEach(item => {
            item.style.minHeight = 'auto';
        });
    }

    adjustDesktopLayout() {
        // 桌面端布局调整
        this.checkPDFContent();
    }

    // 添加平滑的区域切换动画
    animateAreaTransition(element, fromState, toState) {
        if (!element) return;

        element.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        
        // 添加临时的动画类
        element.classList.add('transitioning');
        
        setTimeout(() => {
            element.classList.remove('transitioning');
        }, 600);
    }

    // 优化上传区域的视觉反馈
    enhanceUploadArea() {
        const uploadArea = document.getElementById('drop-area');
        if (!uploadArea) return;

        // 添加拖拽悬停效果
        uploadArea.addEventListener('dragenter', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-hover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            if (!uploadArea.contains(e.relatedTarget)) {
                uploadArea.classList.remove('drag-hover');
            }
        });

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-hover');
            uploadArea.classList.add('file-dropped');
            
            setTimeout(() => {
                uploadArea.classList.remove('file-dropped');
            }, 1000);
        });
    }

    // 添加按钮点击波纹效果
    addRippleEffect() {
        const buttons = document.querySelectorAll('.btn');
        
        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                const ripple = document.createElement('span');
                const rect = button.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;
                
                ripple.style.width = ripple.style.height = size + 'px';
                ripple.style.left = x + 'px';
                ripple.style.top = y + 'px';
                ripple.classList.add('ripple');
                
                button.appendChild(ripple);
                
                setTimeout(() => {
                    ripple.remove();
                }, 600);
            });
        });
    }
}

// 添加相关的CSS样式
const style = document.createElement('style');
style.textContent = `
    .grid-item.transitioning {
        transform: scale(0.98);
        opacity: 0.9;
    }

    .upload-area.drag-hover {
        border-color: var(--success-color) !important;
        background: linear-gradient(135deg, #f0fff4 0%, #e6fffa 100%) !important;
        transform: scale(1.05) !important;
        box-shadow: 0 15px 40px rgba(78, 205, 196, 0.3) !important;
    }

    .upload-area.file-dropped {
        border-color: var(--accent-color) !important;
        background: linear-gradient(135deg, #fff0f8 0%, #ffe6f7 100%) !important;
        animation: dropSuccess 0.8s ease-out;
    }

    @keyframes dropSuccess {
        0% { transform: scale(1.1); }
        50% { transform: scale(0.95); }
        100% { transform: scale(1); }
    }

    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        transform: scale(0);
        animation: rippleEffect 0.6s linear;
        pointer-events: none;
    }

    @keyframes rippleEffect {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }

    /* PDF区域过渡动画 */
    .top-left.empty-state {
        min-height: 180px !important;
    }

    .top-left.has-content {
        min-height: 400px !important;
    }

    /* 移除grid-item的hover浮起效果以提升性能 */

    /* 按钮组的改进布局 */
    .buttons {
        gap: 15px !important;
    }

    .buttons .btn {
        flex: 1;
        min-width: 140px;
    }

    @media (max-width: 768px) {
        .buttons .btn {
            flex: none;
            min-width: 120px;
        }
    }
`;
document.head.appendChild(style);

export default LayoutManager; 