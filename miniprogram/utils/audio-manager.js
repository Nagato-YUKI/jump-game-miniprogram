/**
 * 音频管理器 - 微信小程序游戏专用
 * 管理 BGM 和音效的播放/暂停/音量控制
 *
 * 加载策略: 云存储URL优先 → 失败自动回退本地文件
 */

var assetConfig = require('./asset-config');

// 音效名称常量
const SOUNDS = {
  JUMP: 'jump',
  SPRING: 'spring',
  BREAK: 'break',
  COIN: 'coin',
  ITEM_SHIELD: 'shield',
  ITEM_SPRING: 'spring_shoe',
  ITEM_MAGNET: 'magnet',
  HURT: 'hurt',
  GAME_OVER: 'gameover',
  NEW_RECORD: 'newrecord',
  BUTTON: 'button',
};

class AudioManager {
  constructor() {
    /** @type {InnerAudioContext|null} BGM 音频实例 */
    this._bgmAudio = null;

    /** @type {Object<string, InnerAudioContext>} 音效实例池 */
    this._sfxPool = {};

    /** @type {boolean} 是否已初始化 */
    this._initialized = false;

    /** @type {boolean} 静音状态 */
    this._isMuted = false;

    /** @type {number} BGM 音量 (0~1) */
    this._bgmVolume = 1.0;

    /** @type {number} 音效音量 (0~1) */
    this._sfxVolume = 1.0;

    /** @type {Function|null} 切后台回调引用 */
    this._onHideHandler = null;

    /** @type {Function|null} 回前台回调引用 */
    this._onShowHandler = null;
  }

  // ==================== 公开属性（只读）====================

  get isMuted() {
    return this._isMuted;
  }

  get bgmVolume() {
    return this._bgmVolume;
  }

  get sfxVolume() {
    return this._sfxVolume;
  }

  // ==================== 核心方法 ====================

  /**
   * 初始化音频上下文，加载所有音频资源
   * 策略: 云存储优先 → onError 回退本地
   */
  init() {
    if (this._initialized) {
      console.warn('[AudioManager] 已初始化，跳过重复调用');
      return;
    }

    try {
      var self = this;
      var useCloud = assetConfig.isCloudReady();
      console.log('[AudioManager] 云存储模式:', useCloud ? '启用' : '未配置(使用本地)');

      // 创建 BGM 实例
      this._bgmAudio = wx.createInnerAudioContext();
      this._loadWithFallback(this._bgmAudio, assetConfig.getBGMUrl(), assetConfig.BGM_CONFIG.localPath, function(audio, finalUrl) {
        audio.loop = true;
        audio.volume = self._isMuted ? 0 : self._bgmVolume;
        audio.obeyMuteSwitch = false;
      });

      // 预创建所有音效实例
      var soundNames = Object.values(SOUNDS);
      for (var i = 0; i < soundNames.length; i++) {
        (function(name) {
          var sfxAudio = wx.createInnerAudioContext();
          var cloudUrl = assetConfig.getSFXUrl(name);
          var localUrl = (assetConfig.SFX_CONFIGS[name] || {}).localPath || '';

          self._loadWithFallback(sfxAudio, cloudUrl, localUrl, function(audio) {
            audio.volume = self._isMuted ? 0 : self._sfxVolume;
            audio.obeyMuteSwitch = false;
            self._sfxPool[name] = audio;
          });
        })(soundNames[i]);
      }

      // 注册小程序生命周期监听
      this._registerAppLifecycle();

      this._initialized = true;
      console.log('[AudioManager] 初始化完成，共加载 ' + soundNames.length + ' 个音效');
    } catch (e) {
      console.error('[AudioManager] 初始化异常', e);
    }
  }

  /**
   * 带回退机制的加载：先试云URL，失败则用本地路径
   * @private
   * @param {InnerAudioContext} audio - 音频实例
   * @param {string} primaryUrl - 首选URL（云存储）
   * @param {string} fallbackUrl - 回退URL（本地）
   * @param {Function} onSuccess - 加载成功回调 (audio, finalUrl)
   */
  _loadWithFallback(audio, primaryUrl, fallbackUrl, onSuccess) {
    var hasTriedFallback = false;
    var self = this;

    function doLoad(url, isFallback) {
      audio.src = url;
      audio.onCanplay(function() {
        // 成功加载，清除错误回调避免内存泄漏
        audio.onError(function() {});
        if (onSuccess) onSuccess(audio, url);
      });
      audio.onError(function(err) {
        if (!hasTriedFallback && fallbackUrl) {
          hasTriedFallback = true;
          console.warn('[AudioManager] 云加载失败，回退本地:', isFallback ? '(已回退)' : err);
          doLoad(fallbackUrl, true);
        } else {
          console.error('[AudioManager] 加载完全失败:', err);
        }
      });
    }

    // 如果云存储未配置或主URL与回退相同，直接用本地
    if (!primaryUrl || primaryUrl === fallbackUrl || !assetConfig.isCloudReady()) {
      doLoad(fallbackUrl, true);
    } else {
      doLoad(primaryUrl, false);
    }
  }

  /**
   * 播放背景音乐（循环）
   */
  playBGM() {
    if (!this._bgmAudio || !this._initialized) return;
    try {
      if (this._isMuted) return;
      this._bgmAudio.play();
    } catch (e) {
      console.warn('[AudioManager] playBGM 异常', e);
    }
  }

  /**
   * 暂停背景音乐
   */
  pauseBGM() {
    if (!this._bgmAudio || !this._initialized) return;
    try {
      this._bgmAudio.pause();
    } catch (e) {
      console.warn('[AudioManager] pauseBGM 异常', e);
    }
  }

  /**
   * 恢复背景音乐
   */
  resumeBGM() {
    if (!this._bgmAudio || !this._initialized) return;
    try {
      if (this._isMuted) return;
      if (typeof this._bgmAudio.resume === 'function') {
        this._bgmAudio.resume();
      } else if (typeof this._bgmAudio.play === 'function') {
        this._bgmAudio.play();
      }
    } catch (e) {
      console.warn('[AudioManager] resumeBGM 异常', e);
    }
  }

  /**
   * 停止背景音乐
   */
  stopBGM() {
    if (!this._bgmAudio || !this._initialized) return;
    try {
      this._bgmAudio.stop();
    } catch (e) {
      console.warn('[AudioManager] stopBGM 异常', e);
    }
  }

  /**
   * 播放指定音效
   * @param {string} name - 音效名称（使用 SOUNDS 常量）
   */
  playSound(name) {
    if (!this._initialized || this._isMuted) return;
    var audio = this._sfxPool[name];
    if (!audio) {
      console.warn('[AudioManager] 未找到音效: ' + name);
      return;
    }
    try {
      audio.seek(0);
      audio.play();
    } catch (e) {
      console.warn('[AudioManager] playSound [' + name + '] 异常', e);
    }
  }

  /**
   * 设置 BGM 音量
   * @param {number} volume - 音量值 (0~1)
   */
  setBGMVolume(volume) {
    this._bgmVolume = Math.max(0, Math.min(1, volume));
    if (this._bgmAudio && !this._isMuted) {
      this._bgmAudio.volume = this._bgmVolume;
    }
  }

  /**
   * 设置音效音量
   * @param {number} volume - 音量值 (0~1)
   */
  setSFXVolume(volume) {
    this._sfxVolume = Math.max(0, Math.min(1, volume));
    if (!this._isMuted) {
      for (var key in this._sfxPool) {
        this._sfxPool[key].volume = this._sfxVolume;
      }
    }
  }

  /**
   * 设置静音模式
   * @param {boolean} muted - 是否静音
   */
  setMuted(muted) {
    this._isMuted = muted;
    var targetVol = muted ? 0 : this._bgmVolume;
    var sfxTargetVol = muted ? 0 : this._sfxVolume;
    if (this._bgmAudio) {
      this._bgmAudio.volume = targetVol;
    }
    for (var key in this._sfxPool) {
      this._sfxPool[key].volume = sfxTargetVol;
    }
    console.log('[AudioManager] 静音模式: ' + (muted ? '开启' : '关闭'));
  }

  /**
   * 销毁所有音频资源，释放内存
   */
  destroy() {
    try {
      this._unregisterAppLifecycle();
      if (this._bgmAudio) {
        this._bgmAudio.stop();
        this._bgmAudio.destroy();
        this._bgmAudio = null;
      }
      for (var key in this._sfxPool) {
        this._sfxPool[key].stop();
        this._sfxPool[key].destroy();
      }
      this._sfxPool = {};
      this._initialized = false;
      console.log('[AudioManager] 已销毁');
    } catch (e) {
      console.error('[AudioManager] destroy 异常', e);
    }
  }

  // ==================== 内部方法 ====================

  _registerAppLifecycle() {
    var app = getApp();
    this._onHideHandler = function() { this.pauseBGM(); }.bind(this);
    this._onShowHandler = function() { this.resumeBGM(); }.bind(this);

    if (app.onHide) app.onHide(this._onHideHandler);
    if (app.onShow) app.onShow(this._onShowHandler);

    if (wx.onAppHide && wx.onAppShow) {
      wx.onAppHide(this._onHideHandler);
      wx.onAppShow(this._onShowHandler);
    }
  }

  _unregisterAppLifecycle() {
    this._onHideHandler = null;
    this._onShowHandler = null;
  }
}

// 导出音效常量
AudioManager.SOUNDS = SOUNDS;

module.exports = AudioManager;
