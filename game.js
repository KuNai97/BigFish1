// 游戏状态标志
let isGameOver = false;
let isGameWin = false;

// 每次生成敌人数量基础值
let enemiesPerSpawn = 0.1;

// 敌人鱼的等级划分及对应大小、图片、成长值
const enemyTiers = [
    { minSize: 5, maxSize: 15, image: 'images/Mackerel.png', growthValue: 1 },
    { minSize: 16, maxSize: 30, image: 'images/BlueTang.png', growthValue: 3 },
    { minSize: 31, maxSize: 50, image: 'images/Anchovy.png', growthValue: 5 },
    { minSize: 51, maxSize: 80, image: 'images/PufferFish1.png', growthValue: 6 },
    { minSize: 81, maxSize: 120, image: 'images/StoneFish.png', growthValue: 7 },
    { minSize: 121, maxSize: 150, image: 'images/pike fish.png', growthValue: 9 },
    { minSize: 151, maxSize: 180, image: 'images/BlueFish.png', growthValue: 12 },
    { minSize: 181, maxSize: 200, image: 'images/SunFish.png', growthValue: 15 },
    { minSize: 201, maxSize: 240, image: 'images/Shark.png', growthValue: 20 }
];

// 玩家图片对象
const playerImage = new Image();
playerImage.src = 'images/ClownFish.png';
let playerImageWidth = 0;
let playerImageHeight = 0;
let playerVisualBounds = null; // 视觉边界对象

// 画布和上下文
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// 键盘按键状态，初始化为未按下
const keys = { w: false, a: false, s: false, d: false };

// 每个等级对应需要达到的成长值
const growthNeeded = [20, 25, 30, 80, 120, 150, 180, 200, 240, 280];

// --------- 计算视觉边界的辅助函数 ---------
function calcVisualBounds(mask, width, height) {
    let left = width, right = 0, top = height, bottom = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (mask[y * width + x]) {
                if (x < left) left = x;
                if (x > right) right = x;
                if (y < top) top = y;
                if (y > bottom) bottom = y;
            }
        }
    }
    return { left, right, top, bottom };
}

// --------- 像素级碰撞检测辅助函数 ---------
// 输入：一张图片，返回该图片透明部分的掩码，方便做像素碰撞
function getAlphaMask(image) {
    // 创建离屏画布，大小与图片相同
    const offCanvas = document.createElement('canvas');
    offCanvas.width = image.width;
    offCanvas.height = image.height;
    const offCtx = offCanvas.getContext('2d');

    // 将图片画到离屏画布
    offCtx.drawImage(image, 0, 0);

    // 获取画布像素数据（RGBA）
    const imageData = offCtx.getImageData(0, 0, image.width, image.height);

    const alphaMask = [];

    // 遍历每个像素的 alpha 通道，alpha>0 代表不透明，存 true，否则 false
    for (let i = 0; i < imageData.data.length; i += 4) {
        const alpha = imageData.data[i + 3]; // 每4字节最后一位是 alpha
        alphaMask.push(alpha > 0);
    }

    // 返回掩码和图片尺寸
    return { mask: alphaMask, width: image.width, height: image.height };
}

// --------- 玩家鱼类 ---------
class PlayerFish {
    constructor() {
        this.x = 400;
        this.y = 300;
        this.speed = 2;
        this.level = 1;
        this.growth = 0;
        this.health = 100;
        this.direction = 'right';
        this.isDamaged = false;
        this.damageTimer = 0;
    }

    takeDamage(amount) {
        this.health -= amount;
        this.isDamaged = true;
        this.damageTimer = 300; // 300 毫秒变红
    }

    get radius() {
        return 15 + this.growth * 0.5;
    }

    getDrawSize() {
        return this.radius * 2;
    }

    update() {
        let dx = 0, dy = 0;
        if (keys.w) dy -= 1;
        if (keys.s) dy += 1;
        if (keys.a) dx -= 1;
        if (keys.d) dx += 1;

        dx += joystick?.x || 0;
        dy += joystick?.y || 0;

        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
            dx /= length;
            dy /= length;
            this.direction = dx < 0 ? 'left' : (dx > 0 ? 'right' : this.direction);
        }

        this.x += dx * this.speed;
        this.y += dy * this.speed;

        const drawSize = this.getDrawSize();
        const scale = drawSize / playerImageWidth;

        const centerX = playerImageWidth / 2;
        const centerY = playerImageHeight / 2;

        const leftOffsetPx = playerVisualBounds.left - centerX;
        const rightOffsetPx = playerVisualBounds.right - centerX;
        const topOffsetPx = playerVisualBounds.top - centerY;
        const bottomOffsetPx = playerVisualBounds.bottom - centerY;

        const leftOffset = leftOffsetPx * scale;
        const rightOffset = rightOffsetPx * scale;
        const topOffset = topOffsetPx * scale;
        const bottomOffset = bottomOffsetPx * scale;

        this.x = Math.min(canvas.width - rightOffset, Math.max(-leftOffset, this.x));
        this.y = Math.min(canvas.height - bottomOffset, Math.max(-topOffset, this.y));

        // 更新变红计时器
        if (this.isDamaged) {
            this.damageTimer -= 16; // 每帧减少约 16ms（60帧）
            if (this.damageTimer <= 0) {
                this.isDamaged = false;
                this.damageTimer = 0;
            }
        }

    }

    draw(ctx) {
        if (!playerImage.complete) {
            ctx.beginPath();
            ctx.fillStyle = 'orange';
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        const drawSize = this.getDrawSize();

        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.direction === 'left') ctx.scale(-1, 1);

        if (this.isDamaged) {
            // 绘制主角图像
            ctx.globalAlpha = 1.0;
            ctx.drawImage(playerImage, -drawSize / 2, -drawSize / 2, drawSize, drawSize);

            if (this.isDamaged) {
                ctx.globalCompositeOperation = 'source-atop';
                ctx.fillStyle = 'rgba(255, 84, 84, 0.5)';
                ctx.fillRect(-drawSize / 2, -drawSize / 2, drawSize, drawSize);
                ctx.globalCompositeOperation = 'source-over'; // 恢复默认
            }

        } else {
            ctx.drawImage(playerImage, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
        }
        ctx.restore();
    }
}
// --------- 敌人鱼类 ---------
class Enemy {
    constructor() {
        const tier = enemyTiers[Math.floor(Math.random() * enemyTiers.length)];
        this.tier = tier;
        this.size = Math.random() * (tier.maxSize - tier.minSize) + tier.minSize;
        this.radius = this.size / 2;
        this.speed = Math.random() * 1.5 + 0.3;
        this.y = Math.random() * canvas.height;
        this.fromLeft = Math.random() < 0.5;
        this.x = this.fromLeft ? -this.size : canvas.width + this.size;

        this.image = new Image();
        this.image.src = tier.image;

        this.image.onload = () => {
            this.alphaMask = getAlphaMask(this.image);
        };
    }

    update() {
        this.x += this.fromLeft ? this.speed : -this.speed;
    }

    draw(ctx) {
        ctx.save();

        const drawSize = this.size;
        if (!this.fromLeft) {
            ctx.translate(this.x + this.radius, this.y - this.radius);
            ctx.scale(-1, 1);
        } else {
            ctx.translate(this.x - this.radius, this.y - this.radius);
        }

        ctx.drawImage(this.image, 0, 0, drawSize, drawSize);
        ctx.restore();
    }

    getGrowthValue() {
        return this.tier.growthValue;
    }
}

const player = new PlayerFish();

playerImage.onload = () => {
    playerImageWidth = playerImage.width;
    playerImageHeight = playerImage.height;

    const alphaMaskData = getAlphaMask(playerImage);
    playerVisualBounds = calcVisualBounds(alphaMaskData.mask, alphaMaskData.width, alphaMaskData.height);
    player.alphaMask = alphaMaskData;
};

let enemies = [];
let enemySpawnTimer = 0;
let animationId = null;

function isPixelColliding(fish1, fish2) {
    const left = Math.max(fish1.x - fish1.radius, fish2.x - fish2.radius);
    const right = Math.min(fish1.x + fish1.radius, fish2.x + fish2.radius);
    const top = Math.max(fish1.y - fish1.radius, fish2.y - fish2.radius);
    const bottom = Math.min(fish1.y + fish1.radius, fish2.y + fish2.radius);

    if (right <= left || bottom <= top) return false;

    if (!fish1.alphaMask || !fish2.alphaMask) return false;

    const step = 2;

    for (let y = top; y < bottom; y += step) {
        for (let x = left; x < right; x += step) {
            const f1x = Math.floor((x - (fish1.x - fish1.radius)) * fish1.alphaMask.width / (fish1.radius * 2));
            const f1y = Math.floor((y - (fish1.y - fish1.radius)) * fish1.alphaMask.height / (fish1.radius * 2));
            const f2x = Math.floor((x - (fish2.x - fish2.radius)) * fish2.alphaMask.width / (fish2.radius * 2));
            const f2y = Math.floor((y - (fish2.y - fish2.radius)) * fish2.alphaMask.height / (fish2.radius * 2));

            const f1Index = f1y * fish1.alphaMask.width + f1x;
            const f2Index = f2y * fish2.alphaMask.width + f2x;

            if (fish1.alphaMask.mask[f1Index] && fish2.alphaMask.mask[f2Index]) {
                return true;
            }
        }
    }

    return false;
}

function updateEnemies() {
    if (isGameOver || isGameWin) return;

    enemySpawnTimer++;

    let dynamicInterval = Math.max(50, 100 - player.level * 5);

    if (enemySpawnTimer >= dynamicInterval) {
        const randomOffset = Math.floor(Math.random() * 2);
        const count = enemiesPerSpawn + randomOffset;

        for (let i = 0; i < count; i++) {
            enemies.push(new Enemy());
        }

        enemySpawnTimer = 0;
    }

    enemies.forEach((enemy) => enemy.update());

    enemies = enemies.filter((e) => e.x > -e.size && e.x < canvas.width + e.size);

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];

        if (isPixelColliding(player, enemy)) {
            if (player.radius >= enemy.radius) {
                player.growth += enemy.getGrowthValue();

                enemies.splice(i, 1);

                if (player.level < growthNeeded.length - 1 &&
                    player.growth >= growthNeeded[player.level]) {
                    player.level++;
                    // 不直接赋值 radius，radius是getter
                }

                if (player.level >= growthNeeded.length - 1) {
                    endGame(true);
                    return;
                }

            } else {
                player.takeDamage(1);

                if (player.health <= 0) {
                    endGame(false);
                    return;
                }
            }
        }
    }
}

function drawEnemies(ctx) {
    enemies.forEach((enemy) => enemy.draw(ctx));
}

function updateHUD() {
    document.getElementById("health").innerText = `血量: ${player.health}`;
    document.getElementById("level").innerText = `等级: ${player.level}`;
    document.getElementById("growth").innerText = `成长值: ${Math.floor(player.growth)}`;
}

function gameLoop() {
    if (isGameOver || isGameWin) return;

    animationId = requestAnimationFrame(gameLoop);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    player.update();
    player.draw(ctx);

    updateEnemies();
    drawEnemies(ctx);

    updateHUD();
}

function endGame(success) {
    cancelAnimationFrame(animationId);

    isGameOver = !success;
    isGameWin = success;

    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('end-screen').classList.remove('hidden');

    document.getElementById('end-message').innerText = success ? "你赢了！" : "你S了！";
}

document.getElementById('start-button').addEventListener('click', () => {
    resetGame();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    gameLoop();
});

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
});

function resetGame() {
    isGameOver = false;
    isGameWin = false;

    player.x = 400;
    player.y = 300;
    // 不要给 player.radius 赋值
    player.level = 1;
    player.growth = 0;
    player.health = 100;

    enemies = [];
    enemySpawnTimer = 0;
}

document.getElementById('restart-button').addEventListener('click', () => {
    resetGame();
    document.getElementById('end-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    gameLoop();
});

document.getElementById('home-button').addEventListener('click', () => {
    resetGame();
    document.getElementById('end-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
});
