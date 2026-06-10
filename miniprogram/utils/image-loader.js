/**
 * 图片加载器 - 微信小程序 Canvas 2D 专用
 *
 * 加载策略: wx.cloud.downloadFile() 云端优先 → 失败自动回退本地文件
 * 兼容所有环境: 模拟器 / 真机调试 / 体验版 / 正式版
 */

var assetConfig = require('./asset-config');

class ImageLoader {
  constructor(canvas) {
    this.canvas = canvas;
    this.images = {};
    this.totalCount = 0;
    this.loadedCount = 0;
  }

  /**
   * 加载图片资源列表
   * @param {Array} resources - [{name:'player_idle'}, ...] (自动从asset-config解析)
   * @param {Function} onProgress - 回调 (loadedCount, totalCount, imageName)
   * @returns {Promise<Object>} 加载完成的图片对象 {name: Image}
   */
  load(resources, onProgress) {
    var self = this;
    self.images = {};
    self.totalCount = resources.length;
    self.loadedCount = 0;

    return new Promise(function (resolve, reject) {
      if (resources.length === 0) {
        resolve(self.images);
        return;
      }

      var completed = 0;

      for (var i = 0; i < resources.length; i++) {
        (function (res) {
          var cfg = assetConfig.IMAGE_CONFIGS[res.name];
          if (!cfg) {
            console.warn('[ImageLoader] 未找到配置:', res.name);
            completed++;
            self.loadedCount++;
            if (onProgress) onProgress(self.loadedCount, self.totalCount, res.name);
            if (completed >= self.totalCount) resolve(self.images);
            return;
          }

          // 尝试云端下载 → 回退本地
          self._loadWithCloudFallback(cfg, res.name, function () {
            completed++;
            if (onProgress) onProgress(self.loadedCount, self.totalCount, res.name);
            if (completed >= self.totalCount) resolve(self.images);
          });
        })(resources[i]);
      }
    });
  }

  /**
   * 云端下载 + 本地回退的完整加载流程
   * @param {Object} cfg - { fileID, local }
   * @param {string} name - 资源名称
   * @param {Function} onComplete - 完成回调（无论成功失败都调用）
   */
  _loadWithCloudFallback(cfg, name, onComplete) {
    var self = this;

    if (!assetConfig.USE_CLOUD || !cfg.fileID) {
      // 不用云，直接加载本地
      this._loadLocal(cfg.local, name, onComplete);
      return;
    }

    // Step 1: 尝试从云存储下载
    assetConfig.downloadFromCloud(cfg.fileID)
      .then(function (tempFilePath) {
        // Step 2: 用临时路径加载图片
        self._loadFromPath(tempFilePath, name, true, onComplete);
      })
      .catch(function () {
        // Step 3: 云端失败，回退本地
        console.log('[ImageLoader] 云下载失败，回退本地:', name);
        self._loadLocal(cfg.local, name, onComplete);
      });
  }

  /**
   * 从指定路径加载图片到 canvas image 对象
   */
  _loadFromPath(path, name, isCloud, onComplete) {
    var self = this;
    var img = this.canvas.createImage();
    img.onload = function () {
      self.images[name] = img;
      self.loadedCount++;
      if (isCloud) {
        console.log('[ImageLoader] 图片加载成功(云):', name);
      }
      onComplete();
    };
    img.onerror = function () {
      console.warn('[ImageLoader] 图片加载失败:', name, isCloud ? '(云)' : '(本地)');
      self.loadedCount++; // 也算完成，允许部分缺失
      onComplete();
    };
    img.src = path;
  }

  /**
   * 加载本地文件
   */
  _loadLocal(localPath, name, onComplete) {
    this._loadFromPath(localPath, name, false, onComplete);
  }

  /**
   * 获取已加载的图片
   * @param {string} name - 图片名称
   * @returns {Image|null}
   */
  get(name) {
    return this.images[name] || null;
  }

  /** 获取加载进度 0~1 */
  getProgress() {
    return this.totalCount > 0 ? this.loadedCount / this.totalCount : 1;
  }

  /** 是否全部加载完成 */
  isComplete() {
    return this.loadedCount >= this.totalCount;
  }
}

module.exports = ImageLoader;
