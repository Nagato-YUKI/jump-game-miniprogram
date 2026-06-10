// pages/index/index.js
const GameEngine = require('../../utils/game-engine');
const ScoreManager = require('../../utils/score-manager');
const ImageLoader = require('../../utils/image-loader');

Page({
  data: {
    gameState: 'idle',
    score: 0,
    level: 1,
    bestScore: 0,
    isNewRecord: false,
  },

  gameEngine: null,
  scoreManager: null,
  imageLoader: null,

  // 资源列表（对应 images/ 目录下的文件）
  resourceList: [
    { name: 'player_idle', url: '/images/player/player_idle.png' },
    { name: 'player_jump', url: '/images/player/player_jump.png' },
    { name: 'player_fall', url: '/images/player/player_fall.png' },
    { name: 'platform_normal', url: '/images/platforms/platform_normal.png' },
    { name: 'platform_spring', url: '/images/platforms/platform_spring.png' },
    { name: 'platform_fragile', url: '/images/platforms/platform_fragile.png' },
    { name: 'platform_moving', url: '/images/platforms/platform_moving.png' },
    { name: 'bg_gradient', url: '/images/bg/bg_gradient.png' },
    { name: 'bg_clouds', url: '/images/bg/bg_clouds.png' },
    { name: 'bg_mountains', url: '/images/bg/bg_mountains.png' },
    { name: 'btn_start', url: '/images/ui/btn_start.png' },
    { name: 'btn_restart', url: '/images/ui/btn_restart.png' },
    { name: 'btn_home', url: '/images/ui/btn_home.png' },
    { name: 'panel_start', url: '/images/ui/panel_start.png' },
    { name: 'panel_gameover', url: '/images/ui/panel_gameover.png' },
    { name: 'logo_title', url: '/images/ui/logo_title.png' },
    { name: 'icon_pause', url: '/images/ui/icon_pause.png' },
    { name: 'particle_star', url: '/images/effects/particle_star.png' },
    { name: 'effect_spring', url: '/images/effects/effect_spring.png' },
    { name: 'effect_break', url: '/images/effects/effect_break.png' },
  ],

  onLoad() {
    this.scoreManager = new ScoreManager();
    this.setData({ bestScore: this.scoreManager.getBestScore() });
  },

  onReady() {
    this.initCanvas();
  },

  initCanvas() {
    var self = this;
    var query = wx.createSelectorQuery();
    query.select('#gameCanvas')
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (!res || !res[0]) {
          console.error('Canvas 节点获取失败');
          return;
        }

        var canvas = res[0].node;
        var ctx = canvas.getContext('2d');
        var windowInfo = wx.getWindowInfo();
        var dpr = windowInfo.pixelRatio;

        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);

        // 创建引擎
        self.gameEngine = new GameEngine(
          canvas, ctx,
          windowInfo.windowWidth,
          windowInfo.windowHeight
        );

        // 设置回调
        self.gameEngine.onScoreUpdate = function (score) {
          self.setData({ score: score });
        };
        self.gameEngine.onLevelUpdate = function (level) {
          self.setData({ level: level });
        };
        self.gameEngine.onGameOver = function (score, bestScore) {
          var isNewRecord = self.scoreManager.updateBestScore(score);
          self.setData({
            gameState: 'over',
            score: score,
            bestScore: bestScore,
            isNewRecord: isNewRecord,
          });
        };

        // 加载图片资源
        self.loadResources(canvas);
      });
  },

  /** 加载所有图片资源 */
  loadResources(canvas) {
    var self = this;
    this.imageLoader = new ImageLoader(canvas);

    this.imageLoader.load(
      this.resourceList,
      // 进度回调
      function (loaded, total, name) {
        if (self.gameEngine) {
          self.gameEngine.showLoading(loaded, total);
        }
      }
    ).then(function (images) {
      // 注入图片到引擎
      if (self.gameEngine) {
        self.gameEngine.setImages(images);
        // 初始化并显示开始界面
        self.gameEngine.init();
      }
      console.log('资源加载完成，共', Object.keys(images).length, '张图片');
    }).catch(function (err) {
      console.warn('部分资源加载失败，使用降级模式', err);
      // 即使加载失败也初始化游戏（使用色块降级）
      if (self.gameEngine) {
        self.gameEngine.init();
      }
    });
  },

  // ========== 触摸事件 ==========
  onTouchStart(e) {
    if (!this.gameEngine) return;
    var touch = e.touches[0];
    var action = this.gameEngine.handleTouch(touch.x, touch.y);
    this._dispatchAction(action);
  },

  onTouchMove(e) {
    if (!this.gameEngine) return;
    var touch = e.touches[0];
    var action = this.gameEngine.handleTouch(touch.x, touch.y);
    if (action === 'pause') { this._dispatchAction(action); }
  },

  onTouchEnd() {
    if (this.gameEngine) { this.gameEngine.handleTouchEnd(); }
  },

  _dispatchAction(action) {
    switch (action) {
      case 'startGame':
        this.setData({ gameState: 'playing', score: 0, level: 1, isNewRecord: false });
        this.gameEngine.start();
        break;
      case 'ranking':
        wx.navigateTo({ url: '/pages/ranking/index' });
        break;
      case 'pause':
        this.togglePause();
        break;
      case 'restart':
        this.setData({ gameState: 'playing', score: 0, level: 1, isNewRecord: false });
        this.gameEngine.restart();
        break;
      case 'home':
        this.setData({ gameState: 'idle', score: 0, level: 1, isNewRecord: false });
        this.gameEngine.init();
        break;
      case 'submitScore':
        this.submitScore();
        break;
    }
  },

  togglePause() {
    if (!this.gameEngine) return;
    var state = this.gameEngine.getState();
    if (state === 'playing') {
      this.gameEngine.pause();
      this.setData({ gameState: 'paused' });
    } else if (state === 'paused') {
      this.gameEngine.resume();
      this.setData({ gameState: 'playing' });
    }
  },

  submitScore() {
    if (!this.scoreManager) return;
    var self = this;
    wx.showLoading({ title: '提交中...' });
    this.scoreManager.submitScore(this.data.score, this.data.level)
      .then(function () {
        wx.hideLoading();
        wx.showToast({ title: '提交成功', icon: 'success' });
      })
      .catch(function (err) {
        wx.hideLoading();
        wx.showToast({ title: '提交失败', icon: 'none' });
        console.error('提交分数失败', err);
      });
  },

  onHide() {
    if (this.gameEngine && this.data.gameState === 'playing') {
      this.gameEngine.pause();
      this.setData({ gameState: 'paused' });
    }
  },

  onUnload() {
    if (this.gameEngine) { this.gameEngine.destroy(); }
  },
});
