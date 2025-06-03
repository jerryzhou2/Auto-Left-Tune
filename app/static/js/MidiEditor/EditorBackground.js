document.addEventListener("DOMContentLoaded", () => {
    // 创建Canvas元素
    const canvas = document.createElement("canvas");
    canvas.id = "music-bg";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    // 设置Canvas尺寸
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    let gradientOffset = 0;

    console.log("Canvas set to full screen.");

    // 配置参数
    const particles = [];      // 音符粒子
    const stars = [];          // 星光粒子
    const meteors = [];
    const METEOR_COUNT = 12;
    const PARTICLE_COUNT = 150; // 音符粒子数量
    const STAR_COUNT = 150;     // 星光粒子数量
    const MAX_DISTANCE = 150;   // 连线最大距离
    const NOTE_TYPES = ['quarter', 'eighth', 'rest']; // 音符类型

    // 增强风格配色方案
    const COLORS = {
        background: ['#cbd5e1', '#94a3b8'], // 背景渐变
        particles: ['#4338ca', '#7c3aed', '#059669', '#2563eb'], // 音符颜色
        lines: 'rgba(79, 70, 229, 0.3)', // 连线颜色
        staff: 'rgba(100, 116, 139, 0.3)', // 五线谱颜色
        stars: ['rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 200, 0.7)', 'rgba(200, 220, 255, 0.7)'] // 星光颜色
    };

    // 发光效果配置
    const GLOW = {
        blur: 6, // 发光模糊半径
        intensity: 1.5 // 发光强度系数
    };

    // 音符粒子类
    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 0.8; // 移动速度
            this.vy = (Math.random() - 0.5) * 0.8;
            this.radius = 1.5 + Math.random() * 2;
            this.color = COLORS.particles[Math.floor(Math.random() * COLORS.particles.length)];
            this.type = NOTE_TYPES[Math.floor(Math.random() * NOTE_TYPES.length)];
            this.rotation = Math.random() * Math.PI * 2;
            this.pulse = Math.random() * Math.PI * 2;
        }

        move() {
            this.x += this.vx;
            this.y += this.vy;

            // 边界检测
            if (this.x < -this.radius * 10) this.x = width + this.radius * 10;
            if (this.x > width + this.radius * 10) this.x = -this.radius * 10;
            if (this.y < -this.radius * 10) this.y = height + this.radius * 10;
            if (this.y > height + this.radius * 10) this.y = -this.radius * 10;

            // 脉冲动画
            this.pulse += 0.02;
            this.currentRadius = this.radius + Math.sin(this.pulse) * 0.3;
        }

        draw() {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);

            // 绘制主体前启用发光效果
            this.applyGlow();

            // 根据类型绘制不同的音符
            switch (this.type) {
                case 'quarter':
                    this.drawQuarterNote();
                    break;
                case 'eighth':
                    this.drawEighthNote();
                    break;
                case 'rest':
                    this.drawRest();
                    break;
                default:
                    this.drawCircle();
            }

            ctx.restore();
        }

        // 应用发光效果
        applyGlow() {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = GLOW.blur;
        }

        // 绘制四分音符
        drawQuarterNote() {
            // 音符头
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, this.currentRadius * 1.8, this.currentRadius * 1.2, 0, 0, Math.PI * 2);
            ctx.fill();

            // 符干
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.currentRadius * 0.5;
            ctx.beginPath();
            ctx.moveTo(this.currentRadius * 1.8, 0);
            ctx.lineTo(this.currentRadius * 1.8, -this.currentRadius * 7);
            ctx.stroke();
        }

        // 绘制八分音符
        drawEighthNote() {
            // 音符头
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, this.currentRadius * 1.8, this.currentRadius * 1.2, 0, 0, Math.PI * 2);
            ctx.fill();

            // 符干
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.currentRadius * 0.5;
            ctx.beginPath();
            ctx.moveTo(this.currentRadius * 1.8, 0);
            ctx.lineTo(this.currentRadius * 1.8, -this.currentRadius * 7);
            ctx.stroke();

            // 符尾
            ctx.beginPath();
            ctx.moveTo(this.currentRadius * 1.8, -this.currentRadius * 4.5);
            ctx.bezierCurveTo(
                this.currentRadius * 2.8, -this.currentRadius * 5,
                this.currentRadius * 2.8, -this.currentRadius * 3.5,
                this.currentRadius * 1.8, -this.currentRadius * 3
            );
            ctx.stroke();
        }

        // 绘制休止符
        drawRest() {
            ctx.fillStyle = this.color;

            // 绘制休止符形状
            ctx.beginPath();
            ctx.moveTo(-this.currentRadius * 1.2, 0);
            ctx.lineTo(this.currentRadius * 1.2, 0);
            ctx.lineTo(this.currentRadius * 0.6, this.currentRadius * 2.5);
            ctx.lineTo(-this.currentRadius * 0.6, this.currentRadius * 2.5);
            ctx.closePath();
            ctx.fill();

            // 上部
            ctx.beginPath();
            ctx.moveTo(-this.currentRadius * 0.6, -this.currentRadius * 2.5);
            ctx.lineTo(this.currentRadius * 0.6, -this.currentRadius * 2.5);
            ctx.lineTo(this.currentRadius * 1.2, 0);
            ctx.lineTo(-this.currentRadius * 1.2, 0);
            ctx.closePath();
            ctx.fill();
        }

        // 绘制普通圆形粒子
        drawCircle() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(0, 0, this.currentRadius * 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 星光粒子类
    class Star {
        constructor() {
            this.reset();
            this.opacity = Math.random() * 0.5 + 0.3; // 初始透明度
            this.flickerSpeed = Math.random() * 0.03 + 0.01; // 闪烁速度
            this.flickerPhase = Math.random() * Math.PI * 2; // 闪烁相位
        }

        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * -height; // 从屏幕上方开始
            this.size = Math.random() * 1.5 + 0.5; // 星光大小
            this.speed = Math.random() * 0.5 + 0.2; // 下落速度
            this.color = COLORS.stars[Math.floor(Math.random() * COLORS.stars.length)];
            this.trailLength = Math.random() * 8 + 5; // 拖尾长度
        }

        move() {
            this.y += this.speed;

            // 更新闪烁效果
            this.flickerPhase += this.flickerSpeed;
            this.currentOpacity = this.opacity + Math.sin(this.flickerPhase) * 0.2;

            // 如果超出屏幕，重置位置
            if (this.y > height) {
                this.reset();
            }
        }

        draw() {
            // 绘制星光主体
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);

            // 创建径向渐变，模拟星光中心亮边缘暗的效果
            const gradient = ctx.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, this.size
            );
            gradient.addColorStop(0, `rgba(255, 255, 255, ${this.currentOpacity})`);
            gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);

            ctx.fillStyle = gradient;
            ctx.fill();

            // 添加发光效果
            ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
            ctx.shadowBlur = 3;

            // 绘制拖尾效果（模拟移动痕迹）
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x, this.y - this.trailLength);
            ctx.strokeStyle = `rgba(255, 255, 255, ${this.currentOpacity * 0.5})`;
            ctx.lineWidth = this.size * 0.8;
            ctx.stroke();

            ctx.restore();
        }
    }

    // 绘制五线谱
    function drawStaff() {
        // 绘制五线谱主体
        ctx.strokeStyle = COLORS.staff;
        ctx.lineWidth = 1;

        const staffCount = Math.ceil(height / 120);

        for (let i = 0; i < staffCount; i++) {
            const yOffset = i * 120 + 50;

            for (let j = 0; j < 5; j++) {
                // 绘制主线
                ctx.beginPath();
                ctx.moveTo(0, yOffset + j * 6);
                ctx.lineTo(width, yOffset + j * 6);
                ctx.stroke();

                // 添加发光效果
                ctx.strokeStyle = `rgba(148, 163, 184, 0.15)`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, yOffset + j * 6 - 1);
                ctx.lineTo(width, yOffset + j * 6 - 1);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(0, yOffset + j * 6 + 1);
                ctx.lineTo(width, yOffset + j * 6 + 1);
                ctx.stroke();

                // 恢复原始样式
                ctx.strokeStyle = COLORS.staff;
                ctx.lineWidth = 1;
            }
        }
    }

    function drawBackgroundGradient() {
        gradientOffset += 0.002;
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, `hsl(${(gradientOffset * 360) % 360}, 60%, 80%)`);
        gradient.addColorStop(1, `hsl(${(gradientOffset * 360 + 60) % 360}, 60%, 60%)`);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    // 绘制粒子间连线
    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < MAX_DISTANCE) {
                    // 距离越近，线条越明显
                    const opacity = 0.4 * (1 - distance / MAX_DISTANCE);

                    // 绘制主体连线
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(79, 70, 229, ${opacity})`;
                    ctx.lineWidth = 0.8;
                    ctx.stroke();

                    // 添加发光效果
                    ctx.strokeStyle = `rgba(79, 70, 229, ${opacity * 0.6})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
    }

    // 动画循环
    function animate() {
        // 绘制背景
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, COLORS.background[0]);
        gradient.addColorStop(1, COLORS.background[1]);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        drawBackgroundGradient(); // 背景动画

        // 绘制五线谱
        drawStaff();

        // 更新并绘制所有星光粒子
        stars.forEach(star => {
            star.move();
            star.draw();
        });

        // 更新并绘制所有音符粒子
        particles.forEach(particle => {
            particle.move();
            particle.draw();
        });

        meteors.forEach(meteor => {
            meteor.move();
            meteor.draw();
        });


        // 绘制连线
        drawConnections();

        // 继续下一帧
        requestAnimationFrame(animate);
    }

    class Meteor {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * -height;
            this.length = Math.random() * 80 + 60;
            this.speed = Math.random() * 8 + 5;
            this.angle = Math.PI / 4; // 45度方向
            this.alpha = 1;
            this.color = 'rgba(255, 255, 255, 0.8)';
        }

        move() {
            this.x += this.speed * Math.cos(this.angle);
            this.y += this.speed * Math.sin(this.angle);
            this.alpha -= 0.01; // 慢慢消失

            if (this.alpha <= 0) {
                this.reset();
            }
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x - this.length * Math.cos(this.angle), this.y - this.length * Math.sin(this.angle));
            ctx.stroke();

            ctx.restore();
        }
    }


    // 初始化粒子
    function initParticles() {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particles.push(new Particle());
        }

        for (let i = 0; i < STAR_COUNT; i++) {
            stars.push(new Star());
        }

        for (let i = 0; i < METEOR_COUNT; i++) {
            meteors.push(new Meteor());
        }
    }

    // 响应窗口大小变化
    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    // 初始化并开始动画
    initParticles();
    animate();

    // 设置Canvas样式
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.zIndex = "-1";
    canvas.style.pointerEvents = "none";
    canvas.style.filter = "blur(0.5px)";
});

