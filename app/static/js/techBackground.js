// techBackground.js
document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.createElement("canvas");
    canvas.id = "tech-bg";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const particles = [];
    const PARTICLE_COUNT = 120;
    const MAX_DISTANCE = 130;

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 1.2;
            this.vy = (Math.random() - 0.5) * 1.2;
            this.radius = 1.5 + Math.random() * 2.5;
            this.baseRadius = this.radius;
            this.pulse = Math.random() * Math.PI * 2;
        }

        move() {
            this.x += this.vx;
            this.y += this.vy;

            if (this.x < 0 || this.x > width) this.vx *= -1;
            if (this.y < 0 || this.y > height) this.vy *= -1;

            // 添加轻微的“脉冲”闪动
            this.pulse += 0.05;
            this.radius = this.baseRadius + Math.sin(this.pulse) * 0.5;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            const glowColor = "rgba(0, 255, 231, 0.8)";
            ctx.fillStyle = glowColor;
            ctx.shadowColor = "#00ffe7";
            ctx.shadowBlur = 10;
            ctx.fill();
        }
    }

    function initParticles() {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particles.push(new Particle());
        }
    }

    function drawLines() {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            for (let j = i + 1; j < PARTICLE_COUNT; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < MAX_DISTANCE) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(0, 255, 231, ${1 - dist / MAX_DISTANCE})`;
                    ctx.lineWidth = 0.4;
                    ctx.shadowColor = "#00ffe7";
                    ctx.shadowBlur = 4;
                    ctx.stroke();
                }
            }
        }
    }

    function animate() {
        // 绘制渐变背景
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, "#050d1f");
        gradient.addColorStop(1, "#0b1e38");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        for (const p of particles) {
            p.move();
            p.draw();
        }
        drawLines();
        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    initParticles();
    animate();

    // 样式设置
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.zIndex = "-1";
    canvas.style.pointerEvents = "none";
});
