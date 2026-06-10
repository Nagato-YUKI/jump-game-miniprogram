/**
 * 图片加载器 - 微信小程序 Canvas 2D 专用
 * 异步预加载所有游戏资源，支持进度回调
 *
 * 加载策略: 云存储URL优先 → 失败自动回退本地文件
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
   * @param {Array} resources - [{name:'player', url:'/images/player.png'}, ...]
   *   或使用 asset-config 中的名称: [{name:'player_idle'}, ...] (自动解析云/本地路径)
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
          // 支持简写模式：只传 name，自动从 asset-config 解析路径
          var cloudUrl = null;
          var localUrl = res.url;

          if (!res.url && res.name) {
            var cfg = assetConfig.IMAGE_CONFIGS[res.name];
            if (cfg) {
              cloudUrl = cfg.cloud;   // 可能为null（表示只用本地）
              localUrl = cfg.local;
            }
          }

          // 确定实际加载的URL
          var primaryUrl = (cloudUrl && assetConfig.isCloudReady()) ? cloudUrl : localUrl;
          var fallbackUrl = localUrl;

          var img = self.canvas.createImage();
          img.onload = function () {
            self.images[res.name] = img;
            self.loadedCount++;
            completed++;
            if (onProgress) {
              onProgress(self.loadedCount, self.totalCount, res.name);
            }
            if (completed >= self.totalCount) {
              resolve(self.images);
            }
          };
          img.onerror = function () {
            // 云加载失败，尝试本地回退
            if (primaryUrl !== fallbackUrl && !img._hasTriedFallback) {
              img._hasTriedFallback = true;
              console.warn('[ImageLoader] 云图片加载失败，回退本地:', res.name);
              img.src = fallbackUrl;
              return;
            }
            console.warn('[ImageLoader] 图片加载失败:', res.name, primaryUrl);
            completed++;
            self.loadedCount++; // 也算完成（允许部分失败）
            if (onProgress) {
              onProgress(self.loadedCount, self.totalCount, res.name);
            }
            if (completed >= self.totalCount) {
              resolve(self.images);
            }
          };
          img.src = primaryUrl;
        })(resources[i]);
      }
    });
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
