/**
 * 跳跃闯关游戏引擎 v3.1
 * 升级内容：
 * - Phase 1: UI视觉升级（开始界面/HUD/结束弹窗重构 + 过渡动画）
 * - Phase 2: 手感优化（惯性控制/物理参数调优/着陆缓冲/边缘安全区）
 * - Phase 3: UI全面重设计（品牌化加载界面/渐变按钮/毛玻璃HUD/完整暂停菜单/入场动画）
 * - Phase 5: 容错机制完善（生命值增强/多层安全网/智能重生/掉落预警/易碎平台延迟/难度自适应）
 * 支持精灵图渲染 + 色块降级模式
 */

const PlatformManager = require('./platform-manager');
const ScoreManager = require('./score-manager');
const ItemManager = require('./item-manager');
const AudioManager = require('./audio-manager');

// 物理参数（Phase 2: 手感深度优化 - 轻盈/丝滑/可控）
const PHYSICS = {
  gravity: 0.42,          // 原0.45，减小让滞空更久（轻盈感）
  jumpForce: -13.5,       // 原-13，微增跳跃力
  springForce: -20,       // 原-19，增强弹飞感
  maxFallSpeed: 13,       // 原14，降低砸地感
  moveSpeed: 6,           // 原5，提高基础移动速度
  moveAcceleration: 0.9,  // 原0.8，提高加速度（跟手感）
};

// 游戏状态
const GAME_STATE = {
  IDLE: 'idle',
  LOADING: 'loading',
  PLAYING: 'playing',
  PAUSED: 'paused',
  OVER: 'over',
  TUTORIAL: 'tutorial',    // Phase 6: 教程状态
};

// ========== Phase 4: 随机事件系统 ==========
const GAME_EVENTS = [
  { id: 'rain', name: '下雨', prob: 0.15, duration: 10000, effect: { friction: 0.7 } },
  { id: 'updraft', name: '上升气流', prob: 0.12, duration: 8000, effect: { gravityMod: 0.5 } },
  { id: 'coinRain', name: '金币雨', prob: 0.10, duration: 5000, effect: { coinBonus: true } },
  { id: 'snail', name: '蜗牛模式', prob: 0.08, duration: 6000, effect: { speedMod: 0.5 } },
  { id: 'turbo', name: '加速模式', prob: 0.10, duration: 7000, effect: { speedMod: 1.25 } },
  { id: 'shieldBless', name: '护盾祝福', prob: 0.05, duration: 0, effect: { instantShield: true } },
];

// ========== Phase 4: 成就系统 ==========
const ACHIEVEMENTS = {
  first_jump: { name: '初出茅庐', desc: '完成第一次跳跃', icon: '*' },
  score_1000: { name: '千分达人', desc: '单局得分超过1000', icon: '*' },
  score_5000: { name: '高手玩家', desc: '单局得分超过5000', icon: '*' },
  coins_50: { name: '小财迷', desc: '单局收集50个金币', icon: '*' },
  level_10: { name: '登高能手', desc: '到达第10关', icon: '*' },
  perfect_game: { name: '完美通关', desc: '不扣命完成一局(到达目标分数)', icon: '*' },
  combo_30: { name: '连击新手', desc: '达成30连击', icon: '*' },
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

// ========== Phase 6: 关卡主题系统 ==========
// 每5关切换一个主题，提供不同的视觉体验
const LEVEL_THEMES = [
  {   // Level 1-5: 春日花园
    name: 'spring',
    displayName: '\uD83C\uDF38 \u6625\u65E5\u82B1\u56ED',           // 🌸 春日花园
    levelRange: [1, 5],
    bgGradient: ['#FFE4E1', '#98D8C8'],       // 背景渐变色
    bgAccent: '#FFB7C5',                       // 强调色
    platformTint: '#90EE90',                   // 平台染色
    particleType: 'petal',                    // 装饰粒子: 花瓣
    skyColor: '#87CEEB',
  },
  {   // Level 6-10: 海洋世界
    name: 'ocean',
    displayName: '\uD83C\uDF0A \u6D77\u6D0B\u4E16\u754C',           // 🌊 海洋世界
    levelRange: [6, 10],
    bgGradient: ['#87CEEB', '#E0F4FF'],
    bgAccent: '#4FC3F7',
    platformTint: '#00CED1',
    particleType: 'bubble',                   // 气泡
    skyColor: '#00BFFF',
  },
  {   // Level 11-15: 火山地带
    name: 'volcano',
    displayName: '\uD83D\uDD25 \u706B\u5C71\u5730\u5E26',           // 🔥 火山地带
    levelRange: [11, 15],
    bgGradient: ['#FF6B6B', '#FFA07A'],
    bgAccent: '#FF4500',
    platformTint: '#CD853F',
    particleType: 'spark',                    // 火星
    skyColor: '#FF8C00',
  },
  {   // Level 16-20: 冰雪王国
    name: 'ice',
    displayName: '\u2744\uFE0F \u51B0\u96EA\u738B\u56FD',           // ❄️ 冰雪王国
    levelRange: [16, 20],
    bgGradient: ['#E0FFFF', '#B0E0E6'],
    bgAccent: '#AFEEEE',
    platformTint: '#E0FFFF',
    particleType: 'snowflake',               // 雪花
    skyColor: '#ADD8E6',
  },
  {   // Level 21+: 星空梦境
    name: 'space',
    displayName: '\uD83C\uDF19 \u661F\u7A7A\u68A6\u5883',           // 🌙 星空梦境
    levelRange: [21, 999],
    bgGradient: ['#2C3E50', '#8E44AD'],
    bgAccent: '#9B59B6',
    platformTint: '#DDA0DD',
    particleType: 'star',                    // 星星
    skyColor: '#191970',
  },
];

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

    // ========== Phase 4: 增强连击系统属性 ==========
    this.comboTimer = 0;           // 连击计时器（上次连击动作的时间戳）
    this.comboTimeout = 3000;      // 连击超时时间（3秒无动作断开）
    this.maxCombo = 0;            // 本局最高连击
    this.comboMultiplier = 1.0;    // 连击加成倍率（最大50%）

    // ========== Phase 4: 成就系统属性 ==========
    this.pendingAchievement = null;     // 待显示的成就ID
    this.achievementShowTimer = 0;      // 成就显示计时器
    this.totalCoinsCollected = 0;       // 本局收集金币总数（用于成就）

    // ========== Phase 5: 容错机制增强属性 ==========
    this.maxLives = 5;                    // 最大生命值上限
    this.invincibleUntil = 0;             // 无敌截止时间戳
    this.lastLandPlatformY = 0;           // 最后着陆平台Y坐标
    this.fallCount = 0;                   // 掉落次数统计
    this.deathCount = 0;                  // 死亡次数统计
    this.isWarningActive = false;         // 掉落预警激活状态
    this.warningIntensity = 0;            // 预警强度0~1
    this.recentDeaths = [];               // 最近死亡时间戳数组（用于自适应难度）
    this.gameStartTime = 0;               // 游戏开始时间（用于自适应难度）
    this.lastAdaptiveCheck = 0;           // 上次自适应难度评估时间
    this.adaptiveFactor = {               // 自适应难度因子
      platformGap: 1.0,                   // 平台间距因子
      fragileProb: 1.0,                   // 易碎平台概率因子
      movingSpeed: 1.0,                   // 移动平台速度因子
      itemSpawnRate: 1.0,                 // 道具生成率因子
    };

    // ========== Phase 4: 随机事件系统 ==========
    this.eventManager = {
      activeEvent: null,                  // 当前激活的事件
      eventTimer: 0,                      // 事件计时器（开始时间）
      nextEventTime: 15000 + Math.random() * 30000,  // 下次事件触发时间(15-45s)
      eventEffectActive: false,           // 事件效果是否激活
    };

    // 道具管理器
    this.itemManager = new ItemManager(screenWidth, screenHeight);

    // 音频管理器
    this.audioManager = new AudioManager();

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
      justLanded: false,  // Phase 2: 着陆标志（用于挤压动画）
    };

    // ========== Phase 2: 手感优化新增属性 ==========
    // 边缘穿越过渡动画
    this.edgeTransition = { active: false, progress: 0, direction: 0 };
    // 目标方向（用于平滑翻转，而非瞬间镜像）
    this.targetDirection = 1;

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

    // ========== Phase 3: UI动画系统 ==========
    this.animationState = {
      logoFloatOffset: 0,        // Logo浮动偏移
      logoFloatPhase: 0,         // Logo浮动相位
      modalSlideProgress: 0,     // 弹窗滑入进度(0~1)
      modalAlpha: 0,             // 弹窗透明度
      starRotation: 0,           // 新纪录星星旋转角度
      starScale: 0,              // 新纪录星星缩放
      scoreRollValue: 0,         // 分数滚动当前值
      scoreRollTarget: 0,        // 分数滚动目标值
      pulseScale: 1.0,           // 按钮脉冲缩放
      lifeFlashAlpha: 0,         // 生命值闪烁透明度
      levelFlashAlpha: 0,        // 关卡闪烁透明度
      coinFlashAlpha: 0,         // 金币闪烁透明度
      loadTipIndex: 0,           // 加载提示文字索引
      loadTipTimer: 0,           // 加载提示切换计时器
    };

    // 音量控制（暂停界面使用）
    this.volumeSettings = {
      bgm: 80,       // BGM音量 0-100
      sfx: 100,      // 音效音量 0-100
      muted: false,   // 是否静音
    };

    // ========== Phase 7: 视觉特效增强 ==========
    this.particles = [];              // 活跃粒子数组
    this.MAX_PARTICLES = 50;          // 最大粒子数量限制（性能保护）
    this.screenShake = { active: false, intensity: 0, duration: 0, startTime: 0 };  // 屏幕震动状态

    // ========== Phase 6: 关卡主题与教程系统 ==========
    this.currentTheme = null;              // 当前关卡主题对象
    this.decorParticles = [];               // 装饰粒子数组（花瓣/气泡/火星/雪花/星星）
    this.showTutorial = false;             // 是否显示教程
    this.tutorialStep = 0;                  // 教程步骤(0~2)

    // ========== 商店系统 ==========
    this.showShop = false;                  // 是否显示商店
    this.totalCoinsEarned = 0;              // 累计获得金币（跨游戏持久化）
    this.playerName = '';                    // 玩家名称（用于排行榜提交）
    this._loadTotalCoins();                 // 从本地存储加载累计金币
    // 加载已保存的玩家名称
    try { this.playerName = wx.getStorageSync('playerName') || ''; } catch (e) {}
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

    // Phase 4: 重置增强连击系统
    this.comboTimer = 0;
    this.maxCombo = 0;
    this.comboMultiplier = 1.0;

    // Phase 4: 重置成就系统
    this.pendingAchievement = null;
    this.achievementShowTimer = 0;
    this.totalCoinsCollected = 0;

    // ========== Phase 5: 重置容错机制属性 ==========
    this.invincibleUntil = 0;
    this.lastLandPlatformY = 0;
    this.fallCount = 0;
    this.deathCount = 0;
    this.isWarningActive = false;
    this.warningIntensity = 0;
    this.recentDeaths = [];
    this.gameStartTime = Date.now();
    this.lastAdaptiveCheck = Date.now();
    this.adaptiveFactor = {
      platformGap: 1.0,
      fragileProb: 1.0,
      movingSpeed: 1.0,
      itemSpawnRate: 1.0,
    };

    // Phase 4: 重置随机事件系统
    this.eventManager = {
      activeEvent: null,
      eventTimer: 0,
      nextEventTime: 15000 + Math.random() * 30000,
      eventEffectActive: false,
    };

    // 初始化音频系统
    try {
      this.audioManager.init();
    } catch(e) {
      console.warn('[GameEngine] 音频初始化失败', e);
    }

    this.cameraY = 0;
    this.maxCameraY = 0;
    this.floatingScores = [];
    this.touchVelocity = 0;

    // 开始界面淡入动画初始化
    this.transitionAlpha = 0;

    // 重置UI动画状态
    this._resetAnimationState();

    var firstPlatform = this.platformManager.init();
    this.player.x = firstPlatform.x + firstPlatform.width / 2 - this.player.width / 2;
    this.player.y = firstPlatform.y - this.player.height;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.justLanded = false;  // Phase 2: 重置着陆标志
    this.targetDirection = 1;        // Phase 2: 重置目标方向
    this.edgeTransition = { active: false, progress: 0, direction: 0 };  // Phase 2: 重置边缘过渡

    // Phase 7: 重置视觉特效系统
    this.particles = [];
    this.screenShake = { active: false, intensity: 0, duration: 0, startTime: 0 };

    // Phase 6: 重置关卡主题和装饰粒子
    this.currentTheme = this.getCurrentTheme(this.level);
    this.decorParticles = [];

    // Phase 6: 教程系统初始化（检查是否首次进入）
    try {
      var hasCompletedTutorial = wx.getStorageSync('hasCompletedTutorial');
      if (!hasCompletedTutorial) {
        this.showTutorial = true;
        this.tutorialStep = 0;
        this.state = GAME_STATE.TUTORIAL;
      }
    } catch(e) {
      // 存储API不可用时跳过教程
      console.warn('[GameEngine] 教程存储检查失败', e);
    }

    this._defineButtons();
    this.render();

    // 重启游戏循环（确保从OVER/PAUSE状态回来后能持续渲染）
    this._ensureGameLoopRunning();
  }

  /**
   * 确保游戏循环在运行（用于从暂停/结束状态恢复）
   */
  _ensureGameLoopRunning() {
    var self = this;
    // 如果没有正在运行的循环，启动一个
    if (!this.animFrameId) {
      this.animFrameId = this.canvas.requestAnimationFrame(function () {
        self.gameLoop();
      });
    }
  }

  // ========== Phase 6: 关卡主题系统方法 ==========

  /**
   * 获取当前关卡对应的主题
   * @param {number} level - 当前关卡
   * @returns {Object} 主题配置对象
   */
  getCurrentTheme(level) {
    for (var i = 0; i < LEVEL_THEMES.length; i++) {
      var t = LEVEL_THEMES[i];
      if (level >= t.levelRange[0] && level <= t.levelRange[1]) {
        return t;
      }
    }
    // 默认返回最后一个主题（星空梦境）
    return LEVEL_THEMES[LEVEL_THEMES.length - 1];
  }

  /**
   * 更新当前主题（关卡变化时调用）
   */
  updateTheme() {
    var newTheme = this.getCurrentTheme(this.level);
    if (this.currentTheme !== newTheme) {
      this.currentTheme = newTheme;
      this.decorParticles = [];  // 切换主题时清空装饰粒子
      this._initDecorParticles();
    }
  }

  /**
   * 初始化装饰粒子
   */
  _initDecorParticles() {
    if (!this.currentTheme) return;
    this.decorParticles = [];
    var count = 15;  // 粒子数量
    for (var i = 0; i < count; i++) {
      this.decorParticles.push({
        x: Math.random() * this.screenWidth,
        y: Math.random() * this.screenHeight,
        size: 3 + Math.random() * 5,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: 0.5 + Math.random() * 1.5,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.05,
        alpha: 0.4 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,  // 用于闪烁动画
      });
    }
  }

  /**
   * 更新装饰粒子位置
   */
  _updateDecorParticles(factor) {
    if (!this.currentTheme || !this.decorParticles.length) return;
    var type = this.currentTheme.particleType;

    for (var i = 0; i < this.decorParticles.length; i++) {
      var p = this.decorParticles[i];

      switch (type) {
        case 'petal':  // 花瓣：飘落
          p.x += p.speedX + Math.sin(Date.now() * 0.001 + p.phase) * 0.8;
          p.y += p.speedY;
          p.rotation += p.rotationSpeed;
          break;
        case 'bubble':  // 气泡：上升
          p.x += p.speedX;
          p.y -= p.speedY;
          p.alpha = 0.3 + Math.abs(Math.sin(Date.now() * 0.003 + p.phase)) * 0.4;
          break;
        case 'spark':  // 火星：飘散上升
          p.x += p.speedX * 2;
          p.y -= p.speedY * 0.8;
          p.alpha = 0.5 + Math.sin(Date.now() * 0.005 + p.phase) * 0.4;
          break;
        case 'snowflake':  // 雪花：缓缓下落
          p.x += Math.sin(Date.now() * 0.001 + p.phase) * 1.2;
          p.y += p.speedY * 0.6;
          p.rotation += p.rotationSpeed * 0.5;
          break;
        case 'star':  // 星星：闪烁
          p.alpha = 0.3 + Math.abs(Math.sin(Date.now() * 0.002 + p.phase)) * 0.6;
          p.size = 3 + Math.sin(Date.now() * 0.003 + p.phase) * 2;
          break;
      }

      // 边界循环
      if (p.y > this.screenHeight + 20) p.y = -20;
      if (p.y < -20) p.y = this.screenHeight + 20;
      if (p.x > this.screenWidth + 20) p.x = -20;
      if (p.x < -20) p.x = this.screenWidth + 20;
    }
  }

  /**
   * 渲染装饰粒子
   */
  _renderDecorParticles(ctx) {
    if (!this.currentTheme || !this.decorParticles.length) return;
    var type = this.currentTheme.particleType;

    ctx.save();
    for (var i = 0; i < this.decorParticles.length; i++) {
      var p = this.decorParticles[i];
      ctx.globalAlpha = p.alpha;

      switch (type) {
        case 'petal':  // 花瓣：粉色椭圆
          ctx.fillStyle = '#FFB7C5';
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          break;

        case 'bubble':  // 气泡：浅蓝色圆形+高光
          ctx.fillStyle = 'rgba(79, 195, 247, 0.4)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // 高光点
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.beginPath();
          ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.25, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'spark':  // 火星：橙红色小圆
          ctx.fillStyle = '#FF4500';
          ctx.shadowColor = '#FF6B6B';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          break;

        case 'snowflake':  // 雪花：白色小十字或圆点
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          // 绘制简单雪花形状
          ctx.fillRect(-p.size * 0.15, -p.size * 0.6, p.size * 0.3, p.size * 1.2);
          ctx.fillRect(-p.size * 0.6, -p.size * 0.15, p.size * 1.2, p.size * 0.3);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          break;

        case 'star':  // 星星：淡紫色四角星
          ctx.fillStyle = '#DDA0DD';
          ctx.shadowColor = '#9B59B6';
          ctx.shadowBlur = 8;
          this._drawStar(ctx, p.x, p.y, 4, p.size, p.size * 0.5);
          ctx.shadowBlur = 0;
          break;
      }
    }
    ctx.restore();
  }

  /**
   * 绘制星星形状
   */
  _drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    var rot = Math.PI / 2 * 3;
    var step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (var i = 0; i < spikes; i++) {
      var x = cx + Math.cos(rot) * outerRadius;
      var y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;
      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  }

  // ========== Phase 6: 教程系统方法 ==========

  /**
   * 渲染教程界面
   */
  // ========== 教程渲染（Phase 6: 完整9种道具说明 + 缩小道具图标） ==========
  renderTutorial(ctx) {
    var w = this.screenWidth;
    var h = this.screenHeight;

    ctx.fillStyle = 'rgba(30, 40, 50, 0.75)';
    ctx.fillRect(0, 0, w, h);

    var isItemPage = (this.tutorialStep === 2 || this.tutorialStep === 3);
    var ph = isItemPage ? 480 : 360;
    var pw = 310;
    var px = (w - pw) / 2;
    var py = (h - ph) / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    this._roundRect(ctx, px, py, pw, ph, 18);
    ctx.fill();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
    ctx.shadowBlur = 25;
    ctx.shadowOffsetY = 8;
    ctx.fill();
    ctx.restore();

    var steps = [
      { title: '\u6B22\u8FCE\u6765\u5230\u8DF3\u8DC3\u95EF\u5171!', desc: [
        { icon: '\u2605', text: '\u7B80\u5355\u6613\u4E0A\u624B\u7684\u7AD6\u5C4F\u8DF3\u8DC3\u6E38\u620F' },
        { icon: '\u25B6', text: '\u89D2\u8272\u4F1A\u81EA\u52A8\u5728\u5E73\u53F0\u4E0A\u8DF3\u8DC3' },
        { icon: '\u2764', text: '\u51736\u6761\u547D\uFF0C\u7528\u5B8C\u5373\u6E38\u620F\u7ED3\u675F' },
      ], btn: '\u4E0B\u4E00\u6B65 \u25B6' },
      { title: '\u64CD\u4F5C\u65B9\u5F0F', desc: [
        { icon: '\u25C0', text: '\u6309\u4F4F\u5C4F\u5E55\u5DE6\u4FA7 \u2192 \u5411\u5DE6\u79FB\u52A8' },
        { icon: '\u25B6', text: '\u6309\u4F4F\u5C4F\u5E53\u53F3\u4FA7 \u2192 \u5411\u53F3\u79FB\u52A8' },
        { icon: '\u270A', text: '\u677E\u5F00\u624B\u6307 \u2192 \u60EF\u6027\u51CF\u901F\u505C\u6B62' },
        { icon: '\u23F8', text: '\u70B9\u51FB\u9876\u90E8\u6682\u505C\u94AE \u2192 \u6682\u505C\u6E38\u620F' },
      ], btn: '\u6211\u5B66\u4F1A\u4E86!' },
      { title: '\u9053\u5177\u8BF4\u660E (1/2)', desc: [
        { itemType: 'coin', color: '#FFD700', text: '\u91D1\u5E01 \u2014 \u6536\u96C6\u5F97+5\u91D1\u5E01+\u5206' },
        { itemType: 'shield', color: '#4ECDC4', text: '\u62A4\u76FE \u2014 \u514D\u6B7B\u4E00\u6B21' },
        { itemType: 'spring_shoe', color: '#FF8C00', text: '\u5F39\u7C27\u978B \u2014 \u8DF3\u8DC3\u529B\u589E\u5F3A5\u79D2' },
        { itemType: 'magnet', color: '#E74C3C', text: '\u78C1\u94C1 \u2014 \u81EA\u52A8\u5438\u5F15\u91D1\u5E018\u79D2' },
        { itemType: 'cloud', color: '#FFE4E1', text: '\u51CF\u901F\u4E91 \u2014 \u964D\u4F4E\u91CD\u529B3\u79D2' },
      ], btn: '\u67E5\u770B\u66F4\u591A \u25B6' },
      { title: '\u9053\u5177\u8BF4\u660E (2/2)', desc: [
        { itemType: 'jetpack', color: '#FF4500', text: '\u55B7\u6C14\u80CC\u5305 \u2014 \u5411\u4E0A\u98DE\u884C3\u79D2' },
        { itemType: 'double_score', color: '#FFD700', text: '\u53CC\u500D\u5F97\u5206 \u2014 10\u79D2\u5185\u5F97\u5206\u7FFB\u500D' },
        { itemType: 'invincible', color: '#FF69B4', text: '\u65E0\u654C\u661F \u2014 5\u79D2\u5168\u65E0\u654C' },
        { itemType: 'diamond', color: '#9B59B6', text: '\u94BB\u77F3\u5B9D\u77F3 \u2014 \u5373\u65F6+200\u5206' },
      ], btn: '\u5F00\u59CB\u6E38\u620F!' },
    ];

    var step = steps[this.tutorialStep] || steps[0];

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 21px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(step.title, w / 2, py + 42);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 24, py + 68);
    ctx.lineTo(px + pw - 24, py + 68);
    ctx.stroke();

    var lineH = isItemPage ? 48 : 42;
    var listStartY = py + 86;
    for (var li = 0; li < step.desc.length; li++) {
      var entry = step.desc[li];
      var ly = listStartY + li * lineH;

      ctx.save();
      ctx.fillStyle = 'rgba(78, 205, 196, 0.05)';
      this._roundRect(ctx, px + 18, ly - 15, pw - 36, isItemPage ? 40 : 34, 10);
      ctx.fill();
      ctx.restore();

      if (entry.itemType) {
        this._renderTutorialItemIcon(ctx, px + 32, ly + 3, 26, entry.itemType);
      } else {
        ctx.font = 'bold 17px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = entry.color || '#4ECDC4';
        ctx.fillText(entry.icon, px + 32, ly + 3);
      }

      ctx.fillStyle = '#333333';
      ctx.font = isItemPage ? '14px sans-serif' : '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(entry.text, px + 64, ly + 3);
    }

    var dotCX = w / 2;
    var dotCY = py + ph - (isItemPage ? 100 : 82);
    for (var di = 0; di < steps.length; di++) {
      ctx.beginPath();
      ctx.arc(dotCX + (di - 1.5) * 18, dotCY, 5, 0, Math.PI * 2);
      ctx.fillStyle = di === this.tutorialStep ? '#4ECDC4' : 'rgba(180, 190, 200, 0.4)';
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(180, 190, 200, 0.5)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u8DF3\u8FC7', px + pw - 16, py + 22);

    var btnY = py + ph - (isItemPage ? 68 : 56);
    var btnH = 44;
    ctx.save();
    var grad = ctx.createLinearGradient(px + 35, btnY, px + pw - 35, btnY + btnH);
    grad.addColorStop(0, '#4ECDC4');
    grad.addColorStop(1, '#44A08D');
    ctx.fillStyle = grad;
    this._roundRect(ctx, px + 35, btnY, pw - 70, btnH, 14);
    ctx.fill();
    ctx.shadowColor = 'rgba(78, 205, 196, 0.35)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(step.btn, w / 2, btnY + btnH / 2);

    this.buttons.tutorialNext = { x: px + 35, y: btnY, w: pw - 70, h: btnH };
    this.buttons.tutorialSkip = { x: px + pw - 45, y: py + 10, w: 50, h: 28 };
  }

  /**
   * 绘制教程中的缩小版道具图标（与游戏内渲染风格一致）
   */
  _renderTutorialItemIcon(ctx, cx, cy, size, itemType) {
    var s = size;
    var half = s / 2;
    ctx.save();

    switch (itemType) {
      case 'coin':
        ctx.fillStyle = '#FFD700';
        ctx.beginPath(); ctx.arc(cx, cy, half - 1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#B8860B'; ctx.font = 'bold ' + Math.round(s * 0.55) + 'px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', cx, cy);
        break;

      case 'shield':
        ctx.fillStyle = '#4ECDC4';
        ctx.beginPath();
        ctx.moveTo(cx, cy - half); ctx.lineTo(cx + half, cy - half * 0.3);
        ctx.lineTo(cx + half * 0.85, cy + half); ctx.lineTo(cx, cy + half * 0.8);
        ctx.lineTo(cx - half * 0.85, cy + half); ctx.lineTo(cx - half, cy - half * 0.3);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#FFF'; ctx.font = 'bold ' + Math.round(s * 0.45) + 'px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('S', cx, cy);
        break;

      case 'spring_shoe':
        ctx.fillStyle = '#FF8C00';
        this._roundRect(ctx, cx - half * 0.8, cy - half * 0.2, s * 0.8, s * 0.65, 3); ctx.fill();
        ctx.strokeStyle = '#CC7000'; ctx.lineWidth = 1.5;
        for (var si = 0; si < 3; si++) {
          ctx.beginPath(); ctx.moveTo(cx - half * 0.4 + si * s * 0.25, cy + half * 0.5);
          ctx.lineTo(cx - half * 0.28 + si * s * 0.25, cy); ctx.stroke();
        }
        break;

      case 'magnet':
        ctx.fillStyle = '#E74C3C';
        this._roundRect(ctx, cx - half, cy - half * 0.6, s * 0.38, s * 0.75, 2); ctx.fill();
        this._roundRect(ctx, cx + half * 0.27, cy - half * 0.6, s * 0.38, s * 0.75, 2); ctx.fill();
        this._roundRect(ctx, cx - half * 0.6, cy + half * 0.05, s * 1.2, s * 0.3, 2); ctx.fill();
        break;

      case 'cloud':
        ctx.fillStyle = '#FFE4E1';
        ctx.beginPath(); ctx.arc(cx - s * 0.18, cy + s * 0.12, s * 0.32, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx, cy, s * 0.38, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + s * 0.18, cy + s * 0.12, s * 0.32, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#999'; ctx.font = Math.round(s * 0.38) + 'px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('\u6162', cx, cy);
        break;

      case 'jetpack':
        ctx.fillStyle = '#FF4500';
        this._roundRect(ctx, cx - half * 0.7, cy - half * 0.7, s * 0.65, s * 0.65, 3); ctx.fill();
        ctx.fillStyle = '#FF6600';
        ctx.beginPath(); ctx.moveTo(cx - half * 0.4, cy + half * 0.1);
        ctx.lineTo(cx + half * 0.4, cy + half * 0.1); ctx.lineTo(cx, cy + half * 0.9); ctx.closePath(); ctx.fill();
        break;

      case 'double_score':
        ctx.fillStyle = '#FFD700';
        ctx.beginPath(); ctx.arc(cx, cy, half - 1, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#DAA520'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#B8860B'; ctx.font = 'bold ' + Math.round(s * 0.42) + 'px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('x2', cx, cy);
        break;

      case 'invincible':
        ctx.fillStyle = '#FF69B4';
        ctx.save(); ctx.translate(cx, cy);
        ctx.beginPath();
        for (var ii = 0; ii < 5; ii++) {
          var oa = (ii * 72 - 90) * Math.PI / 180;
          var ia = ((ii * 72) + 36 - 90) * Math.PI / 180;
          var or = half, ir = half * 0.45;
          if (ii === 0) ctx.moveTo(Math.cos(oa) * or, Math.sin(oa) * or);
          else ctx.lineTo(Math.cos(oa) * or, Math.sin(oa) * or);
          ctx.lineTo(Math.cos(ia) * ir, Math.sin(ia) * ir);
        }
        ctx.closePath(); ctx.fill(); ctx.restore();
        break;

      case 'diamond':
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#9B59B6';
        this._roundRect(ctx, -s * 0.32, -s * 0.32, s * 0.64, s * 0.64, 3); ctx.fill();
        ctx.strokeStyle = '#C39BD3'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.arc(-s * 0.1, -s * 0.1, s * 0.12, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
    }
    ctx.restore();
  }

  /**
   * 处理教程界面触摸事件
   * @returns {string|null} 返回操作类型或null
   */
  handleTutorialTouch(x, y) {
    var w = this.screenWidth;
    var h = this.screenHeight;
    var isItemPage = (this.tutorialStep === 2 || this.tutorialStep === 3);
    var pw = 310, ph = isItemPage ? 480 : 360;
    var px = (w - pw) / 2;
    var py = (h - ph) / 2;

    // 检测主按钮点击（"下一步"/"开始游戏"）
    var btnY = py + ph - (isItemPage ? 68 : 56);
    var btnH = 44;
    if (x >= px + 35 && x <= px + pw - 35 && y >= btnY && y <= btnY + btnH) {
      this.tutorialStep++;
      if (this.tutorialStep >= 4) {
        try { wx.setStorageSync('hasCompletedTutorial', true); } catch(e) {}
        this.showTutorial = false;
        this.state = GAME_STATE.IDLE;
        return 'tutorialComplete';
      }
      return 'tutorialNext';
    }

    // 检测"跳过教程"
    if (x >= px + pw - 45 && x <= px + pw + 5 && y >= py + 10 && y <= py + 38) {
      try { wx.setStorageSync('hasCompletedTutorial', true); } catch(e) {}
      this.showTutorial = false;
      this.state = GAME_STATE.IDLE;
      return 'tutorialSkip';
    }

    return null;
  }

  // ========== 商店系统 ==========

  /** 商店商品定义 */
  _getShopItems() {
    return [
      { id: 'extra_life', name: '额外生命', desc: '本局游戏 +1 最大生命值', icon: '\u2764\uFE0F', cost: 100, color: '#FF6B6B' },
      { id: 'shield_start', name: '护盾开局', desc: '开局自带护盾保护', icon: '\uD83D\uDEE1', cost: 150, color: '#4ECDC4' },
      { id: 'magnet_start', name: '磁铁开局', desc: '开局自带磁铁(15秒)', icon: '\uD83D\uDEE2', cost: 180, color: '#E74C3C' },
      { id: 'double_score', name: '双倍得分', desc: '前30秒得分x2', icon: '\u00D732', cost: 250, color: '#FFD700' },
    ];
  }

  /** 从本地存储加载累计金币 */
  _loadTotalCoins() {
    try {
      this.totalCoinsEarned = wx.getStorageSync('totalCoinsEarned') || 0;
    } catch (e) {
      this.totalCoinsEarned = 0;
    }
  }

  /** 保存累计金币到本地存储 */
  _saveTotalCoins() {
    try {
      wx.setStorageSync('totalCoinsEarned', this.totalCoinsEarned);
    } catch (e) { /* ignore */ }
  }

  /** 购买商品 */
  purchaseItem(itemId) {
    var items = this._getShopItems();
    var item = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === itemId) { item = items[i]; break; }
    }
    if (!item || this.totalCoinsEarned < item.cost) return false;

    this.totalCoinsEarned -= item.cost;
    this._saveTotalCoins();

    // 应用效果
    switch (itemId) {
      case 'extra_life':
        this.maxLives = Math.min(this.maxLives + 1, 9);
        this.lives = Math.min(this.lives + 1, this.maxLives);
        break;
      case 'shield_start':
        this.shieldActive = true;
        break;
      case 'magnet_start':
        if (this.itemManager) { this.itemManager.activateEffect('magnet'); }
        break;
      case 'double_score':
        this.comboMultiplier = 2.0;
        // 30秒后恢复
        var self = this;
        setTimeout(function () { self.comboMultiplier = 1.0; }, 30000);
        break;
    }
    return true;
  }

  /** 渲染商店界面 */
  renderShop(ctx) {
    var w = this.screenWidth;
    var h = this.screenHeight;

    // 深色遮罩
    ctx.fillStyle = 'rgba(20, 25, 30, 0.8)';
    ctx.fillRect(0, 0, w, h);

    // 面板
    var pw = 320, ph = 460;
    var px = (w - pw) / 2;
    var py = (h - ph) / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    this._roundRect(ctx, px, py, pw, ph, 18);
    ctx.fill();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 25;
    ctx.shadowOffsetY = 8;
    ctx.fill();
    ctx.restore();

    // 标题栏
    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\uD83C\uDFEA \u5546\u5E97', w / 2, py + 38);  // 🛒 商店

    // 金币余额
    ctx.fillStyle = '#FFB800';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('\uD83E\uDE99 ' + this.totalCoinsEarned, px + pw - 20, py + 38);

    // 分隔线
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 20, py + 62);
    ctx.lineTo(px + pw - 20, py + 62);
    ctx.stroke();

    // 商品列表
    var items = this._getShopItems();
    var itemH = 85;
    var itemStartY = py + 78;

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var iy = itemStartY + i * itemH;
      var canAfford = this.totalCoinsEarned >= item.cost;

      // 商品卡片背景
      ctx.save();
      ctx.fillStyle = canAfford ? 'rgba(78,205,196,0.06)' : 'rgba(200,200,200,0.08)';
      this._roundRect(ctx, px + 15, iy, pw - 30, itemH - 6, 12);
      ctx.fill();
      ctx.restore();

      // 图标
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.icon, px + 30, iy + (itemH - 6) / 2);

      // 名称
      ctx.fillStyle = canAfford ? '#2D3436' : '#999999';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(item.name, px + 68, iy + 22);

      // 描述
      ctx.fillStyle = canAfford ? '#666666' : '#BBBBBB';
      ctx.font = '12px sans-serif';
      ctx.fillText(item.desc, px + 68, iy + 44);

      // 价格按钮
      var btnX = px + pw - 90;
      var btnY = iy + 14;
      var btnW = 70, btnH = 32;

      ctx.save();
      if (canAfford) {
        ctx.fillStyle = item.color;
        this._roundRect(ctx, btnX, btnY, btnW, btnH, btnH / 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
      } else {
        ctx.fillStyle = 'rgba(200,200,200,0.3)';
        this._roundRect(ctx, btnX, btnY, btnW, btnH, btnH / 2);
        ctx.fill();
        ctx.fillStyle = '#AAAAAA';
      }
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.cost + '', btnX + btnW / 2, btnY + btnH / 2);
      ctx.restore();

      // 记录按钮位置（用于触摸检测）
      if (!this.shopButtons) this.shopButtons = [];
      this.shopButtons[i] = { x: btnX, y: btnY, w: btnW, h: btnH, itemId: item.id, canAfford: canAfford };
    }

    // 关闭按钮
    var closeBtnY = py + ph - 48;
    ctx.save();
    ctx.fillStyle = 'rgba(200,200,200,0.2)';
    this._roundRect(ctx, px + pw/2 - 50, closeBtnY, 100, 36, 18);
    ctx.fill();
    ctx.fillStyle = '#555555';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u5173\u95ED', w / 2, closeBtnY + 18);  // 关闭
    ctx.restore();

    this.buttons.shopClose = { x: px + pw/2 - 50, y: closeBtnY, w: 100, h: 36 };
  }

  /** 处理商店触摸事件 */
  handleShopTouch(x, y) {
    // 关闭按钮
    if (this.buttons.shopClose && this._hitTest(x, y, this.buttons.shopClose)) {
      this.showShop = false;
      this.shopButtons = null;
      return 'shopClose';
    }
    // 商品按钮
    if (this.shopButtons) {
      for (var i = 0; i < this.shopButtons.length; i++) {
        var btn = this.shopButtons[i];
        if (btn && btn.canAfford && this._hitTest(x, y, btn)) {
          var success = this.purchaseItem(btn.itemId);
          if (success) {
            this.audioManager.playSound(AudioManager.SOUNDS.BUTTON);  // 使用按钮音效
          }
          return 'shopPurchase';  // 保持商店打开，让用户看到余额变化
        }
      }
    }
    return null;
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

    // 开始按钮：居中，垂直中间偏下位置，尺寸200x56（Phase 3: 增大）
    this.buttons.startGame = { x: centerX - 100, y: h / 2 + 20, w: 200, h: 56 };

    // 排行榜按钮：开始按钮下方16px，尺寸160x44，描边样式
    this.buttons.ranking = { x: centerX - 80, y: h / 2 + 88, w: 160, h: 44 };

    // 商店按钮：排行榜下方12px，尺寸120x36
    this.buttons.shop = { x: centerX - 60, y: h / 2 + 144, w: 120, h: 36 };

    // 结束弹窗按钮：水平排列
    // 面板宽度320px，按钮140x48，间距16px
    var panelW = Math.min(320, w - 30);
    var btnW = 140, btnH = 48, btnGap = 16;
    var btnStartX = centerX - btnW - btnGap / 2;

    // 「再来一局」红色渐变按钮 140x48
    this.buttons.restart = { x: btnStartX, y: 0, w: btnW, h: btnH };  // Y坐标在render时动态计算

    // 「返回首页」灰色按钮 140x48
    this.buttons.home = { x: btnStartX + btnW + btnGap, y: 0, w: btnW, h: btnH };

    // 「提交分数」链接文字在按钮下方
    this.buttons.submitScore = { x: centerX - 80, y: 0, w: 160, h: 32 };  // Y坐标动态计算

    // 暂停按钮：右下角（避开微信胶囊按钮区域）
    // 胶囊按钮在右上角(约w-95~w-5, y=0~50)，暂停按钮放在HUD栏右侧偏下
    var menuBtn = {};
    try { menuBtn = wx.getMenuButtonBoundingClientRect(); } catch(e) {}
    var menuBottom = (menuBtn.height || 32) + (menuBtn.top || 6) + 8;
    this.buttons.pause = {
      x: w - 52,
      y: Math.max(menuBottom, 20),
      w: 38,
      h: 30
    };

    // 音量滑块区域（在_renderPauseOverlay中动态更新坐标）
    this.buttons.bgmVolumeBar = null;
    this.buttons.sfxVolumeBar = null;
  }

  start() {
    this.state = GAME_STATE.PLAYING;
    this.lastTime = Date.now();

    // 开始播放BGM
    this.audioManager.playBGM();

    this.gameLoop();
  }

  pause() {
    if (this.state === GAME_STATE.PLAYING) {
      this.state = GAME_STATE.PAUSED;
      // 不再取消动画循环！gameLoop在PAUSED状态仍会render()
      // 暂停BGM
      this.audioManager.pauseBGM();
      this.render();  // 立即渲染一帧暂停界面
    }
  }

  resume() {
    if (this.state === GAME_STATE.PAUSED) {
      this.state = GAME_STATE.PLAYING;
      this.lastTime = Date.now();
      // 恢复BGM
      this.audioManager.resumeBGM();
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
    if (this.state === GAME_STATE.PLAYING) {
      var now = Date.now();
      var dt = Math.min(now - this.lastTime, 33);
      this.lastTime = now;
      this.update(dt);
    }
    // 始终渲染（包括PAUSED/OVER/IDLE状态，确保滑块等UI实时更新）
    this.render();
    this.animFrameId = this.canvas.requestAnimationFrame(() => this.gameLoop());
  }

  update(dt) {
    var factor = dt / 16.67;

    // 重力应用（Phase 4: 支持事件系统的重力修改）
    var gravityMod = this._currentGravityMod || 1.0;
    this.player.vy += PHYSICS.gravity * factor * gravityMod;
    if (this.player.vy > PHYSICS.maxFallSpeed) this.player.vy = PHYSICS.maxFallSpeed;

    // 惯性衰减机制（Phase 2: 分阶段衰减 - 更自然的滑行感）
    // 当没有触摸输入时，速度逐渐衰减而不是立即归零
    // Phase 4: 支持事件系统的速度修改
    var speedMod = this._currentSpeedMod || 1.0;
    if (Math.abs(this.touchVelocity) > 0) {
      // 使用触摸速度作为目标，实现平滑过渡（应用速度修改）
      var targetVel = this.touchVelocity * speedMod;
      this.player.vx += (targetVel - this.player.vx) * PHYSICS.moveAcceleration * factor;
    } else {
      // Phase 2: 分阶段惯性衰减（高速慢停/中速正常/低速快停）
      if (Math.abs(this.player.vx) > 3) {
        this.player.vx *= 0.94;  // 高速时慢衰减（保持惯性滑行）
      } else if (Math.abs(this.player.vx) > 0.5) {
        this.player.vx *= 0.90;  // 中速时正常衰减
      } else {
        this.player.vx *= 0.85;  // 低速时快速停止
        if (Math.abs(this.player.vx) < 0.5) {  // 归零阈值提高到0.5
          this.player.vx = 0;
        }
      }
    }

    // Phase 2: 方向平滑插值（避免瞬间翻转）
    this.player.direction += (this.targetDirection - this.player.direction) * 0.15;

    this.player.x += this.player.vx * factor;
    this.player.y += this.player.vy * factor;

    // 屏幕边缘安全区（Phase 2: 平滑过渡动画，避免瞬移突兀感）
    if (!this.edgeTransition.active) {
      if (this.player.x + this.player.width < -30) {
        this.edgeTransition.active = true;
        this.edgeTransition.progress = 0;
        this.edgeTransition.direction = -1;  // 向左穿越
      } else if (this.player.x > this.screenWidth + 30) {
        this.edgeTransition.active = true;
        this.edgeTransition.progress = 0;
        this.edgeTransition.direction = 1;   // 向右穿越
      }
    }

    // Phase 2: 更新边缘过渡动画进度（10帧完成过渡）
    if (this.edgeTransition.active) {
      this.edgeTransition.progress += 0.1;
      if (this.edgeTransition.progress >= 1) {
        // 过渡完成，实际传送
        if (this.edgeTransition.direction === -1) {
          this.player.x = this.screenWidth;
        } else {
          this.player.x = -this.player.width;
        }
        this.edgeTransition.active = false;
        this.edgeTransition.progress = 0;
      }
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
    var collectedItem = this.itemManager.update(this.cameraY, this.player);
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

    // 更新UI动画系统
    this._updateAnimations(factor);

    // Phase 5: 掉落预警检测
    this._checkFallWarning();

    // Phase 5: 易碎平台破碎延迟更新
    this._updateFragilePlatforms(dt);

    // Phase 4: 随机事件系统更新
    this._updateEvents(dt);

    // Phase 5: 难度自适应评估（每30秒）
    this._updateAdaptiveDifficulty();

    // Phase 6: 更新装饰粒子
    this._updateDecorParticles(factor);

    // Phase 6: 检查主题切换（关卡变化时更新）
    this.updateTheme();

    // Phase 7: 更新粒子系统
    this._updateParticles(dt);
  }

  /**
   * 平台碰撞检测（Phase 2: 增强着陆检测 - 更宽松的判定）
   * - 碰撞容差从20px增加到25px
   * - 高速下落时额外宽容5px
   * - 自动吸附到平台表面（±5px内）
   */
  checkPlatformCollision() {
    var platforms = this.platformManager.getPlatforms();
    var pb = this.player.y + this.player.height;  // 角色底部Y坐标
    var pl = this.player.x;                        // 角色左侧X坐标
    var pr = this.player.x + this.player.width;    // 角色右侧X坐标

    for (var i = 0; i < platforms.length; i++) {
      var p = platforms[i];
      if (p.destroyed) continue;

      // Phase 2: 更宽松的碰撞判定（容差从20px增加到25px，高速下落额外+5px）
      var tolerance = 25;
      if (this.player.vy > 8) tolerance += 5;  // 高速下落额外宽容

      if (pb >= p.y - 5 && pb <= p.y + tolerance && pr > p.x && pl < p.x + p.width) {
        // 自动吸附：当脚底接近平台顶部（±5px内）时，精确对齐
        if (Math.abs(pb - p.y) <= 5) {
          this.player.y = p.y - this.player.height;
        } else {
          this.player.y = p.y - this.player.height;
        }

        // 记录当前落脚的平台（用于道具兜底收集）
        this.itemManager.setLandedPlatform(p);

        // Phase 2: 设置着陆标志（用于挤压动画）
        this.player.justLanded = true;

        // 根据平台类型处理跳跃
        switch (p.type) {
          case 'normal':
            this.player.vy = PHYSICS.jumpForce;
            this.audioManager.playSound(AudioManager.SOUNDS.JUMP);
            // Phase 7: 普通跳跃粒子
            this._emitParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height, {
              count: 8, type: 'jump', color: '#FFFFFF', speed: 60, life: 0.3, size: 6
            });
            break;
          case 'spring':
            this.player.vy = PHYSICS.springForce;
            this.audioManager.playSound(AudioManager.SOUNDS.SPRING);
            // Phase 7: 弹簧跳跃粒子（金黄色星星）
            this._emitParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height, {
              count: 15, type: 'star', color: '#FFD700', speed: 100, life: 0.5, size: 8
            });
            break;
          case 'fragile':
            this.player.vy = PHYSICS.jumpForce;
            // Phase 5: 不再立即破坏和扣命，而是启动破碎延迟
            if (!p.crackTimer) {
              // 首次踩到，启动计时器
              p.crackTimer = Date.now();
              p.crackStage = 0;
            }
            this.audioManager.playSound(AudioManager.SOUNDS.JUMP);
            break;
          case 'moving':
            this.player.vy = PHYSICS.jumpForce;
            this.audioManager.playSound(AudioManager.SOUNDS.JUMP);
            break;
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
   * 添加得分（Phase 4: 增强连击系统 - 带超时检测和倍率加成）
   * @param {number} points - 基础得分
   */
  addScore(points) {
    var now = Date.now();

    // 连击系统：检测是否在超时时间内
    if (now - this.comboTimer < this.comboTimeout && this.comboTimer > 0) {
      this.combo++; // 继续连击
    } else {
      this.combo = 1; // 超时，重置连击
    }
    this.comboTimer = now;

    // 记录最高连击
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }

    // 计算连击加成：每10连击+5%，最高50%
    this.comboMultiplier = 1 + Math.min(Math.floor(this.combo / 10) * 0.05, 0.5);

    // 应用双倍得分道具效果
    var doubleScoreActive = this.itemManager.hasEffect('doubleScore');
    if (doubleScoreActive) {
      this.comboMultiplier *= 2; // 双倍得分道具
    }

    // 计算最终得分
    var finalPoints = Math.floor(points * this.comboMultiplier);
    this.score += finalPoints;

    if (this.onScoreUpdate) this.onScoreUpdate(this.score);

    // Phase 7: 连击>10时发射彩虹彩带
    if (this.combo > 10 && this.combo % 10 === 0) {
      this._emitParticles(this.player.x + this.player.width / 2, this.player.y, {
        count: 25, type: 'confetti', speed: 100, life: 0.8, size: 10
      });
    }

    // Phase 4: 检测成就
    this._checkAchievements();

    // 关卡升级检测
    var newLevel = Math.floor(this.score / 100) + 1;
    if (newLevel !== this.level) {
      this.level = newLevel;
      // Phase 5: 每10关回复1命（最多maxLives）
      if (newLevel % 10 === 0 && this.lives < this.maxLives) {
        this.lives++;
        this.triggerLifeFlash(); // 触发生命值闪烁动画
      }
      // 触发关卡升级闪烁动画（Phase 3）
      this.triggerLevelFlash();
      if (this.onLevelUpdate) this.onLevelUpdate(this.level);
    }
  }

  /**
   * 游戏结束处理（Phase 5: 增强容错 - 无敌时间 + 多层安全网）
   * - 无敌期内直接return（不扣命）
   * - 有护盾时消耗护盾免死
   * - 有生命时扣命并重生（设置3秒无敌时间）
   * - 0命时真正结束游戏
   */
  gameOver() {
    // Phase 5: 检查无敌期（3秒内不再扣命）
    var now = Date.now();
    if (now < this.invincibleUntil) {
      // 无敌期间，直接重生不扣命
      this.respawnPlayer();
      return;
    }

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
    this.deathCount++;
    this.audioManager.playSound(AudioManager.SOUNDS.HURT);

    // Phase 7: 扣命粒子 + 屏幕震动
    this._emitParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, {
      count: 6, type: 'break', color: '#FF0000', speed: 80, life: 0.3, size: 8
    });
    this.triggerScreenShake(5, 200);

    // Phase 5: 记录死亡时间戳（用于自适应难度）
    this.recentDeaths.push(now);
    // 只保留最近60秒的死亡记录
    this.recentDeaths = this.recentDeaths.filter(function(t) { return now - t < 60000; });

    // 触发生命值闪烁
    this.triggerLifeFlash();

    if (this.lives > 0) {
      // 还有命，重生
      // Phase 5: 设置3秒无敌时间
      this.invincibleUntil = now + 3000;
      this.respawnPlayer();
      return;
    }

    // 0命了，真正游戏结束
    this.state = GAME_STATE.OVER;

    // 保存本局金币到累计余额（商店系统）
    this.totalCoinsEarned += this.coins;
    this._saveTotalCoins();

    // 不再停止gameLoop！让循环继续运行以渲染结束弹窗
    // if (this.animFrameId) { this.canvas.cancelAnimationFrame(this.animFrameId); this.animFrameId = null; }
    this.scoreManager.updateBestScore(this.score);

    // Phase 7: 死亡爆炸粒子 + 强屏幕震动
    this._emitParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, {
      count: 35, type: 'death', speed: 150, life: 1.0, size: 14
    });
    this.triggerScreenShake(10, 500);

    // 停止BGM + 播放结束音效
    this.audioManager.stopBGM();
    var bestScore = this.scoreManager.getBestScore();
    if (this.score >= bestScore && this.score > 0) {
      this.audioManager.playSound(AudioManager.SOUNDS.NEW_RECORD);
    } else {
      this.audioManager.playSound(AudioManager.SOUNDS.GAME_OVER);
    }

    // 结束弹窗淡入动画初始化
    this.transitionAlpha = 0;

    // 初始化分数滚动动画（Phase 3）
    this._initScoreRoll(this.score);

    if (this.onGameOver) this.onGameOver(this.score, this.scoreManager.getBestScore());
    this.render();
  }

  // ========== Phase 3: 道具系统 ==========

  /**
   * 处理道具收集效果
   * @param {string} itemType - 道具类型字符串 ('coin', 'shield' 等)
   */
  handleItemCollect(itemType) {
    // 获取道具位置（用于粒子效果）
    var itemX = this.player.x + this.player.width / 2;
    var itemY = this.player.y + this.player.height / 2;

    switch (itemType) {
      case 'coin':
        this.coins += 5;  // 每个金币+5
        this.totalCoinsCollected = (this.totalCoinsCollected || 0) + 1;  // 累计统计
        this.addScore(50); // 金币额外加50分
        this.combo++;
        // 触发金币收集闪烁（Phase 3）
        this.triggerCoinFlash();
        this.audioManager.playSound(AudioManager.SOUNDS.COIN);
        // Phase 7: 金币收集粒子
        this._emitParticles(itemX, itemY, {
          count: 10, type: 'coin', color: '#FFD700', speed: 80, life: 0.4, size: 12
        });
        // 金币浮动文字（+50）
        this._createFloatingScore(50, itemX, itemY, '#FFD700');
        if (this.combo > 1) {
          this.addScore(this.combo * 5); // 连击奖励
        }
        // 通知页面更新金币数据（确保同步）
        if (this.onCoinChange) { this.onCoinChange(this.coins); }
        break;
      case 'shield':
        this.shieldActive = true;
        this.audioManager.playSound(AudioManager.SOUNDS.ITEM_SHIELD);
        // Phase 7: 护盾收集粒子
        this._emitParticles(itemX, itemY, {
          count: 20, type: 'star', color: '#4ECDC4', speed: 60, life: 0.6, size: 8
        });
        break;
      case 'spring_shoe':
        this.addScore(25);
        this.audioManager.playSound(AudioManager.SOUNDS.ITEM_SPRING);
        break;
      case 'magnet':
        this.addScore(25);
        this.audioManager.playSound(AudioManager.SOUNDS.ITEM_MAGNET);
        break;
      case 'cloud':
        this.addScore(25); // 道具基础分
        break;
      case 'jetpack':
        // 喷气背包：向上飞行3秒
        this.player.vy = PHYSICS.springForce * 0.8; // 向上冲力
        this.audioManager.playSound(AudioManager.SOUNDS.SPRING);
        break;
      case 'double_score':
        // 双倍得分：效果已在addScore中处理
        this.addScore(25);
        this.triggerCoinFlash();
        this.audioManager.playSound(AudioManager.SOUNDS.COIN);
        break;
      case 'invincible':
        // 无敌星：设置无敌时间
        this.invincibleUntil = Date.now() + ITEM_CONFIG.invincible.duration;
        this.itemManager.activeEffects.invincible = { endTime: Date.now() + ITEM_CONFIG.invincible.duration };
        this.shieldActive = true; // 同时激活护盾
        this.audioManager.playSound(AudioManager.SOUNDS.ITEM_SHIELD);
        break;
      case 'diamond':
        // 钻石：即时+200分
        this.addScore(200);
        this.triggerCoinFlash();
        this.audioManager.playSound(AudioManager.SOUNDS.COIN);
        break;
    }
  }

  /**
   * 处理掉落死亡（Phase 5: 多层安全网机制）
   * - 第1次: 完全免死（不扣命）
   * - 第2次: 免死但扣1命
   * - 第3次及以后: 正常gameOver()
   */
  handleFallDeath() {
    // 增加掉落计数
    this.fallCount++;

    if (this.fallCount === 1) {
      // 第1次掉落：完全免死（保留原有安全网机制）
      this.firstFall = false;
      this.respawnPlayer();
      return; // 不扣命
    }

    if (this.fallCount === 2) {
      // 第2次掉落：免死但扣1命（如果还有命的话）
      if (this.lives > 0) {
        this.lives--;
        this.deathCount++;
        this.audioManager.playSound(AudioManager.SOUNDS.HURT);
        this.triggerLifeFlash();
        // 设置无敌时间
        this.invincibleUntil = Date.now() + 3000;
        if (this.lives >= 0) {
          this.respawnPlayer();
          return;
        }
      }
    }

    // 第3次及以后：直接进入结束状态（不再走gameOver的重复生命检查）
    this.state = GAME_STATE.OVER;

    // 保存本局金币到累计余额（商店系统）
    this.totalCoinsEarned += this.coins;
    this._saveTotalCoins();
    this.scoreManager.updateBestScore(this.score);

    // 死亡爆炸粒子 + 强屏幕震动
    this._emitParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, {
      count: 35, type: 'death', speed: 150, life: 1.0, size: 14
    });
    this.triggerScreenShake(10, 500);

    // 停止BGM + 播放结束音效
    this.audioManager.stopBGM();
    var bestScore = this.scoreManager.getBestScore();
    if (this.score >= bestScore && this.score > 0) {
      this.audioManager.playSound(AudioManager.SOUNDS.NEW_RECORD);
    } else {
      this.audioManager.playSound(AudioManager.SOUNDS.GAME_OVER);
    }

    // 结束弹窗淡入动画初始化
    this.transitionAlpha = 0;
    this._initScoreRoll(this.score);
    if (this.onGameOver) this.onGameOver(this.score, this.scoreManager.getBestScore());
    this.render();
  }

  /**
   * 重生角色到最安全可见平台上方（Phase 5: 智能重生点 - 评分算法）
   * 评分规则：
   * - 普通平台+100分 / 弹簧+80 / 移动+50 / 易碎-50
   * - 距离屏幕中心越近越好（减分）
   * - 在屏幕上半部分优先（+30分）
   */
  respawnPlayer() {
    var platforms = this.platformManager.getPlatforms();
    var bestPlatform = null;
    var bestScore = -Infinity;

    var screenCenterX = this.screenWidth / 2;
    var screenCenterY = this.screenHeight / 2;

    for (var i = 0; i < platforms.length; i++) {
      var p = platforms[i];
      if (p.destroyed) continue;
      // 跳过正在破碎的易碎平台
      if (p.type === 'fragile' && p.crackStage && p.crackStage > 0) continue;

      var screenY = p.y - this.cameraY;
      // 只考虑可见范围内的平台
      if (screenY < -50 || screenY > this.screenHeight + 50) continue;

      // 计算平台中心X坐标
      var platformCenterX = p.x + p.width / 2;

      // ========== 评分系统 ==========
      var score = 0;

      // 1. 平台类型评分
      switch (p.type) {
        case 'normal':
          score += 100;
          break;
        case 'spring':
          score += 80;  // 弹簧也不错，但可能弹太高
          break;
        case 'moving':
          score += 50;  // 移动平台不太稳定
          break;
        case 'fragile':
          score -= 50;  // 易碎平台危险
          break;
        default:
          score += 80;
      }

      // 2. 距离屏幕中心的水平距离（越近越好）
      var horizontalDist = Math.abs(platformCenterX - screenCenterX);
      score -= horizontalDist * 0.5;  // 每像素距离扣0.5分

      // 3. 在屏幕上半部分优先（更安全，有更多反应时间）
      if (screenY < screenCenterY) {
        score += 30;
      }

      // 4. 平台越宽越好（更容易着陆）
      score += p.width * 0.3;

      // 更新最佳平台
      if (score > bestScore) {
        bestScore = score;
        bestPlatform = p;
      }
    }

    if (bestPlatform) {
      // 重生到最佳平台上方
      this.player.x = bestPlatform.x + bestPlatform.width / 2 - this.player.width / 2;
      this.player.y = bestPlatform.y - this.player.height - 10;
      this.player.vx = 0;
      this.player.vy = 0;
      // 记录最后着陆平台位置
      this.lastLandPlatformY = bestPlatform.y;
    } else {
      // 没找到合适平台，重置到屏幕底部中央
      this.player.x = this.screenWidth / 2 - this.player.width / 2;
      this.player.y = this.cameraY + this.screenHeight - 100;
      this.player.vx = 0;
      this.player.vy = 0;
      this.lastLandPlatformY = this.player.y;
    }
  }

  // ========== Phase 4: 随机事件系统 ==========

  /**
   * 更新随机事件（在update中调用）
   * - 检测是否触发新事件
   * - 更新当前事件持续时间
   * @param {number} dt - 时间增量
   */
  _updateEvents(dt) {
    var now = Date.now();
    var em = this.eventManager;

    // 如果有活跃事件，检查是否结束
    if (em.activeEvent) {
      var elapsed = now - em.eventTimer;
      if (elapsed >= em.activeEvent.duration) {
        this._endEvent();
      }
    }

    // 检查是否触发新事件
    if (!em.activeEvent) {
      var gameTime = now - this.gameStartTime;
      if (gameTime >= em.nextEventTime) {
        this._triggerRandomEvent(now);
        // 设置下次事件时间：15-45秒后
        em.nextEventTime = gameTime + 15000 + Math.random() * 30000;
      }
    }

    // 应用当前事件效果到物理参数
    if (em.activeEvent && em.eventEffectActive) {
      this._applyEventEffect(em.activeEvent);
    }
  }

  /**
   * 触发随机事件
   * @param {number} now - 当前时间戳
   */
  _triggerRandomEvent(now) {
    var rand = Math.random();
    var cumulativeProb = 0;

    for (var i = 0; i < GAME_EVENTS.length; i++) {
      var event = GAME_EVENTS[i];
      cumulativeProb += event.prob;
      if (rand <= cumulativeProb) {
        this.eventManager.activeEvent = event;
        this.eventManager.eventTimer = now;
        this.eventManager.eventEffectActive = true;

        // 立即效果处理
        if (event.effect.instantShield) {
          this.shieldActive = true;
          this.itemManager.activeEffects.shield = { endTime: now + 999999 };
          // 即时效果，立即结束
          this.eventManager.activeEvent = null;
          this.eventManager.eventEffectActive = false;
        }
        break;
      }
    }
  }

  /**
   * 应用事件效果到物理参数
   * @param {Object} event - 事件对象
   */
  _applyEventEffect(event) {
    if (!event || !event.effect) return;

    var effect = event.effect;

    // updraft: 重力减半（跳跃更高）
    if (effect.gravityMod !== undefined) {
      // 在update()中重力应用时会乘以这个因子
      this._currentGravityMod = effect.gravityMod;
    }

    // snail/turbo: 影响移动速度（通过修改touchVelocity实现）
    if (effect.speedMod !== undefined) {
      this._currentSpeedMod = effect.speedMod;
    }

    // coinRain: 额外生成金币道具（在update中处理）
    if (effect.coinBonus && !this._coinRainSpawned) {
      this._coinRainSpawned = true;
      // 在下一帧生成额外金币
      this._spawnCoinRainItems();
    }
  }

  /**
   * 结束当前事件，恢复默认参数
   */
  _endEvent() {
    var em = this.eventManager;
    if (!em.activeEvent) return;

    // 恢复默认物理参数
    this._currentGravityMod = 1.0;
    this._currentSpeedMod = 1.0;
    this._coinRainSpawned = false;

    em.activeEvent = null;
    em.eventTimer = 0;
    em.eventEffectActive = false;
  }

  /**
   * 金币雨：在屏幕上方生成多个金币道具
   */
  _spawnCoinRainItems() {
    var platforms = this.platformManager.getPlatforms();
    var count = 0;
    // 在可见区域上方的平台上生成金币
    for (var i = 0; i < platforms.length && count < 5; i++) {
      var p = platforms[i];
      if (p.destroyed || p.itemSpawned) continue;
      var screenY = p.y - this.cameraY;
      if (screenY > -50 && screenY < this.screenHeight * 0.5) {
        this.itemManager.spawnOnPlatform(p, this.level);
        // 强制将道具类型改为coin
        var items = this.itemManager.getItems();
        if (items.length > 0) {
          var lastItem = items[items.length - 1];
          if (lastItem && lastItem.type !== 'coin') {
            lastItem.type = 'coin';
            lastItem.width = ITEM_CONFIG.coin.width;
            lastItem.height = ITEM_CONFIG.coin.height;
            lastItem.color = ITEM_CONFIG.coin.color;
          }
        }
        count++;
      }
    }
  }

  /**
   * 渲染事件提示覆盖层（在render中调用）
   * 显示当前激活事件的图标、名称和倒计时
   */
  _renderEventOverlay(ctx) {
    var em = this.eventManager;
    if (!em.activeEvent || !em.eventEffectActive) return;

    var event = em.activeEvent;
    var now = Date.now();
    var elapsed = now - em.eventTimer;
    var remaining = Math.max(0, Math.ceil((event.duration - elapsed) / 1000));

    // 如果已过期，不渲染
    if (remaining <= 0 && event.duration > 0) return;

    var w = this.screenWidth;
    var h = this.screenHeight;

    ctx.save();

    // 顶部事件通知条
    var barH = 36;
    var barY = 70; // HUD下方

    // 半透明背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this._roundRect(ctx, 20, barY, w - 40, barH, 10);
    ctx.fill();

    // 事件图标（根据事件类型显示不同颜色）
    var iconColor = '#FFFFFF';
    switch (event.id) {
      case 'rain': iconColor = '#3498DB'; break;
      case 'updraft': iconColor = '#2ECC71'; break;
      case 'coinRain': iconColor = '#F1C40F'; break;
      case 'snail': iconColor = '#9B59B6'; break;
      case 'turbo': iconColor = '#E74C3C'; break;
      case 'shieldBless': iconColor = '#1ABC9C'; break;
    }

    // 左侧色块指示器
    ctx.fillStyle = iconColor;
    this._roundRect(ctx, 22, barY + 2, 4, barH - 4, 2);
    ctx.fill();

    // 事件名称
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(event.name, 35, barY + barH / 2);

    // 倒计时（右侧）
    if (event.duration > 0) {
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(remaining + 's', w - 35, barY + barY / 2);
    }

    // 进度条（底部细线）
    var progress = elapsed / event.duration;
    ctx.fillStyle = iconColor;
    this._roundRect(ctx, 22, barY + barH - 3, (w - 44) * Math.min(progress, 1), 2, 1);
    ctx.fill();

    ctx.restore();
  }

  // ========== Phase 4: 成就系统 ==========

  /**
   * 检测成就（在addScore中调用）
   * 使用wx.setStorageSync本地存储持久化
   */
  _checkAchievements() {
    try {
      var achieved = wx.getStorageSync('achievements') || {};
      var newAchieves = [];

      // first_jump: 完成第一次跳跃
      if (!achieved.first_jump && this.score > 0) {
        achieved.first_jump = true;
        newAchieves.push('first_jump');
      }

      // score_1000: 单局得分超过1000
      if (!achieved.score_1000 && this.score >= 1000) {
        achieved.score_1000 = true;
        newAchieves.push('score_1000');
      }

      // score_5000: 单局得分超过5000
      if (!achieved.score_5000 && this.score >= 5000) {
        achieved.score_5000 = true;
        newAchieves.push('score_5000');
      }

      // coins_50: 单局收集50个金币
      if (!achieved.coins_50 && this.coins >= 50) {
        achieved.coins_50 = true;
        newAchieves.push('coins_50');
      }

      // level_10: 到达第10关
      if (!achieved.level_10 && this.level >= 10) {
        achieved.level_10 = true;
        newAchieves.push('level_10');
      }

      // perfect_game: 不扣命完成一局（到达目标分数且deathCount==0）
      if (!achieved.perfect_game && this.score >= 1000 && this.deathCount === 0) {
        achieved.perfect_game = true;
        newAchieves.push('perfect_game');
      }

      // combo_30: 达成30连击
      if (!achieved.combo_30 && this.maxCombo >= 30) {
        achieved.combo_30 = true;
        newAchieves.push('combo_30');
      }

      // 如果有新成就，保存并显示
      if (newAchieves.length > 0) {
        wx.setStorageSync('achievements', achieved);
        // 显示第一个新成就（队列显示）
        if (!this.pendingAchievement) {
          this.pendingAchievement = newAchieves[0];
          this.achievementShowTimer = Date.now();
        }
      }
    } catch(e) {
      console.warn('[GameEngine] 成就检测失败', e);
    }
  }

  /**
   * 渲染成就解锁弹窗（在render中调用）
   * 显示3秒后自动消失
   */
  _renderAchievementPopup(ctx) {
    if (!this.pendingAchievement || !this.achievementShowTimer) return;

    // 检查是否超时（3秒显示时间）
    if (Date.now() - this.achievementShowTimer > 3000) {
      this.pendingAchievement = null;
      return;
    }

    var achieveId = this.pendingAchievement;
    var achieve = ACHIEVEMENTS[achieveId];
    if (!achieve) {
      this.pendingAchievement = null;
      return;
    }

    var w = this.screenWidth;
    var h = this.screenHeight;
    var now = Date.now();
    var elapsed = now - this.achievementShowTimer;

    ctx.save();

    // 弹窗位置：屏幕上方1/4处
    var popupW = Math.min(280, w - 40);
    var popupH = 70;
    var popupX = (w - popupW) / 2;
    var popupY = h * 0.2;

    // 入场动画：从上方滑入 + 淡入
    var slideOffset = Math.max(0, (1 - elapsed / 400) * 30); // 前400ms滑入
    var alpha = Math.min(1, elapsed / 300); // 前300ms淡入

    ctx.globalAlpha = alpha;

    // 背景：渐变色面板（金色主题）
    var bgGrad = ctx.createLinearGradient(popupX, popupY - slideOffset, popupX, popupY + popupH - slideOffset);
    bgGrad.addColorStop(0, '#FFD700');
    bgGrad.addColorStop(1, '#FFA500');
    ctx.fillStyle = bgGrad;
    this._roundRect(ctx, popupX, popupY - slideOffset, popupW, popupH, 12);
    ctx.fill();

    // 内部白色内容区
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    this._roundRect(ctx, popupX + 3, popupY + 3 - slideOffset, popupW - 6, popupH - 6, 10);
    ctx.fill();

    // 左侧图标区域
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(achieve.icon, popupX + 35, popupY + popupH / 2 - slideOffset);

    // 成就名称
    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(achieve.name, popupX + 60, popupY + 25 - slideOffset);

    // 成就描述
    ctx.fillStyle = '#666666';
    ctx.font = '12px sans-serif';
    ctx.fillText(achieve.desc, popupX + 60, popupY + 48 - slideOffset);

    // 右侧"解锁!"标签
    ctx.fillStyle = '#FF6B6B';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('解锁!', popupX + popupW - 12, popupY + popupH / 2 - slideOffset);

    ctx.restore();
  }

  /**
   * 检测掉落预警（在update中调用）
   * - 当角色距离底部<100px时激活警告
   * - 仅在前2次掉落后启用（fallCount < 2）
   * - 预警强度根据距离底部的距离计算（0~1）
   */
  _checkFallWarning() {
    // 仅在前2次掉落后启用（新手保护期）
    if (this.fallCount >= 2) {
      this.isWarningActive = false;
      this.warningIntensity = 0;
      return;
    }

    var playerScreenY = this.player.y - this.cameraY;
    var distanceToBottom = this.screenHeight - playerScreenY;

    if (distanceToBottom < 100) {
      // 激活警告，强度随距离减小而增加
      this.isWarningActive = true;
      this.warningIntensity = Math.max(0, Math.min(1, 1 - distanceToBottom / 100));
    } else {
      // 警告逐渐消失
      if (this.isWarningActive) {
        this.warningIntensity -= 0.05;
        if (this.warningIntensity <= 0) {
          this.isWarningActive = false;
          this.warningIntensity = 0;
        }
      }
    }
  }

  /**
   * 渲染掉落预警效果（在render中调用）
   * - 屏幕边缘红色渐变
   * - 底部红色警告线
   * - 轻量级渲染（不创建大量对象）
   */
  _renderFallWarning(ctx) {
    if (!this.isWarningActive || this.warningIntensity <= 0) return;

    var w = this.screenWidth;
    var h = this.screenHeight;
    var intensity = this.warningIntensity;

    ctx.save();

    // 1. 屏幕边缘红色渐变（左右两侧）
    var edgeWidth = 30 * intensity; // 边缘宽度随强度变化
    if (edgeWidth > 0) {
      // 左边缘
      var leftGrad = ctx.createLinearGradient(0, 0, edgeWidth, 0);
      leftGrad.addColorStop(0, 'rgba(255, 0, 0, ' + (intensity * 0.4) + ')');
      leftGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
      ctx.fillStyle = leftGrad;
      ctx.fillRect(0, 0, edgeWidth, h);

      // 右边缘
      var rightGrad = ctx.createLinearGradient(w - edgeWidth, 0, w, 0);
      rightGrad.addColorStop(0, 'rgba(255, 0, 0, 0)');
      rightGrad.addColorStop(1, 'rgba(255, 0, 0, ' + (intensity * 0.4) + ')');
      ctx.fillStyle = rightGrad;
      ctx.fillRect(w - edgeWidth, 0, edgeWidth, h);
    }

    // 2. 底部红色警告线（越靠近底部越粗/越亮）
    var warningLineHeight = 3 + intensity * 5; // 3~8px高度
    var warningLineY = h - warningLineHeight;
    var bottomGrad = ctx.createLinearGradient(0, warningLineY, 0, h);
    bottomGrad.addColorStop(0, 'rgba(255, 0, 0, 0)');
    bottomGrad.addColorStop(0.5, 'rgba(255, 50, 50, ' + (intensity * 0.6) + ')');
    bottomGrad.addColorStop(1, 'rgba(255, 0, 0, ' + (intensity * 0.8) + ')');
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, warningLineY, w, warningLineHeight);

    // 3. 警告文字（"危险！"闪烁显示）
    if (intensity > 0.5) {
      var textAlpha = (Math.sin(Date.now() * 0.01) + 1) / 2 * intensity; // 闪烁
      ctx.globalAlpha = textAlpha;
      ctx.fillStyle = '#FF0000';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('\u26A0\uFE0F \u5371\u9669!', w / 2, h - warningLineHeight - 5); // ⚠️ 危险!
    }

    ctx.restore();
  }

  // ========== Phase 5: 易碎平台破碎延迟系统 ==========

  /**
   * 更新易碎平台的破碎状态（在update中调用）
   * 破碎延迟机制：
   * - elapsed > 300ms: crackStage=1 (微裂纹)
   * - elapsed > 600ms: crackStage=2 (大裂纹+红色闪烁)
   * - elapsed > 800ms: crackStage=3 (真正破碎，此时才考虑扣命)
   */
  _updateFragilePlatforms(dt) {
    var platforms = this.platformManager.getPlatforms();
    var now = Date.now();

    for (var i = 0; i < platforms.length; i++) {
      var p = platforms[i];
      if (p.type !== 'fragile' || p.destroyed || !p.crackTimer) continue;

      var elapsed = now - p.crackTimer;

      if (elapsed > 800 && p.crackStage < 3) {
        // 真正破碎
        p.crackStage = 3;
        p.destroyed = true;
        this.audioManager.playSound(AudioManager.SOUNDS.BREAK);
        // Phase 7: 平台破碎粒子 + 屏幕震动
        this._emitParticles(p.x + p.width / 2, p.y, {
          count: 20, type: 'break', color: '#FF6B6B', speed: 120, life: 0.8, size: 10
        });
        this.triggerScreenShake(3, 150);
        // 检查角色是否还在这个平台上
        var pb = this.player.y + this.player.height;
        if (pb >= p.y - 5 && pb <= p.y + 25 &&
            this.player.x + this.player.width > p.x &&
            this.player.x < p.x + p.width) {
          // 角色还在平台上，扣1命
          this.lives--;
          this.deathCount++;
          this.audioManager.playSound(AudioManager.SOUNDS.HURT);
          this.triggerLifeFlash();
          // 设置无敌时间
          this.invincibleUntil = now + 3000;
          if (this.lives <= 0) {
            // 延迟调用gameOver（避免在update循环中出问题）
            var self = this;
            setTimeout(function() { self.gameOver(); }, 100);
          }
        }
      } else if (elapsed > 600 && p.crackStage < 2) {
        // 大裂纹+红色闪烁
        p.crackStage = 2;
      } else if (elapsed > 300 && p.crackStage < 1) {
        // 微裂纹
        p.crackStage = 1;
      }
    }
  }

  // ========== Phase 5: 难度自适应系统 ==========

  /**
   * 更新自适应难度（在update中调用，每30秒评估一次）
   * 根据玩家表现动态调整难度：
   * - 表现好(survivalTime>120s且deathCount==0)：增加难度
   * - 表现差(deathCount>=3 in last 60s)：降低难度
   * 所有因子限制在合理范围内
   */
  _updateAdaptiveDifficulty() {
    var now = Date.now();

    // 每30秒评估一次
    if (now - this.lastAdaptiveCheck < 30000) return;
    this.lastAdaptiveCheck = now;

    // 计算生存时间（秒）
    var survivalTime = (now - this.gameStartTime) / 1000;

    // 统计最近60秒内的死亡次数
    var recentDeathCount = this.recentDeaths.length;

    try {
      if (survivalTime > 120 && this.deathCount === 0) {
        // 表现好：长时间存活且没有死亡 → 增加难度
        this.adaptiveFactor.platformGap = Math.min(1.3, this.adaptiveFactor.platformGap * 1.05);
        this.adaptiveFactor.fragileProb = Math.min(1.5, this.adaptiveFactor.fragileProb * 1.05);
        this.adaptiveFactor.movingSpeed = Math.min(1.5, this.adaptiveFactor.movingSpeed * 1.05);
        this.adaptiveFactor.itemSpawnRate = Math.max(0.5, this.adaptiveFactor.itemSpawnRate * 0.95);
      } else if (recentDeathCount >= 3) {
        // 表现差：60秒内死亡3次以上 → 降低难度
        this.adaptiveFactor.platformGap = Math.max(0.8, this.adaptiveFactor.platformGap * 0.9);
        this.adaptiveFactor.fragileProb = Math.max(0.5, this.adaptiveFactor.fragileProb * 0.6);
        this.adaptiveFactor.movingSpeed = Math.max(0.7, this.adaptiveFactor.movingSpeed * 0.9);
        this.adaptiveFactor.itemSpawnRate = Math.min(1.5, this.adaptiveFactor.itemSpawnRate * 1.3);
      }

      // 将自适应因子应用到平台管理器
      this._applyAdaptiveDifficulty();
    } catch(e) {
      // 容错处理：自适应系统出错不影响核心玩法
      console.warn('[GameEngine] 自适应难度更新失败', e);
    }
  }

  /**
   * 将自适应难度因子应用到平台管理器
   * 通过修改平台管理器的参数接口影响实际平台生成
   */
  _applyAdaptiveDifficulty() {
    if (!this.platformManager || !this.platformManager.setAdaptiveFactor) return;

    try {
      this.platformManager.setAdaptiveFactor(this.adaptiveFactor);
    } catch(e) {
      // 容错处理：应用失败不影响游戏
      console.warn('[GameEngine] 应用自适应难度失败', e);
    }
  }

  // ========== 触摸输入（Phase 2: 惯性优化）==========
  handleTouch(x, y) {
    // Phase 6: 教程状态触摸处理（优先级最高）
    if (this.state === GAME_STATE.TUTORIAL) {
      return this.handleTutorialTouch(x, y);
    }

    if (this.state === GAME_STATE.IDLE) {
      if (this.showShop) return this.handleShopTouch(x, y);
      if (this._hitTest(x, y, this.buttons.startGame)) return 'startGame';
      if (this._hitTest(x, y, this.buttons.ranking)) return 'ranking';
      if (this._hitTest(x, y, this.buttons.shop)) { this.showShop = true; return 'shopOpen'; }
      return null;
    }
    if (this.state === GAME_STATE.PLAYING) {
      if (this._hitTest(x, y, this.buttons.pause)) return 'pause';

      // Phase 2: 优化触摸控制 - 更灵敏的响应
      var centerX = this.screenWidth / 2;
      var distance = Math.abs(x - centerX) / centerX;
      var speed = PHYSICS.moveSpeed + distance * 6;  // 基础速度6 + 距离加成最大6

      // 边缘区域额外加速（提升跟手感）
      if (distance > 0.8) speed += 2;

      // 设置触摸目标速度（不直接改变vx，通过update中的惯性系统平滑过渡）
      this.touchVelocity = x < centerX ? -speed : speed;
      this.targetDirection = x < centerX ? -1 : 1;  // Phase 2: 使用目标方向实现平滑翻转
      return null;
    }
    if (this.state === GAME_STATE.PAUSED) {
      // 检测暂停界面的按钮
      if (this.buttons.pauseContinue && this._hitTest(x, y, this.buttons.pauseContinue)) return 'pauseContinue';
      if (this.buttons.pauseRestart && this._hitTest(x, y, this.buttons.pauseRestart)) return 'pauseRestart';
      if (this.buttons.pauseHome && this._hitTest(x, y, this.buttons.pauseHome)) return 'pauseHome';
      if (this.buttons.pauseMute && this._hitTest(x, y, this.buttons.pauseMute)) return 'pauseMute';

      // 检测BGM音量滑块触摸
      if (this.buttons.bgmVolumeBar &&
          x >= this.buttons.bgmVolumeBar.x &&
          x <= this.buttons.bgmVolumeBar.x + this.buttons.bgmVolumeBar.w &&
          y >= this.buttons.bgmVolumeBar.y - 10 &&
          y <= this.buttons.bgmVolumeBar.y + this.buttons.bgmVolumeBar.h + 10) {
        // 计算新音量值 (0~1)
        var bgmVol = (x - this.buttons.bgmVolumeBar.x) / this.buttons.bgmVolumeBar.w;
        bgmVol = Math.max(0, Math.min(1, bgmVol));
        this.audioManager.setBGMVolume(bgmVol);
        this.volumeSettings.bgm = Math.round(bgmVol * 100);  // 更新显示用的变量(0-100)
        return 'volumeChange';
      }

      // 检测音效音量滑块触摸
      if (this.buttons.sfxVolumeBar &&
          x >= this.buttons.sfxVolumeBar.x &&
          x <= this.buttons.sfxVolumeBar.x + this.buttons.sfxVolumeBar.w &&
          y >= this.buttons.sfxVolumeBar.y - 10 &&
          y <= this.buttons.sfxVolumeBar.y + this.buttons.sfxVolumeBar.h + 10) {
        var sfxVol = (x - this.buttons.sfxVolumeBar.x) / this.buttons.sfxVolumeBar.w;
        sfxVol = Math.max(0, Math.min(1, sfxVol));
        this.audioManager.setSFXVolume(sfxVol);
        this.volumeSettings.sfx = Math.round(sfxVol * 100);  // 更新显示用的变量(0-100)
        return 'volumeChange';
      }

      return null;
    }
    if (this.state === GAME_STATE.OVER) {
      if (this._hitTest(x, y, this.buttons.restart)) return 'restart';
      if (this._hitTest(x, y, this.buttons.home)) return 'home';
      if (this._hitTest(x, y, this.buttons.nameInput)) return 'nameInput';  // 名称输入
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

    // Phase 7: 应用屏幕震动（最开头）
    ctx.save();
    this.applyScreenShake(ctx);

    if (this.state === GAME_STATE.LOADING) { this._renderLoadingScreen(ctx); ctx.restore(); return; }

    // 背景
    this._renderBackground(ctx);

    // Phase 6: 渲染教程界面（优先级最高，覆盖其他内容）
    if (this.state === GAME_STATE.TUTORIAL) {
      this.renderTutorial(ctx);
      ctx.restore();
      return;
    }

    // Phase 7: 背景装饰
    if (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.PAUSED) {
      this._renderBackgroundDecorations(ctx);
    }

    if (this.state === GAME_STATE.IDLE) {
      // 应用淡入透明度
      ctx.globalAlpha = this.transitionAlpha;
      this._renderStartScreen(ctx);
      ctx.globalAlpha = 1;
      // 商店界面（覆盖在开始页之上）
      if (this.showShop) { this.renderShop(ctx); }
      ctx.restore();
      return;
    }

    // 游戏世界
    ctx.save();
    ctx.translate(0, -this.cameraY);
    this._renderPlatforms(ctx);
    this._renderItems(ctx);  // Phase 3: 道具渲染
    this._renderPlayer(ctx);
    ctx.restore();

    // Phase 7: 渲染粒子系统（游戏世界之上）
    ctx.save();
    ctx.translate(0, -this.cameraY);
    this._renderParticles(ctx);
    ctx.restore();

    ctx.restore();  // 恢复震动偏移

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

    // Phase 4: 渲染随机事件提示（游戏进行中显示）
    if (this.state === GAME_STATE.PLAYING) {
      this._renderEventOverlay(ctx);
    }

    // Phase 4: 渲染成就解锁弹窗（游戏进行中显示）
    if (this.state === GAME_STATE.PLAYING) {
      this._renderAchievementPopup(ctx);
    }

    // Phase 5: 渲染掉落预警（游戏进行中显示）
    if (this.state === GAME_STATE.PLAYING) {
      this._renderFallWarning(ctx);
    }
  }

  // ========== 背景（支持视差 + Phase 6: 主题系统）==========
  _renderBackground(ctx) {
    var w = this.screenWidth;
    var h = this.screenHeight;

    // Phase 6: 使用主题背景渐变色（优先于硬编码颜色）
    var theme = this.currentTheme || this.getCurrentTheme(this.level);
    var bgColors = theme ? theme.bgGradient : ['#87CEEB', '#E0F4FF'];

    // 主背景图 或 渐变降级
    var bgImg = this._img(IMG.BG_GRADIENT);
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, w, h);
    } else {
      var grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, bgColors[0] || '#87CEEB');
      grad.addColorStop(0.6, bgColors[1] || '#E0F4FF');
      grad.addColorStop(1, bgColors[1] || '#F7FFF7');
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

    // Phase 6: 渲染装饰粒子（花瓣/气泡/火星/雪花/星星）
    this._renderDecorParticles(ctx);
  }

  // ========== 加载界面（Phase 3: 品牌化升级）==========
  _renderLoadingScreen(ctx) {
    var w = this.screenWidth;
    var h = this.screenHeight;
    var anim = this.animationState;

    // 背景：主色调渐变
    var bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#87CEEB');
    bgGrad.addColorStop(0.5, '#98D8C8');
    bgGrad.addColorStop(1, '#FFF8E7');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 左上角Logo小图标（80x80px）
    var logoImg = this._img(IMG.LOGO_TITLE);
    if (logoImg) {
      ctx.globalAlpha = 0.9;
      ctx.drawImage(logoImg, 20, 20, 80, 80);
      ctx.globalAlpha = 1;
    } else {
      // 降级：绘制简化Logo
      ctx.fillStyle = '#FF6B6B';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('跳', 35, 45);
    }

    // 中央加载面板
    var panelW = Math.min(300, w - 50);
    var panelH = 140;
    var panelX = (w - panelW) / 2;
    var panelY = (h - panelH) / 2;

    // 毛玻璃面板背景
    this._drawGlassPanel(ctx, panelX, panelY, panelW, panelH, 16, 0.92);

    // 标题
    ctx.fillStyle = '#FF6B6B';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('正在准备游戏资源...', w / 2, panelY + 35);

    // 进度条（胶囊形状，渐变填充）
    var barW = panelW - 50;
    var barH = 14;
    var barX = (w - barW) / 2;
    var barY = panelY + 65;
    var pct = this.loadTotal > 0 ? this.loadProgress / this.loadTotal : 0;
    this._drawProgressBar(ctx, barX, barY, barW, barH, pct, ['#4ECDC4', '#44A08D']);

    // 百分比文字（粗体13px）
    ctx.fillStyle = '#444444';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(Math.round(pct * 100) + '%', w / 2, barY + 22);

    // 提示文字轮播
    var tips = ['准备资源...', '加载图形...', '即将完成...'];
    ctx.fillStyle = '#555555';
    ctx.font = 'bold 13px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(tips[anim.loadTipIndex], w / 2, panelY + 115);

    // 底部版本信息
    ctx.fillStyle = 'rgba(60, 60, 60, 0.85)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('v3.0 | Jump Game', w / 2, h - 15);
  }

  // ========== 开始界面（Phase 3: UI全面重设计）==========
  _renderStartScreen(ctx) {
    var w = this.screenWidth;
    var h = this.screenHeight;
    var anim = this.animationState;

    // 背景：多层视差效果
    this._renderBackground(ctx);

    // 半透明遮罩层（增强UI可读性）
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, w, h);

    // ========== 标题Logo区域 ==========
    var logoImg = this._img(IMG.LOGO_TITLE);
    var titleAreaTop = h * 0.08;
    var titleAreaHeight = h * 0.28;

    if (logoImg) {
      // Logo：屏幕60%宽度（最大300px），带浮动动画
      var lw = Math.min(w * 0.6, 300);
      var lh = lw * (logoImg.height / logoImg.width);
      if (lh > titleAreaHeight) {
        lh = titleAreaHeight;
        lw = lh * (logoImg.width / logoImg.height);
      }
      // 应用浮动偏移
      var logoY = titleAreaTop + (titleAreaHeight - lh) / 2 + anim.logoFloatOffset;
      ctx.drawImage(logoImg, (w - lw) / 2, logoY, lw, lh);
    } else {
      // 文字标题降级：放大显示，带浮动动画
      var textY = titleAreaTop + titleAreaHeight / 2 + anim.logoFloatOffset;

      // 阴影效果
      ctx.save();
      ctx.shadowColor = 'rgba(255,107,107,0.3)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = '#FF6B6B';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('跳跃闯关', w / 2, textY);
      ctx.restore();
    }

    // ========== 副标题区域 ==========
    var subtitleY = titleAreaTop + titleAreaHeight + 20;

    // 副标题深色背景条（高对比度）
    ctx.save();
    ctx.fillStyle = 'rgba(45, 52, 54, 0.82)';
    this._roundRect(ctx, w / 2 - 150, subtitleY - 16, 300, 32, 16);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 描边效果（深色描边增强可读性）
    ctx.strokeStyle = 'rgba(45, 52, 54, 0.8)';
    ctx.lineWidth = 3;
    ctx.strokeText('触摸屏幕左右两侧控制角色移动', w / 2, subtitleY);
    ctx.fillText('触摸屏幕左右两侧控制角色移动', w / 2, subtitleY);

    // 操作指引：深色圆角按钮风格
    var guideY = subtitleY + 34;
    ctx.save();
    ctx.fillStyle = 'rgba(78, 205, 196, 0.85)';
    this._roundRect(ctx, w / 2 - 90, guideY - 14, 180, 28, 14);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u25C0   \uD83D\uDC4A   \u25B6', w / 2, guideY);  // ◀ 🖐️ ►

    // ========== 按钮区域 ==========
    // 主按钮：200x56，渐变填充(#FF6B6B→#FF8E53)，加强视觉
    var startBtn = this.buttons.startGame;
    var startImg = this._img(IMG.BTN_START);
    if (startImg) {
      // 画图片作为背景
      ctx.drawImage(startImg, startBtn.x, startBtn.y, startBtn.w, startBtn.h);
      // 始终在图片上叠加文字（确保可见）
      ctx.save();
      ctx.font = 'bold 19px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(100, 30, 30, 0.7)';
      ctx.lineWidth = 3;
      ctx.strokeText('开始游戏', startBtn.x + startBtn.w / 2, startBtn.y + startBtn.h / 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('开始游戏', startBtn.x + startBtn.w / 2, startBtn.y + startBtn.h / 2);
      ctx.restore();
    } else {
      ctx.save();
      // 外层深色描边（增强可见度）
      ctx.strokeStyle = 'rgba(180, 60, 60, 0.5)';
      ctx.lineWidth = 3;
      this._roundRect(ctx, startBtn.x - 2, startBtn.y - 2, startBtn.w + 4, startBtn.h + 4, 14);
      ctx.stroke();

      // 按钮阴影（加深）
      ctx.shadowColor = 'rgba(220, 80, 60, 0.4)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 6;

      // 渐变主体
      var sg = ctx.createLinearGradient(startBtn.x, startBtn.y, startBtn.x, startBtn.y + startBtn.h);
      sg.addColorStop(0, '#FF5555');
      sg.addColorStop(1, '#FF7744');
      ctx.fillStyle = sg;
      this._roundRect(ctx, startBtn.x, startBtn.y, startBtn.w, startBtn.h, 14);
      ctx.fill();

      // 内部高光
      ctx.shadowColor = 'transparent';
      var hl = ctx.createLinearGradient(startBtn.x, startBtn.y, startBtn.x, startBtn.y + startBtn.h * 0.5);
      hl.addColorStop(0, 'rgba(255,255,255,0.25)');
      hl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hl;
      this._roundRect(ctx, startBtn.x + 3, startBtn.y + 3, startBtn.w - 6, startBtn.h * 0.45, 11);
      ctx.fill();

      // 文字（白色+深色描边）
      ctx.font = 'bold 19px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(150, 40, 40, 0.6)';
      ctx.lineWidth = 3;
      ctx.strokeText('开始游戏', startBtn.x + startBtn.w / 2, startBtn.y + startBtn.h / 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('开始游戏', startBtn.x + startBtn.w / 2, startBtn.y + startBtn.h / 2);
      ctx.restore();
    }

    // 排行榜按钮：从描边改为浅色填充+深色文字（高对比度）
    var rankBtn = this.buttons.ranking;
    ctx.save();
    // 浅色背景
    ctx.fillStyle = 'rgba(78, 205, 196, 0.18)';
    this._roundRect(ctx, rankBtn.x, rankBtn.y, rankBtn.w, rankBtn.h, rankBtn.h / 2);
    ctx.fill();
    // 边框
    ctx.strokeStyle = '#4ECDC4';
    ctx.lineWidth = 2;
    this._roundRect(ctx, rankBtn.x, rankBtn.y, rankBtn.w, rankBtn.h, rankBtn.h / 2);
    ctx.stroke();
    // 文字（深色粗体，清晰可读）
    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('排行榜', rankBtn.x + rankBtn.w / 2, rankBtn.y + rankBtn.h / 2);
    ctx.restore();

    // ========== 商店按钮（金币图标+文字）==========
    var shopBtn = this.buttons.shop;
    ctx.save();
    // 金币色背景条
    ctx.fillStyle = 'rgba(255, 184, 0, 0.15)';
    this._roundRect(ctx, shopBtn.x, shopBtn.y, shopBtn.w, shopBtn.h, shopBtn.h / 2);
    ctx.fill();
    // 金色边框
    ctx.strokeStyle = '#FFB800';
    ctx.lineWidth = 1.5;
    this._roundRect(ctx, shopBtn.x, shopBtn.y, shopBtn.w, shopBtn.h, shopBtn.h / 2);
    ctx.stroke();
    // 文字
    ctx.fillStyle = '#B8860B';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\uD83C\uDFEA \u5546\u5E97', shopBtn.x + shopBtn.w / 2, shopBtn.y + shopBtn.h / 2);  // 🛒 商店
    ctx.restore();

    // ========== 底部信息栏 ==========
    var bottomY = h - 40;

    // 版本号
    ctx.fillStyle = 'rgba(70,70,70,0.9)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 最高分信息
    var bestScore = this.scoreManager.getBestScore();
    var bottomText = 'v3.0';
    if (bestScore > 0) {
      bottomText += '  |  最高分: ' + bestScore;
    }
    ctx.fillText(bottomText, w / 2, bottomY);

    // 装饰性视差元素（浮动的几何图形）
    this._renderStartScreenDecorations(ctx, anim);
  }

  /**
   * 开始界面装饰性元素（视差浮动图形）
   */
  _renderStartScreenDecorations(ctx, anim) {
    var w = this.screenWidth;
    var h = this.screenHeight;
    var time = Date.now() * 0.001;

    ctx.save();
    ctx.globalAlpha = 0.1;

    // 左上角圆形装饰
    var c1x = 50 + Math.sin(time * 0.5) * 10;
    var c1y = 100 + Math.cos(time * 0.7) * 10;
    ctx.fillStyle = '#FF6B6B';
    ctx.beginPath();
    ctx.arc(c1x, c1y, 30 + anim.logoFloatOffset, 0, Math.PI * 2);
    ctx.fill();

    // 右上角三角形装饰
    var t1x = w - 60 + Math.cos(time * 0.6) * 8;
    var t1y = 120 + Math.sin(time * 0.4) * 8;
    ctx.fillStyle = '#4ECDC4';
    ctx.beginPath();
    ctx.moveTo(t1x, t1y - 25);
    ctx.lineTo(t1x - 25, t1y + 20);
    ctx.lineTo(t1x + 25, t1y + 20);
    ctx.closePath();
    ctx.fill();

    // 左下角方形装饰
    var s1x = 70 + Math.sin(time * 0.4) * 12;
    var s1y = h - 120 + Math.cos(time * 0.5) * 12;
    ctx.fillStyle = '#FFB800';
    this._roundRect(ctx, s1x, s1y, 25, 25, 5);
    ctx.fill();

    // 右下角圆形装饰
    var c2x = w - 80 + Math.cos(time * 0.55) * 10;
    var c2y = h - 100 + Math.sin(time * 0.65) * 10;
    ctx.fillStyle = '#98D8C8';
    ctx.beginPath();
    ctx.arc(c2x, c2y, 20 - anim.logoFloatOffset, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ========== HUD（Phase 3: 全面升级）==========
  _renderHUD(ctx) {
    var w = this.screenWidth;
    var hudHeight = 64;  // 顶栏高度增加到64px
    var anim = this.animationState;

    // 毛玻璃背景效果
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(0, 0, w, hudHeight);

    // 底部细线分隔
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, hudHeight);
    ctx.lineTo(w, hudHeight);
    ctx.stroke();
    ctx.restore();

    // ========== 左侧：生命值（32px图标 + 粗体数字）==========
    var lifeX = 12;
    var lifeY = hudHeight / 2;

    ctx.save();
    // 闪烁效果（扣命时触发）
    if (anim.lifeFlashAlpha > 0) {
      ctx.globalAlpha = 1 - anim.lifeFlashAlpha * 0.5 + Math.sin(Date.now() * 0.02) * anim.lifeFlashAlpha * 0.3;
    }

    // 心形图标
    ctx.fillStyle = '#FF6B6B';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u2764\uFE0F', lifeX, lifeY);  // ❤️

    // 生命值数字（粗体）
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(String(this.lives), lifeX + 28, lifeY);
    ctx.restore();

    // ========== 中左：得分区域（标签11px灰色 + 分数22px深色粗体）==========
    var scoreX = 75;

    // 标签
    ctx.fillStyle = '#777777';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('得分', scoreX, 10);

    // 分数值（粗体22px）
    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 22px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(this.score), scoreX, 42);

    // ========== 中右：关卡区域（标签11px灰色 + 关卡22px主题色）==========
    var levelX = w / 2 + 10;

    ctx.save();
    // 闪烁效果（升级时触发）
    if (anim.levelFlashAlpha > 0) {
      ctx.globalAlpha = 1;
      // 放大效果
      var scale = 1 + anim.levelFlashAlpha * 0.2;
      ctx.translate(levelX + 30, 42);
      ctx.scale(scale, scale);
      ctx.translate(-(levelX + 30), -42);
    }

    // 标签
    ctx.fillStyle = '#777777';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('关卡', levelX, 10);

    // 关卡值（Phase 6: 使用当前主题的强调色）
    var themeColor = (this.currentTheme && this.currentTheme.bgAccent) ? this.currentTheme.bgAccent : '#4ECDC4';
    ctx.fillStyle = themeColor;
    ctx.font = 'bold 22px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('Lv.' + this.level, levelX, 42);
    ctx.restore();

    // ========== 右侧：金币区域（深色背景+金色高亮）==========
    var coinX = w - 95;

    ctx.save();
    // 闪烁效果（收集时触发）
    if (anim.coinFlashAlpha > 0) {
      ctx.globalAlpha = 1 - anim.coinFlashAlpha * 0.5 + Math.sin(Date.now() * 0.025) * anim.coinFlashAlpha * 0.3;
    }

    // 金币区域背景条（深色半透明，确保可读性）
    var coinBgW = 80;
    var coinBgH = 28;
    ctx.fillStyle = 'rgba(45, 52, 54, 0.75)';
    this._roundRect(ctx, coinX - 8, lifeY - coinBgH / 2, coinBgW, coinBgH, 14);
    ctx.fill();

    // 金币图标
    ctx.fillStyle = '#FFD700';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('\uD83E\uDE99', coinX, lifeY);  // 🪙

    // 金币数量（粗体白色+描边，确保清晰可见）
    ctx.font = 'bold 18px monospace';
    ctx.strokeStyle = 'rgba(45, 52, 54, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.strokeText(String(this.coins), coinX + 24, lifeY);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(String(this.coins), coinX + 24, lifeY);
    ctx.restore();

    // ========== Phase 4: 连击显示（金币下方）==========
    if (this.combo > 1) {
      var comboX = w - 85;
      var comboY = hudHeight + 22;

      ctx.save();
      // 连击数>10时显示特殊颜色
      var comboColor = this.combo >= 30 ? '#FF6B6B' : (this.combo >= 10 ? '#FF8C00' : '#4ECDC4');
      ctx.fillStyle = comboColor;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      // 显示连击数和倍率
      var comboText = this.combo + '连击';
      if (this.comboMultiplier > 1.01) {
        comboText += ' x' + this.comboMultiplier.toFixed(2);
      }
      ctx.fillText(comboText, comboX, comboY);

      // 连击条（小进度条显示剩余时间）
      var comboTimeLeft = Math.max(0, (this.comboTimeout - (Date.now() - this.comboTimer)) / this.comboTimeout);
      if (comboTimeLeft > 0) {
        ctx.fillStyle = 'rgba(78, 205, 196, 0.3)';
        this._roundRect(ctx, comboX, comboY + 10, 70 * comboTimeLeft, 3, 1.5);
        ctx.fill();
      }
      ctx.restore();
    }

    // ========== 右上角：暂停按钮（40x32px）==========
    var pb = this.buttons.pause;
    ctx.save();

    // 半透明圆形背景
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    this._roundRect(ctx, pb.x, pb.y, pb.w, pb.h, pb.h / 2);
    ctx.fill();

    var pauseImg = this._img(IMG.ICON_PAUSE);
    if (pauseImg) {
      ctx.drawImage(pauseImg, pb.x + (pb.w - 24) / 2, pb.y + (pb.h - 20) / 2, 24, 20);
    } else {
      ctx.fillStyle = '#666666';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u23F8', pb.x + pb.w / 2, pb.y + pb.h / 2);  // ⏸
    }

    ctx.restore();
  }

  // ========== 暂停界面（Phase 3: 完整菜单+音量控制）==========
  _renderPauseOverlay(ctx) {
    var w = this.screenWidth;
    var h = this.screenHeight;
    var vol = this.volumeSettings;

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, w, h);

    // 中央面板（毛玻璃效果）
    var panelW = Math.min(320, w - 40);
    var panelH = 420;
    var panelX = (w - panelW) / 2;
    var panelY = (h - panelH) / 2;

    this._drawGlassPanel(ctx, panelX, panelY, panelW, panelH, 20, 0.95);

    // ========== 标题 ==========
    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u23F8\uFE0F 游戏暂停', w / 2, panelY + 45);  // ⏸️

    // 分隔线
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 30, panelY + 75);
    ctx.lineTo(panelX + panelW - 30, panelY + 75);
    ctx.stroke();

    // ========== 按钮区域 ==========
    var btnCenterX = w / 2;
    var btnWidth = 200;

    // 按钮1：继续游戏（主按钮，200x52）
    var continueBtn = { x: btnCenterX - btnWidth / 2, y: panelY + 95, w: btnWidth, h: 52 };
    this._renderButtonWithGradient(ctx, continueBtn, ['#4ECDC4', '#44A08D'], '继续游戏', 17);

    // 按钮2：重新开始（次要按钮，200x48）
    var restartBtn = { x: btnCenterX - btnWidth / 2, y: panelY + 160, w: btnWidth, h: 48 };
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    this._roundRect(ctx, restartBtn.x, restartBtn.y, restartBtn.w, restartBtn.h, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(78,205,196,0.4)';
    ctx.lineWidth = 1.5;
    this._roundRect(ctx, restartBtn.x, restartBtn.y, restartBtn.w, restartBtn.h, 12);
    ctx.stroke();
    ctx.fillStyle = '#444444';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('重新开始', restartBtn.x + restartBtn.w / 2, restartBtn.y + restartBtn.h / 2);
    ctx.restore();

    // 按钮3：返回首页（危险按钮，红色文字200x48）
    var homeBtn = { x: btnCenterX - btnWidth / 2, y: panelY + 222, w: btnWidth, h: 48 };
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    this._roundRect(ctx, homeBtn.x, homeBtn.y, homeBtn.w, homeBtn.h, 12);
    ctx.fill();
    ctx.fillStyle = '#FF6B6B';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('返回首页', homeBtn.x + homeBtn.w / 2, homeBtn.y + homeBtn.h / 2);
    ctx.restore();

    // 分隔线
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 30, panelY + 288);
    ctx.lineTo(panelX + panelW - 30, panelY + 288);
    ctx.stroke();

    // ========== 音量控制区域 ==========
    var volumeLabelX = panelX + 30;
    var sliderWidth = panelW - 60;
    var sliderStartX = volumeLabelX;

    // 区域标题
    ctx.fillStyle = '#444444';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('\uD83D\uDD0A 音量设置', volumeLabelX, panelY + 310);  // 🔊

    // BGM音量滑块
    this._drawVolumeSlider(ctx, sliderStartX, panelY + 340, sliderWidth, vol.bgm, '背景音乐');

    // 音效音量滑块
    this._drawVolumeSlider(ctx, sliderStartX, panelY + 385, sliderWidth, vol.sfx, '游戏音效');

    // 一键静音切换按钮
    var muteBtnX = panelX + panelW - 80;
    var muteBtnY = panelY + 375;
    ctx.save();
    ctx.fillStyle = vol.muted ? 'rgba(255,107,107,0.15)' : 'rgba(78,205,196,0.15)';
    this._roundRect(ctx, muteBtnX, muteBtnY, 70, 26, 13);
    ctx.fill();
    ctx.fillStyle = vol.muted ? '#FF6B6B' : '#4ECDC4';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(vol.muted ? '\uD83D\uDD07 静音' : '\uD83D\uDD0A 正常', muteBtnX + 35, muteBtnY + 13);  // 🔇/🔊
    ctx.restore();

    // 更新按钮区域定义（用于触摸检测）
    this.buttons.pauseContinue = continueBtn;
    this.buttons.pauseRestart = restartBtn;
    this.buttons.pauseHome = homeBtn;
    this.buttons.pauseMute = { x: muteBtnX, y: muteBtnY, w: 70, h: 26 };

    // 更新音量滑块区域（用于触摸检测）
    this.buttons.bgmVolumeBar = { x: sliderStartX, y: panelY + 340, w: sliderWidth, h: 20 };
    this.buttons.sfxVolumeBar = { x: sliderStartX, y: panelY + 385, w: sliderWidth, h: 20 };
  }

  // ========== 结束弹窗（Phase 3: 全面升级）==========
  _renderGameOverModal(ctx) {
    var w = this.screenWidth;
    var h = this.screenHeight;
    var anim = this.animationState;

    // 半透明黑色遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, w, h);

    // 面板尺寸：320x420（增加高度以容纳名称输入+提交按钮），圆角20px
    var panelW = Math.min(320, w - 30);
    var panelH = 420;
    var baseX = (w - panelW) / 2;
    var baseY = (h - panelH) / 2;

    // 入场动画：从下方滑入 + 淡入
    var slideOffset = (1 - anim.modalSlideProgress) * 100;  // 100px → 0
    var mx = baseX;
    var my = baseY + slideOffset;

    ctx.save();
    ctx.globalAlpha = anim.modalAlpha || this.transitionAlpha;

    // 面板背景
    var panelImg = this._img(IMG.PANEL_GAMEOVER);
    if (panelImg) {
      ctx.drawImage(panelImg, mx, my, panelW, panelH);
    } else {
      // 带阴影的白色圆角面板
      ctx.shadowColor = 'rgba(0,0,0,0.12)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#FFFFFF';
      this._roundRect(ctx, mx, my, panelW, panelH, 20);
      ctx.fill();
      ctx.shadowColor = 'transparent';  // 重置阴影
    }

    // ========== 标题「游戏结束」22px粗体 ==========
    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('游戏结束', w / 2, my + 24);

    // ========== 新纪录特效 ==========
    var bestScore = this.scoreManager.getBestScore();
    var isNewRecord = this.score >= bestScore && this.score > 0;

    if (isNewRecord && anim.starScale > 0) {
      ctx.save();

      // 星星旋转放大动画
      var starCX = w / 2;
      var starCY = my + 68;
      var starSize = anim.starScale;

      ctx.translate(starCX, starCY);
      ctx.rotate(anim.starRotation * Math.PI / 180);
      ctx.scale(starSize, starSize);

      // 绘制星星（使用文字符号）
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u2B50\u2B50\u2B50', 0, 0);  // ★★★

      ctx.restore();

      // 「🎉 新纪录！」弹跳出现
      if (anim.starScale >= 0.8) {
        var bounceAlpha = (anim.starScale - 0.8) / 0.2;  // 最后20%出现
        ctx.globalAlpha = bounceAlpha * (anim.modalAlpha || this.transitionAlpha);
        ctx.fillStyle = '#FF6B6B';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\uD83C\uDF89 新纪录！', w / 2, my + 100);  // 🎉
        ctx.globalAlpha = anim.modalAlpha || this.transitionAlpha;
      }
    }

    // ========== 分数信息两列布局 ==========
    var scoreSectionY = isNewRecord ? my + 120 : my + 70;
    var colWidth = (panelW - 60) / 2;
    var leftColX = mx + 35;
    var rightColX = mx + 35 + colWidth + 20;

    // 使用滚动值或实际值显示分数
    var displayScore = isNewRecord ? Math.round(anim.scoreRollValue) : this.score;

    // 本次得分（左列）
    ctx.fillStyle = '#777777';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('本次得分', leftColX + colWidth / 2, scoreSectionY);
    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(String(displayScore), leftColX + colWidth / 2, scoreSectionY + 22);

    // 最高纪录（右列）
    ctx.fillStyle = '#777777';
    ctx.font = '12px sans-serif';
    ctx.fillText('最高纪录', rightColX + colWidth / 2, scoreSectionY);
    ctx.fillStyle = '#FFB800';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(String(bestScore), rightColX + colWidth / 2, scoreSectionY + 22);

    // ========== 按钮区域 ==========
    var btnY = scoreSectionY + 75;
    var btnW = 140;
    var btnH = 48;
    var btnGap = 16;
    var btnStartX = w / 2 - btnW - btnGap / 2;

    // 动态更新按钮Y坐标
    this.buttons.restart.y = btnY;
    this.buttons.restart.w = btnW;
    this.buttons.restart.h = btnH;

    this.buttons.home.y = btnY;
    this.buttons.home.w = btnW;
    this.buttons.home.h = btnH;

    // 「再来一局」主按钮：140x48，红色渐变，脉冲呼吸效果
    var restartBtn = this.buttons.restart;
    this._renderButtonWithGradient(ctx, restartBtn, ['#FF6B6B', '#FF8E53'], '再来一局', 16, anim.pulseScale);

    // 「返回首页」次要按钮：140x48，灰色
    var homeBtn = this.buttons.home;
    ctx.save();
    ctx.fillStyle = '#F5F5F5';
    this._roundRect(ctx, homeBtn.x, homeBtn.y, homeBtn.w, homeBtn.h, 12);
    ctx.fill();
    ctx.fillStyle = '#444444';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('返回首页', homeBtn.x + homeBtn.w / 2, homeBtn.y + homeBtn.h / 2);
    ctx.restore();

    // ========== 名称输入区域（提交分数用）==========
    var nameInputY = btnY + btnH + 14;
    var inputW = panelW - 50;
    var inputH = 38;
    var inputX = mx + 25;

    // 输入框背景
    ctx.save();
    ctx.fillStyle = '#F8F8F8';
    this._roundRect(ctx, inputX, nameInputY, inputW, inputH, 10);
    ctx.fill();
    ctx.strokeStyle = '#DDD';
    ctx.lineWidth = 1;
    this._roundRect(ctx, inputX, nameInputY, inputW, inputH, 10);
    ctx.stroke();

    // 输入框内文字（显示当前名称或占位符）
    var displayName = this.playerName || '点击输入你的名字';
    ctx.fillStyle = this.playerName ? '#2D3436' : '#AAAAAA';
    ctx.font = this.playerName ? 'bold 15px sans-serif' : '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayName, inputX + 12, nameInputY + inputH / 2);

    // "编辑"图标提示
    if (!this.playerName) {
      ctx.fillStyle = '#4ECDC4';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('\u270E 编辑', inputX + inputW - 10, nameInputY + inputH / 2);  // ✏ 编辑
    }
    ctx.restore();

    // 记录输入框位置
    this.buttons.nameInput = { x: inputX, y: nameInputY, w: inputW, h: inputH };

    // 提交分数按钮
    var submitBtnY = nameInputY + inputH + 10;
    this.buttons.submitScore.y = submitBtnY;
    this.buttons.submitScore.w = inputW;
    this.buttons.submitScore.h = 36;
    this.buttons.submitScore.x = inputX;

    var submitBtn = this.buttons.submitScore;
    ctx.save();
    var submitGrad = ctx.createLinearGradient(submitBtn.x, submitBtn.y, submitBtn.x, submitBtn.y + submitBtn.h);
    submitGrad.addColorStop(0, '#4ECDC4');
    submitGrad.addColorStop(1, '#44A08D');
    ctx.fillStyle = submitGrad;
    this._roundRect(ctx, submitBtn.x, submitBtn.y, submitBtn.w, submitBtn.h, submitBtn.h / 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u2191\uFE0F 提交分数到排行榜', submitBtn.x + submitBtn.w / 2, submitBtn.y + submitBtn.h / 2);  // ↑️
    ctx.restore();

    ctx.restore();  // 恢复globalAlpha
  }

  // ========== 平台渲染（图片优先）==========
  _renderPlatforms(ctx) {
    var platforms = this.platformManager.getPlatforms();
    var colors = { normal: '#6BCB77', spring: '#4D96FF', fragile: '#FF6B6B', moving: '#9B59B6', portal: '#8E44AD', cloud: '#FFFFFF' };

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
      } else if (p.type === 'cloud' && p.isCloud) {
        // 云朵平台：白色半透明 + 渐隐效果
        ctx.save();
        ctx.globalAlpha = Math.max(0.1, p.cloudAlpha || 0.6);
        ctx.fillStyle = colors.cloud;
        this._roundRect(ctx, p.x, p.y, p.width, p.height, 7);
        ctx.fill();
        // 云朵装饰（小圆圈）
        ctx.fillStyle = 'rgba(255,255,255,' + (p.cloudAlpha || 0.6) + ')';
        ctx.beginPath();
        ctx.arc(p.x + p.width * 0.2, p.y - 3, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x + p.width * 0.5, p.y - 5, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x + p.width * 0.8, p.y - 3, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'portal' && p.isPortal) {
        // 传送门平台：深紫色 + 漩涡动画效果
        ctx.save();
        var portalCX = p.x + p.width / 2;
        var portalCY = p.y + p.height / 2;
        var rot = (p.portalRotation || 0) * Math.PI / 180;

        // 外框
        ctx.fillStyle = colors.portal;
        this._roundRect(ctx, p.x, p.y, p.width, p.height, 4);
        ctx.fill();

        // 内部漩涡效果（旋转的圆环）
        ctx.translate(portalCX, portalCY);
        ctx.rotate(rot);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.5;
        for (var ring = 1; ring <= 3; ring++) {
          ctx.globalAlpha = 0.3 + ring * 0.15;
          ctx.beginPath();
          ctx.arc(0, 0, ring * 8, 0, Math.PI * 1.5);
          ctx.stroke();
        }
        // 中心发光点
        ctx.rotate(-rot); // 反向旋转回正
        ctx.globalAlpha = 0.8 + Math.sin(Date.now() * 0.005) * 0.2; // 呼吸效果
        ctx.fillStyle = '#DDA0DD';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
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
          // Phase 5: 根据破碎阶段绘制不同的裂纹效果
          var crackStage = p.crackStage || 0;

          if (crackStage >= 1) {
            // 阶段1+: 绘制裂纹
            ctx.strokeStyle = '#CC4444';
            ctx.lineWidth = crackStage >= 2 ? 2 : 1;

            if (crackStage === 1) {
              // 微裂纹（细小裂缝）
              ctx.beginPath();
              ctx.moveTo(p.x + p.width * 0.3, p.y + 2);
              ctx.lineTo(p.x + p.width * 0.5, p.y + p.height / 2);
              ctx.lineTo(p.x + p.width * 0.7, p.y + 2);
              ctx.stroke();

              // 添加几条细微裂纹
              ctx.lineWidth = 0.5;
              ctx.beginPath();
              ctx.moveTo(p.x + p.width * 0.4, p.y + 3);
              ctx.lineTo(p.x + p.width * 0.45, p.y + p.height * 0.4);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(p.x + p.width * 0.6, p.y + 3);
              ctx.lineTo(p.x + p.width * 0.55, p.y + p.height * 0.4);
              ctx.stroke();
            } else if (crackStage === 2) {
              // 大裂纹（明显裂缝+红色闪烁背景）
              var flashAlpha = 0.3 + Math.abs(Math.sin(Date.now() * 0.01)) * 0.3;
              ctx.fillStyle = 'rgba(255, 0, 0, ' + flashAlpha + ')';
              ctx.fillRect(p.x, p.y, p.width, p.height);

              // 主裂纹（更粗更明显）
              ctx.strokeStyle = '#AA0000';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(p.x + p.width * 0.25, p.y + 2);
              ctx.lineTo(p.x + p.width * 0.5, p.y + p.height / 2);
              ctx.lineTo(p.x + p.width * 0.75, p.y + 2);
              ctx.stroke();

              // 分支裂纹
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(p.x + p.width * 0.35, p.y + p.height * 0.3);
              ctx.lineTo(p.x + p.width * 0.2, p.y + p.height * 0.6);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(p.x + p.width * 0.65, p.y + p.height * 0.3);
              ctx.lineTo(p.x + p.width * 0.8, p.y + p.height * 0.6);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(p.x + p.width * 0.5, p.y + p.height * 0.5);
              ctx.lineTo(p.x + p.width * 0.5, p.y + p.height - 2);
              ctx.stroke();
            }
            // crackStage === 3 时平台已销毁，不会渲染到这里
          } else {
            // 未破损：绘制原始裂纹提示
            ctx.strokeStyle = '#CC4444';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x + p.width * 0.3, p.y + 2);
            ctx.lineTo(p.x + p.width * 0.5, p.y + p.height / 2);
            ctx.lineTo(p.x + p.width * 0.7, p.y + 2);
            ctx.stroke();
          }
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
          ctx.fillStyle = '#777777';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('慢', x + item.width / 2, y + item.height / 2);
          break;

        case 'jetpack':
          // 喷气背包：矩形+底部火焰动画（橙色三角形上下摆动）
          ctx.fillStyle = config.color;
          this._roundRect(ctx, x + 3, y, item.width - 6, item.height - 10, 4);
          ctx.fill();
          // 背包带子
          ctx.strokeStyle = '#CC3300';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + 8, y + 4);
          ctx.lineTo(x + 8, y + item.height - 12);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + item.width - 8, y + 4);
          ctx.lineTo(x + item.width - 8, y + item.height - 12);
          ctx.stroke();
          // 火焰动画（三角形上下摆动）
          var flameOffset = Math.sin(now * 0.01) * 3;
          ctx.fillStyle = '#FF6600';
          ctx.beginPath();
          ctx.moveTo(x + item.width / 2 - 6, y + item.height - 10);
          ctx.lineTo(x + item.width / 2 + 6, y + item.height - 10);
          ctx.lineTo(x + item.width / 2, y + item.height + flameOffset);
          ctx.closePath();
          ctx.fill();
          // 内焰（黄色）
          ctx.fillStyle = '#FFCC00';
          ctx.beginPath();
          ctx.moveTo(x + item.width / 2 - 3, y + item.height - 10);
          ctx.lineTo(x + item.width / 2 + 3, y + item.height - 10);
          ctx.lineTo(x + item.width / 2, y + item.height - 4 + flameOffset * 0.6);
          ctx.closePath();
          ctx.fill();
          break;

        case 'double_score':
          // 双倍得分：圆形星星+内部"x2"文字+金色旋转光芒
          var cx = x + item.width / 2;
          var cy = y + item.height / 2;
          var glowRotation = now * 0.002;
          // 外圈旋转光芒
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(glowRotation);
          for (var ray = 0; ray < 8; ray++) {
            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = 'rgba(255, 215, 0, 0.4)';
            ctx.beginPath();
            ctx.moveTo(0, -item.width / 2 - 2);
            ctx.lineTo(-3, -item.width / 2 - 7);
            ctx.lineTo(3, -item.width / 2 - 7);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
          // 圆形主体
          ctx.fillStyle = config.color;
          ctx.beginPath();
          ctx.arc(cx, cy, item.width / 2 - 1, 0, Math.PI * 2);
          ctx.fill();
          // 边框
          ctx.strokeStyle = '#DAA520';
          ctx.lineWidth = 2;
          ctx.stroke();
          // "x2"文字
          ctx.fillStyle = '#B8860B';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('x2', cx, cy);
          break;

        case 'invincible':
          // 无敌星：星形+彩虹色循环（hue旋转）
          var icx = x + item.width / 2;
          var icy = y + item.height / 2;
          var hue = (now * 0.1) % 360;
          var starColor = 'hsl(' + hue + ', 80%, 60%)';
          ctx.save();
          ctx.translate(icx, icy);
          ctx.rotate(now * 0.003); // 缓慢自转
          // 绘制五角星
          ctx.fillStyle = starColor;
          ctx.beginPath();
          for (var si = 0; si < 5; si++) {
            var outerAngle = (si * 72 - 90) * Math.PI / 180;
            var innerAngle = ((si * 72) + 36 - 90) * Math.PI / 180;
            var outerR = item.width / 2;
            var innerR = item.width / 4;
            if (si === 0) {
              ctx.moveTo(Math.cos(outerAngle) * outerR, Math.sin(outerAngle) * outerR);
            } else {
              ctx.lineTo(Math.cos(outerAngle) * outerR, Math.sin(outerAngle) * outerR);
            }
            ctx.lineTo(Math.cos(innerAngle) * innerR, Math.sin(innerAngle) * innerR);
          }
          ctx.closePath();
          ctx.fill();
          // 发光效果
          ctx.shadowColor = starColor;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.restore();
          break;

        case 'diamond':
          // 钻石：菱形（旋转45度的正方形）+ 内部闪光点
          var dcx = x + item.width / 2;
          var dcy = y + item.height / 2;
          ctx.save();
          ctx.translate(dcx, dcy);
          ctx.rotate(Math.PI / 4); // 45度旋转
          // 菱形主体
          ctx.fillStyle = config.color;
          this._roundRect(ctx, -item.width * 0.35, -item.height * 0.35, item.width * 0.7, item.height * 0.7, 3);
          ctx.fill();
          // 高光边框
          ctx.strokeStyle = '#C39BD3';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // 内部闪光点（闪烁）
          if (Math.sin(now * 0.008) > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(-item.width * 0.1, -item.height * 0.1, 3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
          break;
      }

      ctx.restore();
    }
  }

  // ========== 角色渲染（Phase 2: 增强动画效果 + Phase 5: 无敌闪烁）==========
  _renderPlayer(ctx) {
    var p = this.player;

    // Phase 5: 无敌闪烁效果（3秒无敌期内角色半透明闪烁）
    var now = Date.now();
    if (now < this.invincibleUntil) {
      // 闪烁值在0.1~0.7之间快速变化（正弦波）
      var flickerAlpha = 0.1 + Math.abs(Math.sin(now * 0.015)) * 0.6;
      ctx.globalAlpha = flickerAlpha;
    }

    // 根据速度选择姿态
    var imgName = IMG.PLAYER_IDLE;
    if (p.vy < -2) imgName = IMG.PLAYER_JUMP;
    else if (p.vy > 2) imgName = IMG.PLAYER_FALL;

    // Phase 2: 计算动画效果参数
    // 1. 待机呼吸动画（静止时轻微上下浮动，±2px，周期约2秒）
    var breathOffset = 0;
    if (Math.abs(p.vx) < 0.5 && Math.abs(p.vy) < 1) {
      breathOffset = Math.sin(Date.now() * 0.003) * 2;
    }

    // 2. 落地挤压效果（着陆瞬间压扁回弹）
    var squashScaleY = 1;
    var squashScaleX = 1;
    if (p.justLanded) {
      squashScaleY = 0.8;
      squashScaleX = 1.15;
      p.justLanded = false;  // 只触发一次
    }

    var playerImg = this._img(imgName);
    if (playerImg) {
      // 绘制精灵图（支持平滑翻转方向 + 挤压缩放 + 呼吸偏移）
      ctx.save();
      var cx = p.x + p.width / 2;
      var cy = p.y + p.height / 2 + breathOffset;

      // 应用变换：先移到中心 → 缩放(挤压+方向翻转) → 移回原位
      ctx.translate(cx, cy);
      ctx.scale(squashScaleX * (p.direction < 0 ? -1 : 1), squashScaleY);
      ctx.translate(-cx, -cy);

      ctx.drawImage(playerImg, p.x, p.y, p.width, p.height);
      ctx.restore();
    } else {
      // 降级为圆形角色（同样应用动画效果）
      var cx = p.x + p.width / 2;
      var cy = p.y + p.height / 2 + breathOffset;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(squashScaleX * (p.direction < 0 ? -1 : 1), squashScaleY);
      ctx.translate(-cx, -cy);

      ctx.fillStyle = '#FF6B6B';
      ctx.beginPath(); ctx.arc(cx, cy, p.width / 2, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      var eo = p.direction * 4;
      ctx.beginPath(); ctx.arc(cx + eo - 4, cy - 4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + eo + 4, cy - 4, 4, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#2D3436';
      ctx.beginPath(); ctx.arc(cx + eo - 3, cy - 4, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + eo + 5, cy - 4, 2, 0, Math.PI * 2); ctx.fill();

      ctx.restore();
    }

    // Phase 5: 恢复globalAlpha（无敌闪烁效果结束后）
    if (now < this.invincibleUntil) {
      ctx.globalAlpha = 1;
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

  // ========== UI动画系统（Phase 3）==========

  /**
   * 重置所有动画状态到初始值
   */
  _resetAnimationState() {
    var anim = this.animationState;
    anim.logoFloatOffset = 0;
    anim.logoFloatPhase = 0;
    anim.modalSlideProgress = 0;
    anim.modalAlpha = 0;
    anim.starRotation = 0;
    anim.starScale = 0;
    anim.scoreRollValue = 0;
    anim.scoreRollTarget = 0;
    anim.pulseScale = 1.0;
    anim.lifeFlashAlpha = 0;
    anim.levelFlashAlpha = 0;
    anim.coinFlashAlpha = 0;
    anim.loadTipIndex = 0;
    anim.loadTipTimer = 0;
  }

  /**
   * 更新所有UI动画状态（每帧调用）
   * @param {number} factor - 时间因子（基于dt/16.67）
   */
  _updateAnimations(factor) {
    var anim = this.animationState;
    var now = Date.now();

    // 1. Logo浮动动画（2秒周期，±3px偏移）
    anim.logoFloatPhase += 0.00314 * factor;  // 2π / 2000ms ≈ 0.00314
    if (anim.logoFloatPhase > Math.PI * 2) {
      anim.logoFloatPhase -= Math.PI * 2;
    }
    anim.logoFloatOffset = Math.sin(anim.logoFloatPhase) * 3;

    // 2. 弹窗滑入动画（游戏结束状态时）
    if (this.state === GAME_STATE.OVER) {
      if (anim.modalSlideProgress < 1) {
        anim.modalSlideProgress = Math.min(1, anim.modalSlideProgress + 0.025 * factor);
        anim.modalAlpha = this._easeOutCubic(anim.modalSlideProgress);
      }

      // 新纪录星星动画
      if (anim.starScale < 1) {
        anim.starScale = Math.min(1, anim.starScale + 0.03 * factor);
      }
      anim.starRotation += 5 * factor;  // 每帧旋转5度

      // 分数滚动动画
      if (anim.scoreRollValue < anim.scoreRollTarget) {
        var diff = anim.scoreRollTarget - anim.scoreRollValue;
        anim.scoreRollValue += Math.ceil(diff * 0.08 * factor);  // 加速滚动
        if (anim.scoreRollValue > anim.scoreRollTarget) {
          anim.scoreRollValue = anim.scoreRollTarget;
        }
      }
    } else {
      // 非OVER状态时重置弹窗动画
      anim.modalSlideProgress = 0;
      anim.modalAlpha = 0;
      anim.starScale = 0;
      anim.starRotation = 0;
      anim.scoreRollValue = 0;
      anim.scoreRollTarget = 0;
    }

    // 3. 按钮脉冲呼吸效果（正弦波 1.0→1.03）
    anim.pulseScale = 1.0 + Math.sin(now * 0.003) * 0.015;

    // 4. 闪烁效果衰减（生命值/关卡/金币）
    if (anim.lifeFlashAlpha > 0) {
      anim.lifeFlashAlpha = Math.max(0, anim.lifeFlashAlpha - 0.05 * factor);
    }
    if (anim.levelFlashAlpha > 0) {
      anim.levelFlashAlpha = Math.max(0, anim.levelFlashAlpha - 0.05 * factor);
    }
    if (anim.coinFlashAlpha > 0) {
      anim.coinFlashAlpha = Math.max(0, anim.coinFlashAlpha - 0.05 * factor);
    }

    // 5. 加载提示文字轮播（每1.5秒切换）
    if (this.state === GAME_STATE.LOADING) {
      anim.loadTipTimer += 16.67 * factor;  // 约60fps
      if (anim.loadTipTimer > 1500) {
        anim.loadTipTimer = 0;
        anim.loadTipIndex = (anim.loadTipIndex + 1) % 3;
      }
    }
  }

  /**
   * 缓动函数：三次方缓出
   */
  _easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * 触发生命值闪烁
   */
  triggerLifeFlash() {
    this.animationState.lifeFlashAlpha = 1;
  }

  /**
   * 触发关卡升级闪烁
   */
  triggerLevelFlash() {
    this.animationState.levelFlashAlpha = 1;
  }

  /**
   * 触发金币收集闪烁
   */
  triggerCoinFlash() {
    this.animationState.coinFlashAlpha = 1;
  }

  /**
   * 初始化分数滚动动画（游戏结束时调用）
   */
  _initScoreRoll(targetScore) {
    this.animationState.scoreRollValue = 0;
    this.animationState.scoreRollTarget = targetScore;
  }

  // ========== UI 辅助绘制方法（增强版）==========

  /**
   * 绘制渐变按钮（主操作按钮使用）
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} btn - 按钮区域 {x, y, w, h}
   * @param {Array} colors - 渐变色数组 [起始色, 结束色]
   * @param {string} text - 按钮文字
   * @param {number} fontSize - 字体大小
   * @param {number} scale - 缩放比例（用于脉冲动画）
   */
  _renderButtonWithGradient(ctx, btn, colors, text, fontSize, scale) {
    scale = scale || 1;
    var cx = btn.x + btn.w / 2;
    var cy = btn.y + btn.h / 2;
    var sw = btn.w * scale;
    var sh = btn.h * scale;
    var sx = cx - sw / 2;
    var sy = cy - sh / 2;

    ctx.save();

    // 阴影
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    // 渐变填充
    var grad = ctx.createLinearGradient(sx, sy, sx, sy + sh);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(1, colors[1]);
    ctx.fillStyle = grad;

    // 圆角矩形
    this._roundRect(ctx, sx, sy, sw, sh, 12);
    ctx.fill();

    // 文字
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold ' + (fontSize || 18) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy);

    ctx.restore();
  }

  /**
   * 绘制圆角进度条（胶囊形状）
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {number} w - 宽度
   * @param {number} h - 高度
   * @param {number} progress - 进度 0~1
   * @param {Array} colors - 渐变色 [起始色, 结束色]
   */
  _drawProgressBar(ctx, x, y, w, h, progress, colors) {
    var radius = h / 2;

    // 背景轨道
    ctx.fillStyle = 'rgba(200,200,200,0.3)';
    this._roundRect(ctx, x, y, w, h, radius);
    ctx.fill();

    // 填充条（最小5%宽度显示）
    var fillW = Math.max(w * 0.05, w * Math.max(0, Math.min(1, progress)));
    if (fillW > 0) {
      var grad = ctx.createLinearGradient(x, y, x + fillW, y);
      grad.addColorStop(0, colors[0]);
      grad.addColorStop(1, colors[1]);
      ctx.fillStyle = grad;
      this._roundRect(ctx, x, y, fillW, h, radius);
      ctx.fill();
    }
  }

  /**
   * 绘制毛玻璃背景面板
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {number} w - 宽度
   * @param {number} h - 高度
   * @param {number} radius - 圆角
   * @param {number} alpha - 透明度
   */
  _drawGlassPanel(ctx, x, y, w, h, radius, alpha) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,' + (alpha || 0.85) + ')';
    this._roundRect(ctx, x, y, w, h, radius || 16);

    // 内边框高光效果
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, x + 1, y + 1, w - 2, h - 2, radius || 16);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 绘制音量滑块
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {number} w - 宽度
   * @param {number} value - 当前值 0-100
   * @param {string} label - 标签文字
   */
  _drawVolumeSlider(ctx, x, y, w, value, label) {
    var h = 6;
    var radius = h / 2;

    // 标签
    ctx.fillStyle = '#444444';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y - 12);

    // 轨道背景
    ctx.fillStyle = 'rgba(200,200,200,0.4)';
    this._roundRect(ctx, x, y, w, h, radius);
    ctx.fill();

    // 填充
    var fillW = w * (value / 100);
    var grad = ctx.createLinearGradient(x, y, x + fillW, y);
    grad.addColorStop(0, '#4ECDC4');
    grad.addColorStop(1, '#44A08D');
    ctx.fillStyle = grad;
    this._roundRect(ctx, x, y, fillW, h, radius);
    ctx.fill();

    // 滑块圆点
    var dotX = x + fillW;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(dotX, y + h / 2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4ECDC4';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * 绘制基础按钮
   */
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

  /**
   * 播放按钮点击音效（供外部调用）
   */
  playButtonSound() {
    if (this.audioManager) {
      this.audioManager.playSound(AudioManager.SOUNDS.BUTTON);
    }
  }

  /**
   * 切换静音状态（供外部调用）
   */
  toggleMute() {
    if (this.audioManager) {
      this.volumeSettings.muted = !this.volumeSettings.muted;
      this.audioManager.setMuted(this.volumeSettings.muted);
    }
  }

  // ========== Phase 7: 粒子系统 ==========

  /**
   * 发射粒子
   * @param {number} x - 发射位置X
   * @param {number} y - 发射位置Y
   * @param {Object} config - 粒子配置 { count, type, color, speed, life, size, gravity, spread }
   */
  _emitParticles(x, y, config) {
    if (this.particles.length >= this.MAX_PARTICLES) return;

    for (var i = 0; i < config.count && this.particles.length < this.MAX_PARTICLES; i++) {
      var angle = (config.spread || Math.PI * 2) * (i / config.count) + Math.random() * 0.5;
      var speed = config.speed * (0.5 + Math.random() * 0.5);

      var particle = {
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: config.life * (0.7 + Math.random() * 0.3),
        maxLife: config.life,
        size: config.size * (0.6 + Math.random() * 0.8),
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
        gravity: config.gravity !== false,
        scale: 1,
        type: config.type || 'generic',
      };

      // death类型：随机多彩
      if (config.type === 'death') {
        var colors = ['#FF6B6B', '#4ECDC4', '#FFD700', '#FF8E53', '#9B59B6', '#3498DB'];
        particle.color = colors[Math.floor(Math.random() * colors.length)];
      }
      // confetti类型：彩虹色相旋转
      else if (config.type === 'confetti') {
        var hue = (Date.now() * 0.1 + i * 30) % 360;
        particle.color = 'hsl(' + hue + ', 80%, 60%)';
      }
      else {
        particle.color = config.color || '#FFFFFF';
      }

      this.particles.push(particle);
    }
  }

  /**
   * 更新所有粒子
   * @param {number} dt - 帧间隔时间(ms)
   */
  _updateParticles(dt) {
    var factor = dt / 16.67;

    for (var i = this.particles.length - 1; i >= 0; i--) {
      var p = this.particles[i];

      // 生命递减
      p.life -= 0.016 * factor;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // 物理更新
      p.x += p.vx * factor;
      p.y += p.vy * factor;
      if (p.gravity) p.vy += PHYSICS.gravity * 0.5 * factor;

      // 视觉衰减
      p.alpha = Math.max(0, p.life / p.maxLife);
      p.rotation += p.rotationSpeed * 0.01 * factor;

      // 淡出缩放（最后30%时间缩小）
      if (p.life < p.maxLife * 0.3) {
        p.scale = Math.max(0.1, p.life / (p.maxLife * 0.3));
      }
    }
  }

  /**
   * 渲染所有粒子
   * @param {CanvasRenderingContext2D} ctx
   */
  _renderParticles(ctx) {
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.scale(p.scale, p.scale);

      switch (p.type) {
        case 'jump':
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill();
          break;
        case 'star':
          this._drawStar(ctx, 0, 0, 5, p.size / 2, p.size / 4);
          break;
        case 'break':
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          break;
        case 'coin':
          ctx.fillStyle = '#FFD700';
          ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#B8860B';
          ctx.font = 'bold ' + (p.size * 0.6) + 'px sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('$', 0, 0);
          break;
        default:
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill();
      }

      ctx.restore();
    }
  }

  /**
   * 绘制五角星（辅助方法）
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx - 中心X
   * @param {number} cy - 中心Y
   * @param {number} spikes - 尖角数
   * @param {number} outerRadius - 外半径
   * @param {number} innerRadius - 内半径
   */
  _drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    var rot = Math.PI / 2 * 3;
    var x = cx;
    var y = cy;
    var step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (var i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;
      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.closePath();
    ctx.fill();
  }

  // ========== Phase 7: 屏幕震动效果 ==========

  /**
   * 触发屏幕震动
   * @param {number} intensity - 震动幅度(px)
   * @param {number} duration - 持续时间(ms)
   */
  triggerScreenShake(intensity, duration) {
    this.screenShake.active = true;
    this.screenShake.intensity = intensity;
    this.screenShake.duration = duration;
    this.screenShake.startTime = Date.now();
  }

  /**
   * 应用屏幕震动偏移（在render开头调用）
   * @param {CanvasRenderingContext2D} ctx
   */
  applyScreenShake(ctx) {
    if (!this.screenShake.active) return;

    var elapsed = Date.now() - this.screenShake.startTime;
    if (elapsed >= this.screenShake.duration) {
      this.screenShake.active = false;
      return;
    }

    var progress = elapsed / this.screenShake.duration;
    var decay = 1 - progress;
    var offsetX = (Math.random() - 0.5) * this.screenShake.intensity * decay;
    var offsetY = (Math.random() - 0.5) * this.screenShake.intensity * decay;

    ctx.translate(offsetX, offsetY);
  }

  // ========== Phase 7: 动态背景增强 ==========

  /**
   * 渲染背景装饰（基于主题的动态元素）
   * @param {CanvasRenderingContext2D} ctx
   */
  _renderBackgroundDecorations(ctx) {
    var now = Date.now();
    var w = this.screenWidth;
    var h = this.screenHeight;

    // 根据关卡选择装饰类型（简单映射：level → 装饰风格）
    var decorType = this._getBackgroundDecorType();

    switch (decorType) {
      case 'petal':  // 春日花瓣（关卡1-3）
        for (var i = 0; i < 8; i++) {
          var px = ((now * 0.02 + i * 137) % w);
          var py = ((now * 0.03 + i * 89) % h);
          var alpha = 0.3 + Math.sin(now * 0.001 + i) * 0.2;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = '#FFB7C5';
          ctx.beginPath();
          ctx.ellipse(px, py, 4, 2, now * 0.0005 + i, 0, Math.PI * 2);
          ctx.fill();
        }
        break;

      case 'bubble':  // 海洋气泡（关卡4-6）
        for (var i = 0; i < 6; i++) {
          var bx = ((now * 0.015 + i * 173) % w);
          var by = h - ((now * 0.04 + i * 97) % h);
          ctx.globalAlpha = 0.2 + Math.sin(now * 0.002 + i) * 0.15;
          ctx.strokeStyle = '#4FC3F7';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(bx, by, 5 + (i % 3) * 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;

      case 'spark':  // 火山火星（关卡7-9）
        for (var i = 0; i < 10; i++) {
          var sx = ((now * 0.03 + i * 111) % w);
          var sy = ((now * 0.05 + i * 73) % h);
          ctx.globalAlpha = 0.4 + Math.random() * 0.3;
          ctx.fillStyle = i % 2 === 0 ? '#FF4500' : '#FFD700';
          ctx.beginPath();
          ctx.arc(sx, sy, 1 + Math.random() * 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;

      case 'snowflake':  // 冰雪雪花（关卡10-12）
        for (var i = 0; i < 12; i++) {
          var snx = ((now * 0.01 + i * 127) % w);
          var sny = ((now * 0.025 + i * 83) % h);
          ctx.globalAlpha = 0.5 + Math.sin(now * 0.001 + i) * 0.3;
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath(); ctx.arc(snx, sny, 2, 0, Math.PI * 2); ctx.fill();
          ctx.fillRect(snx - 4, sny - 0.5, 8, 1);
          ctx.fillRect(snx - 0.5, sny - 4, 1, 8);
        }
        break;

      case 'star':  // 星空闪烁（关卡13+）
        for (var i = 0; i < 15; i++) {
          var stx = ((now * 0.005 + i * 149) % w);
          var sty = ((now * 0.008 + i * 101) % h * 0.7);
          var twinkle = 0.3 + Math.abs(Math.sin(now * 0.003 + i * 2));
          ctx.globalAlpha = twinkle;
          ctx.fillStyle = '#FFFFAA';
          this._drawStar(ctx, stx, sty, 4, 2, 1);
        }
        break;
    }

    ctx.globalAlpha = 1;
  }

  /**
   * 根据当前关卡获取背景装饰类型
   * @returns {string} 装饰类型
   */
  _getBackgroundDecorType() {
    var level = this.level;
    if (level <= 3) return 'petal';
    if (level <= 6) return 'bubble';
    if (level <= 9) return 'spark';
    if (level <= 12) return 'snowflake';
    return 'star';
  }

  getState() { return this.state; }

  destroy() {
    if (this.animFrameId) { this.canvas.cancelAnimationFrame(this.animFrameId); this.animFrameId = null; }
    // 销毁音频管理器，释放音频资源
    if (this.audioManager) {
      this.audioManager.destroy();
      this.audioManager = null;
    }
  }
}

module.exports = GameEngine;
