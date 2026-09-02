// fireworks.js - 原封不动的烟花效果代码
document.addEventListener('DOMContentLoaded', function() {
    // 兼容性处理：获取TinyColor引用
    const TinyColor = window.TinyColor || tinycolor;
    
    // 检查依赖是否加载
    if (typeof TinyColor === 'undefined' || typeof anime === 'undefined') {
        console.error('Required libraries not loaded!');
        return;
    }

    /**
     * 获取事件坐标
     */
    function getCoordsFromEvent(e) {
        const pointerX = 'clientX' in e
            ? e.clientX
            : (e.touches[0] ? e.touches[0].clientX : e.changedTouches[0].clientX);
        const pointerY = 'clientY' in e
            ? e.clientY
            : (e.touches[0] ? e.touches[0].clientY : e.changedTouches[0].clientY);
        return {
            x: pointerX,
            y: pointerY,
        };
    }
    
    /**
     * 设置画布尺寸
     */
    function setCanvasSize(canvasEl, width = window.innerWidth, height = window.innerHeight) {
        canvasEl.width = width;
        canvasEl.height = height;
        canvasEl.style.width = `${width}px`;
        canvasEl.style.height = `${height}px`;
    }
    
    /**
     * 创建烟花效果
     */
    function createFireworks(config) {
        const { 
            selector = 'canvas.fireworks', 
            numberOfParticles = 20, 
            circleRadius = { min: 10, max: 20 },
            diffuseRadius = { min: 50, max: 100 },
            orbitRadius = { min: 50, max: 100 },
            animeDuration = { min: 900, max: 1500 },
        } = config;
        
        const colors = (config.colors && config.colors.length > 0)
            ? config.colors
            : ['#66A7DD', '#3E83E1', '#214EC2'];
        
        const canvasEl = document.querySelector(selector);
        const ctx = canvasEl.getContext('2d');
        if (!ctx) return;
        
        function setParticleDirection(p) {
            const angle = (anime.random(0, 360) * Math.PI) / 180;
            const value = anime.random(diffuseRadius.min, diffuseRadius.max);
            const radius = value * [-1, 1][Math.floor(Math.random() * 2)];
            return {
                x: p.x + radius * Math.cos(angle),
                y: p.y + radius * Math.sin(angle),
            };
        }
        
        function createParticle(x, y) {
            const color = new TinyColor(colors[Math.floor(Math.random() * colors.length)]);
            color.setAlpha(anime.random(0.2, 0.8));
            const p = {
                x,
                y,
                color: color.toRgbString(),
                radius: anime.random(circleRadius.min, circleRadius.max),
                endPos: setParticleDirection({ x, y }),
                draw: () => { },
            };
            p.draw = function () {
                if (!ctx) return;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI, true);
                ctx.fillStyle = p.color;
                ctx.fill();
            };
            return p;
        }
        
        function createCircle(x, y) {
            const p = {
                x,
                y,
                color: '#000',
                radius: 0.1,
                alpha: 0.5,
                lineWidth: 6,
                draw() { },
            };
            p.draw = () => {
                if (!ctx) return;
                ctx.globalAlpha = p.alpha;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI, true);
                ctx.lineWidth = p.lineWidth;
                ctx.strokeStyle = p.color;
                ctx.stroke();
                ctx.globalAlpha = 1;
            };
            return p;
        }
        
        function renderParticle(anim) {
            for (const target of anim.animatables) {
                target.target.draw();
            }
        }
        
        function animateParticles(pos) {
            const { x, y } = pos;
            const circle = createCircle(x, y);
            const particles = [];
            for (let i = 0; i < numberOfParticles; i++)
                particles.push(createParticle(x, y));
            
            const timeline = anime.timeline({});
            timeline
                .add({
                    targets: particles,
                    x: function(target) {
                        return target.endPos.x;
                    },
                    y: function(target) {
                        return target.endPos.y;
                    },
                    radius: 0.1,
                    duration: anime.random(animeDuration.min, animeDuration.max),
                    easing: 'easeOutExpo',
                    update: renderParticle,
                })
                .add({
                    targets: circle,
                    radius: anime.random(orbitRadius.min, orbitRadius.max),
                    lineWidth: 0,
                    alpha: [
                        { value: 0, duration: anime.random(600, 800), easing: 'linear' }
                    ],
                    duration: anime.random(1200, 1800),
                    easing: 'easeOutExpo',
                    update: function(anim) {
                        anim.animatables[0].target.draw();
                    },
                }, 0);
        }
        
        document.addEventListener('mousedown', (e) => {
            anime({
                targets: { n: 0 },
                n: 1,
                duration: 2000,
                update: function() {
                    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
                },
            });
            const pos = getCoordsFromEvent(e);
            const rect = canvasEl.getBoundingClientRect();
            animateParticles({
                x: pos.x - rect.left,
                y: pos.y - rect.top,
            });
        }, false);
        
        setCanvasSize(canvasEl);
        window.addEventListener('resize', () => {
            setCanvasSize(canvasEl);
        }, false);
    }
    
    // 初始化烟花效果
    createFireworks({});
});