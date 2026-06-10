/**
 * 音频管理器 - 微信小程序专用
 *
 * 加载策略: wx.cloud.downloadFile() 云端优先 → 失败自动回退本地文件
 * 兼容所有环境: 模拟器 / 真机调试 / 体验版 / 正式版
 */

var assetConfig = require('./asset-config');

/**
 * 音效名称常量（与 SFX_CONFIGS 的 key 对应）
 */
var SOUNDS = {
  JUMP: 'jump',
  SPRING: 'spring',
  BREAK: 'break',
  COIN: 'coin',
  SHIELD: 'shield',
  SPRING_SHOE: 'spring_shoe',
  MAGNET: 'magnet',
  HURT: 'hurt',
  GAMEOVER: 'gameover',
  NEWRECORD: 'newrecord',
  BUTTON: 'button',
};

class AudioManager {
  constructor() {
    this._bgmAudio = null;
    this._sfxPool = {};
    this._initialized = false;
    this._isMuted = false;
    this._bgmVolume = 0.6;
    this._sfxVolume = 1.0;
    this._currentBGM = null;
  }

  // ==================== 公开API ====================

  get muted() {
    return this._isMuted;
  }

  get bgmVolume() {
    return this._bgmVolume;
  }

  get sfxVolume() {
    return this._sfxVolume;
  }

  /**
   * 初始化音频上下文，加载所有音频资源
   * 策略: 云端下载(wx.cloud.downloadFile) → onError 回退本地
   */
  init() {
    if (this._initialized) {
      console.warn('[AudioManager] 已初始化，跳过重复调用');
      return Promise.resolve();
    }

    var self = this;
    self._initialized = true;

    try {
      var cloudAvailable = assetConfig.USE_CLOUD && assetConfig.CLOUD_ENV_ID;
      console.log('[AudioManager] 云存储模式:', cloudAvailable ? '启用(云端优先)' : '未配置(使用本地)');

      // 创建 BGM 实例
      this._bgmAudio = wx.createInnerAudioContext();

      // 加载 BGM
      var bgmPromise = this._loadAudioWithFallback(
        this._bgmAudio,
        assetConfig.BGM_CONFIG.fileID,
        assetConfig.BGM_CONFIG.localPath,
        function (audio, finalUrl) {
          audio.loop = true;
          audio.volume = self._isMuted ? 0 : self._bgmVolume;
          audio.obeyMuteSwitch = false;
          self._currentBGM = finalUrl;
        }
      );

      // 预创建所有音效实例
      var soundNames = Object.values(SOUNDS);
      var sfxPromises = [];

      for (var i = 0; i < soundNames.length; i++) {
        (function (name) {
          var cfg = assetConfig.SFX_CONFIGS[name];
          if (!cfg) return;

          var sfxAudio = wx.createInnerAudioContext();
          sfxPromises.push(self._loadAudioWithFallback(
            sfxAudio,
            cfg.fileID,
            cfg.localPath,
            function (audio) {
              audio.volume = self._isMuted ? 0 : self._sfxVolume;
              audio.obeyMuteSwitch = false;
              self._sfxPool[name] = audio;
            }
          ));
        })(soundNames[i]);
      }

      // 等待所有音频加载完成
      return Promise.all([bgmPromise].concat(sfxPromises)).then(function () {
        console.log('[AudioManager] 初始化完成，共加载', Object.keys(self._sfxPool).length, '个音效');
      });

    } catch (e) {
      console.error('[AudioManager] 初始化异常:', e);
      return Promise.reject(e);
    }
  }

  /**
   * 云端下载 + 本地回退的音频加载流程
   */
  _loadAudioWithFallback(audio, fileID, localPath, onReady) {
    var self = this;

    if (!assetConfig.USE_CLOUD || !fileID) {
      return this._setAudioSrc(audio, localPath, onReady);
    }

    // 尝试云端下载
    return assetConfig.downloadFromCloud(fileID)
      .then(function (tempFilePath) {
        return self._setAudioSrc(audio, tempFilePath, onReady);
      })
      .catch(function () {
        console.log('[AudioManager] 云下载失败，回退本地:', localPath);
        return self._setAudioSrc(audio, localPath, onReady);
      });
  }

  /**
   * 设置音频源并等待就绪
   */
  _setAudioSrc(audio, src, onReady) {
    return new Promise(function (resolve) {
      audio.src = src;
      // 等待 canplay 或 error
      var onCanPlay = function () {
        audio.offCanplay(onCanPlay);
        audio.offError(onError);
        if (onReady) onReady(audio, src);
        resolve();
      };
      var onError = function (err) {
        audio.offCanplay(onCanPlay);
        audio.offError(onError);
        console.warn('[AudioManager] 音频加载失败:', src, err.errMsg || err);
        resolve(); // 失败也resolve，不阻塞
      };
      audio.onCanplay(onCanPlay);
      audio.onError(onError);

      // 超时保护：3秒后强制resolve
      setTimeout(function () {
        audio.offCanplay(onCanPlay);
        audio.offError(onError);
        if (onReady) onReady(audio, src);
        resolve();
      }, 3000);
    });
  }

  // ==================== 播放控制 ====================

  playBGM() {
    if (!this._bgmAudio || !this._currentBGM) return;
    try {
      if (this._isMuted) return;
      this._bgmAudio.volume = this._bgmVolume;
      this._bgmAudio.play();
    } catch (e) { console.warn('[AudioManager] playBGM 异常', e); }
  }

  stopBGM() {
    if (!this._bgmAudio) return;
    try { this._bgmAudio.stop(); } catch (e) {}
  }

  pauseBGM() {
    if (!this._bgmAudio || !this._initialized) return;
    try {
      if (this._isMuted) return;
      if (typeof this._bgmAudio.resume === 'function') {
        this._bgmAudio.resume();
      } else if (typeof this._bgmAudio.play === 'function') {
        this._bgmAudio.play();
      }
    } catch (e) { console.warn('[AudioManager] resumeBGM 异常', e); }
  }

  playSound(name) {
    if (this._isMuted) return;
    var audio = this._sfxPool[name];
    if (!audio) return;
    try {
      audio.stop();
      audio.seek(0);
      audio.play();
    } catch (e) {
      try { audio.play(); } catch (e2) {}
    }
  }

  // ==================== 音量/静音 ====================

  setMuted(muted) {
    this._isMuted = !!muted;
    if (this._bgmAudio) {
      this._bgmAudio.volume = this._isMuted ? 0 : this._bgmVolume;
    }
    for (var key in this._sfxPool) {
      if (this._sfxPool[key]) {
        this._sfxPool[key].volume = this._isMuted ? 0 : this._sfxVolume;
      }
    }
  }

  setBGMVolume(vol) {
    this._bgmVolume = Math.max(0, Math.min(1, vol));
    if (this._bgmAudio && !this._isMuted) {
      this._bgmAudio.volume = this._bgmVolume;
    }
  }

  setSFXVolume(vol) {
    this._sfxVolume = Math.max(0, Math.min(1, vol));
    if (!this._isMuted) {
      for (var key in this._sfxPool) {
        if (this._sfxPool[key]) this._sfxPool[key].volume = this._sfxVolume;
      }
    }
  }

  toggleMute() {
    this.setMuted(!this._isMuted);
    return this._isMuted;
  }

  // ==================== 销毁 ====================

  destroy() {
    this.stopBGM();
    if (this._bgmAudio) { try { this._bgmAudio.destroy(); } catch(e) {} this._bgmAudio = null; }
    for (var key in this._sfxPool) {
      if (this._sfxPool[key]) {
        try { this._sfxPool[key].destroy(); } catch(e) {}
        delete this._sfxPool[key];
      }
    }
    this._initialized = false;
  }
}

// 导出单例和常量
module.exports = new AudioManager();
module.exports.SOUNDS = SOUNDS;
