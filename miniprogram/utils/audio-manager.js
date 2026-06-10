/**
 * 音频管理器 - 微信小程序游戏专用
 * 管理 BGM 和音效的播放/暂停/音量控制
 */

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

// 音频文件路径
const BGM_PATH = '/audio/bgm.wav';
const SFX_PATH_PREFIX = '/audio/sfx_';
const SFX_PATH_SUFFIX = '.wav';

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
   */
  init() {
    if (this._initialized) {
      console.warn('[AudioManager] 已初始化，跳过重复调用');
      return;
    }

    try {
      // 创建 BGM 实例
      this._bgmAudio = wx.createInnerAudioContext();
      this._bgmAudio.src = BGM_PATH;
      this._bgmAudio.loop = true;
      this._bgmAudio.volume = this._isMuted ? 0 : this._bgmVolume;
      this._bgmAudio.obeyMuteSwitch = false;

      // BGM 错误处理：加载失败不阻塞游戏
      this._bgmAudio.onError((err) => {
        console.warn('[AudioManager] BGM 加载失败', err);
      });

      // 预创建所有音效实例
      const soundNames = Object.values(SOUNDS);
      for (const name of soundNames) {
        const audio = wx.createInnerAudioContext();
        audio.src = `${SFX_PATH_PREFIX}${name}${SFX_PATH_SUFFIX}`;
        audio.volume = this._isMuted ? 0 : this._sfxVolume;
        audio.obeyMuteSwitch = false;

        audio.onError((err) => {
          console.warn(`[AudioManager] 音效 [${name}] 加载失败`, err);
        });

        this._sfxPool[name] = audio;
      }

      // 注册小程序生命周期监听：切后台暂停 / 回前台恢复
      this._registerAppLifecycle();

      this._initialized = true;
      console.log(`[AudioManager] 初始化完成，共加载 ${soundNames.length} 个音效`);
    } catch (e) {
      console.error('[AudioManager] 初始化异常', e);
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
      this._bgmAudio.resume();
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

    const audio = this._sfxPool[name];
    if (!audio) {
      console.warn(`[AudioManager] 未找到音效: ${name}`);
      return;
    }

    try {
      // InnerAudioContext 调用 play() 会从头播放，
      // 同一音效连续触发时自动覆盖上一次播放
      audio.seek(0);
      audio.play();
    } catch (e) {
      console.warn(`[AudioManager] playSound [${name}] 异常`, e);
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
      for (const audio of Object.values(this._sfxPool)) {
        audio.volume = this._sfxVolume;
      }
    }
  }

  /**
   * 设置静音模式
   * @param {boolean} muted - 是否静音
   */
  setMuted(muted) {
    this._isMuted = muted;

    const targetVol = muted ? 0 : this._bgmVolume;
    const sfxTargetVol = muted ? 0 : this._sfxVolume;

    if (this._bgmAudio) {
      this._bgmAudio.volume = targetVol;
    }

    for (const audio of Object.values(this._sfxPool)) {
      audio.volume = sfxTargetVol;
    }

    console.log(`[AudioManager] 静音模式: ${muted ? '开启' : '关闭'}`);
  }

  /**
   * 销毁所有音频资源，释放内存
   */
  destroy() {
    try {
      // 移除生命周期监听
      this._unregisterAppLifecycle();

      // 销毁 BGM
      if (this._bgmAudio) {
        this._bgmAudio.stop();
        this._bgmAudio.destroy();
        this._bgmAudio = null;
      }

      // 销毁所有音效实例
      for (const name of Object.keys(this._sfxPool)) {
        this._sfxPool[name].stop();
        this._sfxPool[name].destroy();
      }
      this._sfxPool = {};

      this._initialized = false;
      console.log('[AudioManager] 已销毁');
    } catch (e) {
      console.error('[AudioManager] destroy 异常', e);
    }
  }

  // ==================== 内部方法 ====================

  /**
   * 注册小程序切后台/回前台的生命周期监听
   * @private
   */
  _registerAppLifecycle() {
    const app = getApp();

    this._onHideHandler = () => {
      this.pauseBGM();
    };

    this._onShowHandler = () => {
      this.resumeBGM();
    };

    app.onHide?.(this._onHideHandler);
    app.onShow?.(this._onShowHandler);

    // 同时使用 wx 全局事件兜底
    if (wx.onAppHide && wx.onAppShow) {
      wx.onAppHide(() => this.pauseBGM());
      wx.onAppShow(() => this.resumeBGM());
    }
  }

  /**
   * 移除生命周期监听
   * @private
   */
  _unregisterAppLifecycle() {
    // 小程序 API 不支持 offAppHide/offAppShow，
    // 此处仅清除引用，避免内存泄漏
    this._onHideHandler = null;
    this._onShowHandler = null;
  }
}

// 导出音效常量，方便外部使用
AudioManager.SOUNDS = SOUNDS;

module.exports = AudioManager;
