/**
 * 跳跃闯关游戏引擎 v2.1
 * 升级内容：
 * - Phase 1: UI视觉升级（开始界面/HUD/结束弹窗重构 + 过渡动画）
 * - Phase 2: 手感优化（惯性控制/物理参数调优/着陆缓冲/边缘安全区）
 * 支持精灵图渲染 + 色块降级模式
 */

const PlatformManager = require('./platform-manager');
const ScoreManager = require('./score-manager');
const ItemManager = require('./item-manager');

// 物理参数（参考 Doodle Jump / Helix Jump 手感优化）
const PHYSICS = {
  gravity: 0.45,          // 重力（原0.5，略减小让滞空更久）
  jumpForce: -13,         // 跳跃力（原-12，增强）
  springForce: -19,       // 弹簧力（原-18，增强）
  maxFallSpeed: 14,       // 最大下落速度（原15，略减）
  moveSpeed: 5,           // 基础移动速度
  moveAcceleration: 0.8,  // 移动加速度
};

// 游戏状态
const GAME_STATE = {
  IDLE: 'idle',
  LOADING: 'loading',
  PLAYING: 'playing',
  PAUSED: 'paused',
  OVER: 'over',
};

// 资源名称常量（与 images/ 目录对应）
const IMG = {
  // 角色
  PLAYER_IDLE: 'player_idle',
  PLAYER_JUMP: 'player_jump',
  PLAYER_FALL: 'player_fall',
  // 平台
  PLATFORM_NORMAL: 'platform_normal',
  PLATFORM_SPRING: 'platform_spring',
  PLATFORM_FRAGILE: 'platform_fragile',
  PLATFORM_MOVING: 'platform_moving',
  // 背景
  BG_GRADIENT: 'bg_gradient',
  BG_CLOUDS: 'bg_clouds',
  BG_MOUNTAINS: 'bg_mountains',
  // UI
  BTN_START: 'btn_start',
  BTN_RESTART: 'btn_restart',
  BTN_HOME: 'btn_home',
  PANEL_START: 'panel_start',
  PANEL_GAMEOVER: 'panel_gameover',
  LOGO_TITLE: 'logo_title',
  ICON_PAUSE: 'icon_pause',
  // 特效
  PARTICLE_STAR: 'particle_star',
  EFFECT_SPRING: 'effect_spring',
  EFFECT_BREAK: 'effect_break',
};

// 平台类型到图片的映射
const PLATFORM_IMAGES = {
  normal: IMG.PLATFORM_NORMAL,
  spring: IMG.PLATFORM_SPRING,
  fragile: IMG.PLATFORM_FRAGILE,
  moving: IMG.PLATFORM_MOVING,
};

class GameEngine {
  constructor(canvas, ctx, screenWidth, screenHeight) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;

    // 游戏状态
    this.state = GAME_STATE.IDLE;
    this.score = 0;
    this.level = 1;

    // 新增属性：生命值/金币/连击/护盾
    this.lives = 3;           // 生命值
    this.coins = 0;           // 金币数
    this.combo = 0;           // 连击数
    this.shieldActive = false;// 护盾状态
    this.firstFall = true;    // 第一次掉落免死（安全网机制）

    // 道具管理器
    this.itemManager = new ItemManager(screenWidth, screenHeight);

    // 过渡动画系统
    this.transitionAlpha = 1; // 整体透明度（0~1），用于淡入效果

    // 浮动得分文字数组
    this.floatingScores = [];

    // 触摸惯性系统
    this.touchVelocity = 0;   // 当前触摸方向的速度

    // 图片资源（由 ImageLoader 加载后注入）
    this.images = {};

    // 角色
    this.player = {
      x: 0, y: 0,
      width: 36, height: 36,
      vx: 0, vy: 0,
      direction: 1,
    };

    // 摄像机
    this.cameraY = 0;
    this.maxCameraY = 0;

    // 视差背景偏移量
    this.bgOffset = { clouds: 0, mountains: 0 };

    // 管理器
    this.platformManager = new PlatformManager(screenWidth, screenHeight);
    this.scoreManager = new ScoreManager();

    // 游戏循环
    this.lastTime = 0;
    this.animFrameId = null;

    // 回调
    this.onScoreUpdate = null;
    this.onGameOver = null;
    this.onLevelUpdate = null;

    // 按钮区域
    this.buttons = {};

    // 加载进度
    this.loadProgress = 0;
    this.loadTotal = 0;
  }

  /** 注入已加载的图片资源 */
  setImages(images) {
    this.images = images || {};
  }

  /** 获取图片，不存在返回 null */
  _img(name) { return this.images[name] || null; }

  /** 判断是否有可用图片 */
  _hasImg(name) { return !!this.images[name]; }

  // ========== 初始化 ==========
  init() {
    this.state = GAME_STATE.IDLE;
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.coins = 0;
    this.combo = 0;
    this.shieldActive = false;
    this.firstFall = true;    // 重置安全网机制
    this.itemManager.reset(); // 重置道具系统
    this.cameraY = 0;
    this.maxCameraY = 0;
    this.floatingScores = [];
    this.touchVelocity = 0;

    // 开始界面淡入动画初始化
    this.transitionAlpha = 0;

    var firstPlatform = this.platformManager.init();
    this.player.x = firstPlatform.x + firstPlatform.width / 2 - this.player.width / 2;
    this.player.y = firstPlatform.y - this.player.height;
    this.player.vx = 0;
    this.player.vy = 0;

    this._defineButtons();
    this.render();
  }

  /** 显示加载界面 */
  showLoading(progress, total) {
    this.state = GAME_STATE.LOADING;
    this.loadProgress = progress;
    this.loadTotal = total;
    this.render();
  }

  _defineButtons() {
    var w = this.screenWidth;
    var h = this.screenHeight;
    var centerX = w / 2;

    // 开始按钮：居中，垂直中间位置，尺寸200x52
    this.buttons.startGame = { x: centerX - 100, y: h / 2, w: 200, h: 52 };

    // 排行榜按钮：开始按钮下方16px，尺寸160x40，描边样式
    this.buttons.ranking = { x: centerX - 80, y: h / 2 + 68, w: 160, h: 40 };

    // 结束弹窗按钮：水平排列（不是上下）
    // 「再来一局」红色实心按钮 120x44
    this.buttons.restart = { x: centerX - 130, y: h / 2 + 85, w: 120, h: 44 };
    // 「返回首页」灰色按钮 120x44
    this.buttons.home = { x: centerX + 10, y: h / 2 + 85, w: 120, h: 44 };
    // 「提交分数」链接文字在按钮下方
    this.buttons.submitScore = { x: centerX - 80, y: h / 2 + 140, w: 160, h: 32 };

    // 暂停按钮保持在右上角
    this.buttons.pause = { x: w - 44, y: 10, w: 36, h: 28 };
  }

  start() {
    this.state = GAME_STATE.PLAYING;
    this.lastTime = Date.now();
    this.gameLoop();
  }

  pause() {
    if (this.state === GAME_STATE.PLAYING) {
      this.state = GAME_STATE.PAUSED;
      if (this.animFrameId) { this.canvas.cancelAnimationFrame(this.animFrameId); this.animFrameId = null; }
      this.render();
    }
  }

  resume() {
    if (this.state === GAME_STATE.PAUSED) {
      this.state = GAME_STATE.PLAYING;
      this.lastTime = Date.now();
      this.gameLoop();
    }
  }

  restart() {
    if (this.animFrameId) { this.canvas.cancelAnimationFrame(this.animFrameId); this.animFrameId = null; }
    this.platformManager.reset();
    this.init();
    this.start();
  }

  // ========== 主循环 ==========
  gameLoop() {
    if (this.state !== GAME_STATE.PLAYING) return;
    var now = Date.now();
    var dt = Math.min(now - this.lastTime, 33);
    this.lastTime = now;
    this.update(dt);
    this.render();
    this.animFrameId = this.canvas.requestAnimationFrame(() => this.gameLoop());
  }

  update(dt) {
    var factor = dt / 16.67;

    // 重力应用
    this.player.vy += PHYSICS.gravity * factor;
    if (this.player.vy > PHYSICS.maxFallSpeed) this.player.vy = PHYSICS.maxFallSpeed;

    // 惯性衰减机制（Phase 2: 手感优化）
    // 当没有触摸输入时，速度逐渐衰减而不是立即归零
    if (Math.abs(this.touchVelocity) > 0) {
      // 使用触摸速度作为目标，实现平滑过渡
      this.player.vx += (this.touchVelocity - this.player.vx) * PHYSICS.moveAcceleration * factor;
    } else {
      // 松手后速度衰减：每帧衰减8%，当|vx|<0.3时归零
      this.player.vx *= 0.92;
      if (Math.abs(this.player.vx) < 0.3) {
        this.player.vx = 0;
      }
    }

    this.player.x += this.player.vx * factor;
    this.player.y += this.player.vy * factor;

    // 屏幕边缘安全区（Phase 2: 60px额外空间防止误死）
    if (this.player.x + this.player.width < -60) {
      this.player.x = this.screenWidth;
    } else if (this.player.x > this.screenWidth + 60) {
      this.player.x = -this.player.width;
    }

    // 平台碰撞检测（仅在下落时）
    if (this.player.vy > 0) this.checkPlatformCollision();

    // 视差背景跟随
    var playerScreenY = this.player.y - this.cameraY;
    if (playerScreenY < this.screenHeight * 0.4) {
      var diff = this.screenHeight * 0.4 - playerScreenY;
      this.cameraY -= diff;
      this.maxCameraY = Math.min(this.maxCameraY, this.cameraY);
      // 各层视差速度不同
      this.bgOffset.clouds += diff * 0.3;
      this.bgOffset.mountains += diff * 0.1;
    }

    this.platformManager.update(this.cameraY, this.score);

    // 为新平台生成道具（Phase 3: 道具系统）
    var platforms = this.platformManager.getPlatforms();
    for (var pi = 0; pi < platforms.length; pi++) {
      var plat = platforms[pi];
      if (!plat.itemSpawned && !plat.destroyed) {
        plat.itemSpawned = true;
        this.itemManager.spawnOnPlatform(plat, this.level);
      }
    }

    // 更新道具系统（Phase 3: 道具系统）
    this.itemManager.update(this.cameraY, this.player);
    // 检测道具碰撞
    var collectedItem = this.itemManager.checkCollision(this.player);
    if (collectedItem) {
      this.handleItemCollect(collectedItem);
    }

    // 掉落死亡检测（Phase 4: 改为扣命机制）
    if (this.player.y - this.cameraY > this.screenHeight + 50) {
      this.handleFallDeath();
    }

    // 更新浮动得分文字动画
    this._updateFloatingScores(factor);

    // 更新过渡动画（淡入效果）
    if (this.transitionAlpha < 1) {
      this.transitionAlpha = Math.min(1, this.transitionAlpha + 0.05);
    }
  }

  /**
   * 平台碰撞检测（Phase 2: 增加着陆缓冲）
   * - 碰撞容差从15px增加到20px
   * - 自动吸附到平台表面（±3px内）
   */
  checkPlatformCollision() {
    var platforms = this.platformManager.getPlatforms();
    var pb = this.player.y + this.player.height;  // 角色底部Y坐标
    var pl = this.player.x;                        // 角色左侧X坐标
    var pr = this.player.x + this.player.width;    // 角色右侧X坐标

    for (var i = 0; i < platforms.length; i++) {
      var p = platforms[i];
      if (p.destroyed) continue;

      // 碰撞检测：底部容差从15px增加到20px
      if (pb >= p.y && pb <= p.y + 20 && pr > p.x && pl < p.x + p.width) {
        // 自动吸附：当脚底接近平台顶部（±3px内）时，精确对齐
        if (pb - p.y <= 3 && pb - p.y >= -3) {
          this.player.y = p.y - this.player.height;
        } else {
          this.player.y = p.y - this.player.height;
        }

        // 根据平台类型处理跳跃
        switch (p.type) {
          case 'normal': this.player.vy = PHYSICS.jumpForce; break;
          case 'spring': this.player.vy = PHYSICS.springForce; break;
          case 'fragile':
            this.player.vy = PHYSICS.jumpForce;
            p.destroyed = true;
            this.lives--; // 扣1命而不是直接死亡
            if (this.lives <= 0) {
              this.gameOver(); // 0命才结束
            }
            break;
          case 'moving': this.player.vy = PHYSICS.jumpForce; break;
        }

        // 得分处理（避免重复计分）
        if (!p.scored) {
          p.scored = true;
          this.addScore(10);
          // 生成浮动得分文字（Phase 1: 过渡动画）
          this._createFloatingScore(10, this.player.x + this.player.width / 2, this.player.y);
        }
        break;
      }
    }
  }

  /**
   * 添加得分（带连击系统）
   */
  addScore(points) {
    this.score += points;
    this.combo++;  // 连击数+1

    if (this.onScoreUpdate) this.onScoreUpdate(this.score);

    // 关卡升级检测
    var newLevel = Math.floor(this.score / 100) + 1;
    if (newLevel !== this.level) {
      this.level = newLevel;
      if (this.onLevelUpdate) this.onLevelUpdate(this.level);
    }
  }

  /**
   * 游戏结束处理（Phase 4: 容错机制 - 改为生命值系统）
   * - 有护盾时消耗护盾免死
   * - 有生命时扣命并重生
   * - 0命时真正结束游戏
   */
  gameOver() {
    // 检查是否有护盾（Phase 3: 道具系统）
    if (this.shieldActive || this.itemManager.hasEffect('shield')) {
      this.shieldActive = false;
      this.itemManager.activeEffects.shield = null;
      // 抵消本次死亡，重生到最近平台上方
      this.respawnPlayer();
      return;
    }

    // 扣1命
    this.lives--;

    if (this.lives > 0) {
      // 还有命，重生
      this.respawnPlayer();
      return;
    }

    // 0命了，真正游戏结束
    this.state = GAME_STATE.OVER;
    if (this.animFrameId) { this.canvas.cancelAnimationFrame(this.animFrameId); this.animFrameId = null; }
    this.scoreManager.updateBestScore(this.score);

    // 结束弹窗淡入动画初始化
    this.transitionAlpha = 0;

    if (this.onGameOver) this.onGameOver(this.score, this.scoreManager.getBestScore());
    this.render();
  }

  // ========== Phase 3: 道具系统 ==========

  /**
   * 处理道具收集
   * @param {string} type - 道具类型
   */
  handleItemCollect(type) {
    switch (type) {
      case 'coin':
        this.coins++;
        this.addScore(50); // 金币额外加50分
        this.combo++;
        if (this.combo > 1) {
          this.addScore(this.combo * 5); // 连击奖励
        }
        break;
      case 'shield':
        this.shieldActive = true;
        break;
      case 'spring_shoe':
      case 'magnet':
      case 'cloud':
        // 效果已在 itemManager 中激活
        this.addScore(25); // 道具基础分
        break;
    }
  }

  /**
   * 处理掉落死亡（Phase 4: 安全网机制）
   */
  handleFallDeath() {
    // 第一次掉落免死（安全网机制）
    if (this.firstFall) {
      this.firstFall = false;
      this.respawnPlayer();
      return; // 不扣命
    }
    this.gameOver();
  }

  /**
   * 重生角色到最近可见平台上方（Phase 4: 容错机制）
   */
  respawnPlayer() {
    var platforms = this.platformManager.getPlatforms();
    var nearestPlatform = null;
    var minDist = Infinity;

    for (var i = 0; i < platforms.length; i++) {
      var p = platforms[i];
      if (p.destroyed) continue;
      var screenY = p.y - this.cameraY;
      if (screenY < 0 || screenY > this.screenHeight) continue;
      var dist = Math.abs(p.x + p.width / 2 - this.screenWidth / 2);
      if (dist < minDist) {
        minDist = dist;
        nearestPlatform = p;
      }
    }

    if (nearestPlatform) {
      this.player.x = nearestPlatform.x + nearestPlatform.width / 2 - this.player.width / 2;
      this.player.y = nearestPlatform.y - this.player.height - 10;
      this.player.vx = 0;
      this.player.vy = 0;
    } else {
      // 没找到平台，重置到底部中央
      this.player.x = this.screenWidth / 2 - this.player.width / 2;
      this.player.y = this.cameraY + this.screenHeight - 100;
      this.player.vx = 0;
      this.player.vy = 0;
    }
  }

  // ========== 触摸输入（Phase 2: 惯性优化）==========
  handleTouch(x, y) {
    if (this.state === GAME_STATE.IDLE) {
      if (this._hitTest(x, y, this.buttons.startGame)) return 'startGame';
      if (this._hitTest(x, y, this.buttons.ranking)) return 'ranking';
      return null;
    }
    if (this.state === GAME_STATE.PLAYING) {
      if (this._hitTest(x, y, this.buttons.pause)) return 'pause';

      // 优化触摸控制：使用距离计算速度，更灵敏的响应
      var centerX = this.screenWidth / 2;
      var distance = Math.abs(x - centerX) / centerX;
      var speed = PHYSICS.moveSpeed + distance * 5;  // 基础速度5 + 距离加成最大5

      // 设置触摸目标速度（不直接改变vx，通过update中的惯性系统平滑过渡）
      this.touchVelocity = x < centerX ? -speed : speed;
      this.player.direction = x < centerX ? -1 : 1;
      return null;
    }
    if (this.state === GAME_STATE.PAUSED) return null;
    if (this.state === GAME_STATE.OVER) {
      if (this._hitTest(x, y, this.buttons.restart)) return 'restart';
      if (this._hitTest(x, y, this.buttons.home)) return 'home';
      if (this._hitTest(x, y, this.buttons.submitScore)) return 'submitScore';
      return null;
    }
    return null;
  }

  /**
   * 触摸结束（Phase 2: 不立即归零，而是让惯性系统接管）
   */
  handleTouchEnd() {
    // 不立即将vx设为0，而是清除触摸目标速度
    // update()中的惯性衰减会自然减速
    this.touchVelocity = 0;
  }

  _hitTest(x, y, btn) { return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h; }

  // ========== 渲染主入口 ==========
  render() {
    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.screenWidth, this.screenHeight);

    if (this.state === GAME_STATE.LOADING) { this._renderLoadingScreen(ctx); return; }

    // 背景
    this._renderBackground(ctx);

    if (this.state === GAME_STATE.IDLE) {
      // 应用淡入透明度
      ctx.globalAlpha = this.transitionAlpha;
      this._renderStartScreen(ctx);
      ctx.globalAlpha = 1;
      return;
    }

    // 游戏世界
    ctx.save();
    ctx.translate(0, -this.cameraY);
    this._renderPlatforms(ctx);
    this._renderItems(ctx);  // Phase 3: 道具渲染
    this._renderPlayer(ctx);
    ctx.restore();

    // HUD
    if (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.PAUSED) { this._renderHUD(ctx); }
    if (this.state === GAME_STATE.PAUSED) { this._renderPauseOverlay(ctx); }

    if (this.state === GAME_STATE.OVER) {
      // 结束弹窗淡入效果
      ctx.globalAlpha = this.transitionAlpha;
      this._renderGameOverModal(ctx);
      ctx.globalAlpha = 1;
    }

    // 渲染浮动得分文字（游戏进行中显示）
    if (this.state === GAME_STATE.PLAYING) {
      this._renderFloatingScores(ctx);
    }
  }

  // ========== 背景（支持视差）==========
  _renderBackground(ctx) {
    var w = this.screenWidth;
    var h = this.screenHeight;

    // 主背景图 或 渐变降级
    var bgImg = this._img(IMG.BG_GRADIENT);
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, w, h);
    } else {
      var grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#87CEEB');
      grad.addColorStop(0.6, '#E0F4FF');
      grad.addColorStop(1, '#F7FFF7');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // 远山层（最慢视差）
    var mtnImg = this._img(IMG.BG_MOUNTAINS);
    if (mtnImg) {
      var mtnH = mtnImg.height * (w / mtnImg.width);
      var mtnY = h - mtnH - (this.bgOffset.mountains % mtnH);
      ctx.globalAlpha = 0.4;
      ctx.drawImage(mtnImg, 0, mtnY, w, mtnH);
      ctx.globalAlpha = 1;
    }

    // 云朵层（中等视差）
    var cloudImg = this._img(IMG.BG_CLOUDS);
    if (cloudImg) {
      var cloudH = cloudImg.height * (w / cloudImg.width);
      var cloudY = -(this.bgOffset.clouds % cloudH);
      ctx.globalAlpha = 0.7;
      ctx.drawImage(cloudImg, 0, cloudY, w, cloudH);
      ctx.drawImage(cloudImg, 0, cloudY + cloudH, w, cloudH);
      ctx.globalAlpha = 1;
    }
  }

  // ========== 加载界面 ==========
  _renderLoadingScreen(ctx) {
    var w = this.screenWidth;
    var h = this.screenHeight;

    // 背景
    ctx.fillStyle = '#E8F4FD';
    ctx.fillRect(0, 0, w, h);

    // 标题
    ctx.fillStyle = '#FF6B6B';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('加载中...', w / 2, h / 2 - 30);

    // 进度条背景
    var barW = 240, barH = 12, barX = (w - barW) / 2, barY = h / 2 + 10;
    ctx.fillStyle = '#DDDDDD';
    this._roundRect(ctx, barX, barY, barW, barH, 6);
    ctx.fill();

    // 进度条填充
    var pct = this.loadTotal > 0 ? this.loadProgress / this.loadTotal : 0;
    ctx.fillStyle = '#4ECDC4';
    this._roundRect(ctx, barX, barY, barW * Math.max(0.05, pct), barH, 6);
    ctx.fill();

    // 进度文字
    ctx.fillStyle = '#666666';
    ctx.font = '13px sans-serif';
    ctx.fillText(Math.round(pct * 100) + '%', w / 2, h / 2 + 45);
  }

  // ========== 开始界面（Phase 1: 完全重构）==========
  _renderStartScreen(ctx) {
    var w = this.screenWidth;
    var h = this.screenHeight;
    var centerY = h / 2;

    // 面板背景（半透明白色圆角矩形）
    var panelImg = this._img(IMG.PANEL_START);
    if (panelImg) {
      var pw = Math.min(320, w - 40), ph = pw * (panelImg.height / panelImg.width);
      ctx.drawImage(panelImg, (w - pw) / 2, (h - ph) / 2, pw, ph);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      this._roundRect(ctx, 20, 20, w - 40, h - 40, 20);
      ctx.fill();
    }

    // 标题 logo 或文字：占据屏幕上方30%区域，放大显示
    var logoImg = this._img(IMG.LOGO_TITLE);
    var titleAreaTop = h * 0.08;       // 标题区域起始位置（上方12%）
    var titleAreaHeight = h * 0.25;     // 标题区域高度（25%）

    if (logoImg) {
      var lw = Math.min(260, w - 50);   // 放大logo宽度
      var lh = lw * (logoImg.height / logoImg.width);
      // 限制高度不超过标题区域
      if (lh > titleAreaHeight) {
        lh = titleAreaHeight;
        lw = lh * (logoImg.width / logoImg.height);
      }
      ctx.drawImage(logoImg, (w - lw) / 2, titleAreaTop, lw, lh);
    } else {
      // 文字标题：放大显示
      ctx.fillStyle = '#FF6B6B';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('跳跃闯关', w / 2, titleAreaTop + titleAreaHeight / 2);
    }

    // 副标题：字号13px，颜色#888
    var subtitleY = titleAreaTop + titleAreaHeight + 25;
    ctx.fillStyle = '#888888';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('触摸屏幕左右两侧控制角色移动', w / 2, subtitleY);

    // 操作指引：「◀ 左侧向左 | 右侧向右 ►」
    var guideY = subtitleY + 22;
    ctx.fillStyle = '#AAAAAA';
    ctx.font = '12px sans-serif';
    ctx.fillText('◀ 左侧向左 | 右侧向右 ►', w / 2, guideY);

    // 开始游戏按钮：居中，在屏幕垂直中间位置，尺寸200x52
    var startBtn = this.buttons.startGame;
    var startImg = this._img(IMG.BTN_START);
    if (startImg) {
      ctx.drawImage(startImg, startBtn.x, startBtn.y, startBtn.w, startBtn.h);
    } else {
      this._drawButton(ctx, startBtn, '#FF6B6B', '#FFFFFF', '开始游戏', 18);
    }

    // 排行榜按钮：开始按钮下方16px，尺寸160x40，描边样式（无填充）
    var rankBtn = this.buttons.ranking;
    this._drawOutlineButton(ctx, rankBtn, '#4ECDC4', '排行榜', 15);
  }

  // ========== HUD（Phase 1: 新布局）==========
  _renderHUD(ctx) {
    var w = this.screenWidth;
    var hudHeight = 56;  // 顶栏高度从48px增加到56px

    // 顶栏背景
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(0, 0, w, hudHeight);

    // 左侧：心形图标 + 生命值数字（红色 #FF6B6B）
    ctx.fillStyle = '#FF6B6B';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('❤️', 12, hudHeight / 2);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(String(this.lives), 32, hudHeight / 2);

    // 中左：分数标签(11px 灰色) + 分数值(20px 粗体 深色)
    var scoreX = 65;
    ctx.fillStyle = '#999999';
    ctx.font = '11px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('得分', scoreX, 8);
    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 20px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(this.score), scoreX, 36);

    // 中右：关卡标签(11px 灰色) + 关卡值(20px 粗体 #4ECDC4)
    var levelX = w / 2 + 20;
    ctx.fillStyle = '#999999';
    ctx.font = '11px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('关卡', levelX, 8);
    ctx.fillStyle = '#4ECDC4';
    ctx.font = 'bold 20px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(this.level), levelX, 36);

    // 右侧：金币图标 + 金币数量（金色 #FFB800）
    var coinX = w - 75;
    ctx.fillStyle = '#FFB800';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🪙', coinX, hudHeight / 2);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(String(this.coins), coinX + 20, hudHeight / 2);

    // 暂停按钮（右上角）
    var pb = this.buttons.pause;
    var pauseImg = this._img(IMG.ICON_PAUSE);
    if (pauseImg) {
      ctx.drawImage(pauseImg, pb.x, pb.y, pb.w, pb.h);
    } else {
      ctx.fillStyle = 'rgba(200,200,200,0.5)';
      this._roundRect(ctx, pb.x, pb.y, pb.w, pb.h, 6);
      ctx.fill();
      ctx.fillStyle = '#666666';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⏸', pb.x + pb.w / 2, pb.y + pb.h / 2);
    }
  }

  // ========== 暂停遮罩 ==========
  _renderPauseOverlay(ctx) {
    var w = this.screenWidth;
    var h = this.screenHeight;

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('游戏暂停', w / 2, h / 2 - 15);

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px sans-serif';
    ctx.fillText('点击屏幕任意位置继续', w / 2, h / 2 + 20);
  }

  // ========== 结束弹窗（Phase 1: 完全重构）==========
  _renderGameOverModal(ctx) {
    var w = this.screenWidth;
    var h = this.screenHeight;

    // 半透明黑色遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, w, h);

    // 面板：更大尺寸300x320
    var panelImg = this._img(IMG.PANEL_GAMEOVER);
    var mw = 300, mh = 320;
    var mx = (w - mw) / 2, my = (h - mh) / 2;

    if (panelImg) {
      ctx.drawImage(panelImg, mx, my, mw, mh);
    } else {
      ctx.fillStyle = '#FFFFFF';
      this._roundRect(ctx, mx, my, mw, mh, 16);
      ctx.fill();
    }

    // 标题「游戏结束」22px粗体，顶部居中
    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('游戏结束', w / 2, my + 24);

    // 新纪录时显示星星动画效果（用★★★符号放大）
    var bestScore = this.scoreManager.getBestScore();
    if (this.score >= bestScore && this.score > 0) {
      ctx.fillStyle = '#FFD700';  // 金色星星
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★★★', w / 2, my + 62);

      // 「🎉 新纪录！」文字，红色粗体
      ctx.fillStyle = '#FF6B6B';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('🎉 新纪录！', w / 2, my + 90);
    }

    // 分数信息两列布局
    var scoreSectionY = this.score >= bestScore && this.score > 0 ? my + 115 : my + 70;

    // 本次得分（左列）
    ctx.fillStyle = '#888888';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('本次得分', w / 2 - 65, scoreSectionY);
    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(String(this.score), w / 2 - 65, scoreSectionY + 20);

    // 最高纪录（右列）
    ctx.fillStyle = '#888888';
    ctx.font = '12px sans-serif';
    ctx.fillText('最高纪录', w / 2 + 65, scoreSectionY);
    ctx.fillStyle = '#FFB800';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(String(bestScore), w / 2 + 65, scoreSectionY + 20);

    // 两个按钮水平排列（不是上下）
    var restartBtn = this.buttons.restart;
    var homeBtn = this.buttons.home;

    // 「再来一局」红色实心按钮 120x44
    var restartImg = this._img(IMG.BTN_RESTART);
    if (restartImg) {
      ctx.drawImage(restartImg, restartBtn.x, restartBtn.y, restartBtn.w, restartBtn.h);
    } else {
      this._drawButton(ctx, restartBtn, '#FF6B6B', '#FFFFFF', '再来一局', 15);
    }

    // 「返回首页」灰色按钮 120x44
    var homeImg = this._img(IMG.BTN_HOME);
    if (homeImg) {
      ctx.drawImage(homeImg, homeBtn.x, homeBtn.y, homeBtn.w, homeBtn.h);
    } else {
      this._drawButton(ctx, homeBtn, '#F0F0F0', '#666666', '返回首页', 15);
    }

    // 「提交分数」链接文字在按钮下方
    var submitBtn = this.buttons.submitScore;
    this._drawTextButton(ctx, submitBtn, '#4ECDC4', '提交分数到排行榜');
  }

  // ========== 平台渲染（图片优先）==========
  _renderPlatforms(ctx) {
    var platforms = this.platformManager.getPlatforms();
    var colors = { normal: '#6BCB77', spring: '#4D96FF', fragile: '#FF6B6B', moving: '#9B59B6' };

    for (var i = 0; i < platforms.length; i++) {
      var p = platforms[i];
      if (p.destroyed) continue;
      var screenY = p.y - this.cameraY;
      if (screenY < -30 || screenY > this.screenHeight + 30) continue;

      // 优先使用图片
      var imgName = PLATFORM_IMAGES[p.type];
      var platImg = this._img(imgName);
      if (platImg) {
        ctx.drawImage(platImg, p.x, p.y, p.width, p.height);
      } else {
        // 降级为色块
        ctx.fillStyle = colors[p.type] || colors.normal;
        this._roundRect(ctx, p.x, p.y, p.width, p.height, 6);
        ctx.fill();

        if (p.type === 'spring') {
          ctx.fillStyle = '#FFFFFF'; ctx.font = '11px sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('↑↑', p.x + p.width / 2, p.y + p.height / 2);
        }
        if (p.type === 'fragile') {
          ctx.strokeStyle = '#CC4444'; ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x + p.width * 0.3, p.y + 2);
          ctx.lineTo(p.x + p.width * 0.5, p.y + p.height / 2);
          ctx.lineTo(p.x + p.width * 0.7, p.y + 2);
          ctx.stroke();
        }
      }
    }
  }

  // ========== 道具渲染（Phase 3: 道具系统）==========
  _renderItems(ctx) {
    var items = this.itemManager.getItems();
    var now = Date.now();

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.collected) continue;

      var x = item.x;
      var y = item.y + item.bobOffset; // 加上浮动偏移
      var config = this.itemManager.getConfig(item.type);

      ctx.save();

      switch (item.type) {
        case 'coin':
          // 金币：圆形 + 旋转动画
          var rotation = (now * 0.003) % (Math.PI * 2);
          var scaleX = Math.cos(rotation);
          ctx.translate(x + item.width / 2, y + item.height / 2);
          ctx.scale(scaleX, 1);
          ctx.fillStyle = config.color;
          ctx.beginPath();
          ctx.arc(0, 0, item.width / 2, 0, Math.PI * 2);
          ctx.fill();
          // 金币内部装饰（$符号）
          if (Math.abs(scaleX) > 0.3) {
            ctx.fillStyle = '#B8860B';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', 0, 0);
          }
          break;

        case 'shield':
          // 护盾：盾牌形状
          ctx.fillStyle = config.color;
          ctx.beginPath();
          ctx.moveTo(x + item.width / 2, y);
          ctx.lineTo(x + item.width, y + item.height * 0.4);
          ctx.lineTo(x + item.width * 0.85, y + item.height);
          ctx.lineTo(x + item.width / 2, y + item.height * 0.85);
          ctx.lineTo(x + item.width * 0.15, y + item.height);
          ctx.lineTo(x, y + item.height * 0.4);
          ctx.closePath();
          ctx.fill();
          // 护盾内部图标
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('S', x + item.width / 2, y + item.height / 2);
          break;

        case 'spring_shoe':
          // 弹簧鞋：鞋形
          ctx.fillStyle = config.color;
          this._roundRect(ctx, x + 2, y + item.height * 0.3, item.width - 4, item.height * 0.7, 4);
          ctx.fill();
          // 鞋底弹簧效果
          ctx.strokeStyle = '#CC7000';
          ctx.lineWidth = 2;
          for (var s = 0; s < 3; s++) {
            ctx.beginPath();
            ctx.moveTo(x + 6 + s * 6, y + item.height);
            ctx.lineTo(x + 8 + s * 6, y + item.height * 0.5);
            ctx.stroke();
          }
          break;

        case 'magnet':
          // 磁铁：U形磁铁
          ctx.fillStyle = config.color;
          // 左臂
          this._roundRect(ctx, x, y, item.width * 0.35, item.height * 0.7, 3);
          ctx.fill();
          // 右臂
          this._roundRect(ctx, x + item.width * 0.65, y, item.width * 0.35, item.height * 0.7, 3);
          ctx.fill();
          // 中间横梁
          this._roundRect(ctx, x, y + item.height * 0.65, item.width, item.height * 0.35, 3);
          ctx.fill();
          // 磁力线动画
          ctx.strokeStyle = 'rgba(231, 76, 60, 0.5)';
          ctx.lineWidth = 1;
          var magnetRange = now % 1000 / 1000 * 10;
          ctx.beginPath();
          ctx.arc(x + item.width / 2, y + item.height / 2, item.width / 2 + magnetRange, 0, Math.PI * 2);
          ctx.stroke();
          break;

        case 'cloud':
          // 减速云：云朵形状
          ctx.fillStyle = config.color;
          ctx.beginPath();
          ctx.arc(x + item.width * 0.25, y + item.height * 0.6, item.height * 0.45, 0, Math.PI * 2);
          ctx.arc(x + item.width * 0.5, y + item.height * 0.4, item.height * 0.55, 0, Math.PI * 2);
          ctx.arc(x + item.width * 0.75, y + item.height * 0.6, item.height * 0.45, 0, Math.PI * 2);
          ctx.fill();
          // 云朵文字
          ctx.fillStyle = '#999999';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('慢', x + item.width / 2, y + item.height / 2);
          break;
      }

      ctx.restore();
    }
  }

  // ========== 角色渲染（图片优先）==========
  _renderPlayer(ctx) {
    var p = this.player;

    // 根据速度选择姿态
    var imgName = IMG.PLAYER_IDLE;
    if (p.vy < -2) imgName = IMG.PLAYER_JUMP;
    else if (p.vy > 2) imgName = IMG.PLAYER_FALL;

    var playerImg = this._img(imgName);
    if (playerImg) {
      // 绘制精灵图（支持翻转方向）
      ctx.save();
      var cx = p.x + p.width / 2;
      if (p.direction < 0) {
        ctx.translate(cx, 0);
        ctx.scale(-1, 1);
        ctx.translate(-cx, 0);
      }
      ctx.drawImage(playerImg, p.x, p.y, p.width, p.height);
      ctx.restore();
    } else {
      // 降级为圆形角色
      var cx = p.x + p.width / 2;
      var cy = p.y + p.height / 2;
      ctx.fillStyle = '#FF6B6B';
      ctx.beginPath(); ctx.arc(cx, cy, p.width / 2, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      var eo = p.direction * 4;
      ctx.beginPath(); ctx.arc(cx + eo - 4, cy - 4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + eo + 4, cy - 4, 4, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#2D3436';
      ctx.beginPath(); ctx.arc(cx + eo - 3, cy - 4, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + eo + 5, cy - 4, 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ========== 浮动得分文字系统（Phase 1: 过渡动画）==========

  /**
   * 创建浮动得分文字
   * @param {number} score - 得分值
   * @param {number} x - X坐标（屏幕坐标）
   * @param {number} y - Y坐标（世界坐标，需转换）
   */
  _createFloatingScore(score, x, y) {
    this.floatingScores.push({
      text: '+' + score,
      x: x,
      y: y - this.cameraY,  // 转换为屏幕坐标
      alpha: 1,             // 透明度（1→0）
      offsetY: 0,           // Y轴偏移（向上移动）
      scale: 1,             // 缩放（用于弹出效果）
      life: 1.0,            // 生命周期（秒）
    });
  }

  /**
   * 更新所有浮动得分文字
   */
  _updateFloatingScores(factor) {
    for (var i = this.floatingScores.length - 1; i >= 0; i--) {
      var fs = this.floatingScores[i];

      // 更新生命周期
      fs.life -= 0.016 * factor;  // 约60fps下每帧减少
      if (fs.life <= 0) {
        this.floatingScores.splice(i, 1);
        continue;
      }

      // 向上移动并淡出
      fs.offsetY -= 1.2 * factor;  // 每帧上移1.2px
      fs.alpha = Math.max(0, fs.life);  // 透明度随生命周期递减

      // 初始弹出效果（前30%时间放大）
      if (fs.life > 0.7) {
        fs.scale = 1 + (1 - fs.life) / 0.3 * 0.3;  // 最大放大到1.3倍
      } else {
        fs.scale = Math.max(1, fs.scale - 0.02 * factor);
      }
    }
  }

  /**
   * 渲染浮动得分文字
   */
  _renderFloatingScores(ctx) {
    for (var i = 0; i < this.floatingScores.length; i++) {
      var fs = this.floatingScores[i];

      ctx.save();
      ctx.globalAlpha = fs.alpha;
      ctx.translate(fs.x, fs.y + fs.offsetY);
      ctx.scale(fs.scale, fs.scale);

      // 绘制文字
      ctx.fillStyle = '#FFD700';  // 金色
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fs.text, 0, 0);

      ctx.restore();
    }
  }

  // ========== UI 辅助绘制方法 ==========

  _drawButton(ctx, btn, bgColor, textColor, text, fontSize) {
    ctx.fillStyle = bgColor;
    this._roundRect(ctx, btn.x, btn.y, btn.w, btn.h, btn.h / 2);
    ctx.fill();
    ctx.fillStyle = textColor;
    ctx.font = (fontSize || 16) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, btn.x + btn.w / 2, btn.y + btn.h / 2);
  }

  _drawOutlineButton(ctx, btn, borderColor, text, fontSize) {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    this._roundRect(ctx, btn.x, btn.y, btn.w, btn.h, btn.h / 2);
    ctx.stroke();
    ctx.fillStyle = borderColor;
    ctx.font = (fontSize || 14) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, btn.x + btn.w / 2, btn.y + btn.h / 2);
  }

  _drawTextButton(ctx, btn, color, text) {
    ctx.fillStyle = color;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, btn.x + btn.w / 2, btn.y + btn.h / 2);
  }

  _roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  getState() { return this.state; }

  destroy() {
    if (this.animFrameId) { this.canvas.cancelAnimationFrame(this.animFrameId); this.animFrameId = null; }
  }
}

module.exports = GameEngine;
