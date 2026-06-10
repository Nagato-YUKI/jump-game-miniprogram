/**
 * 图片加载器 - 微信小程序 Canvas 2D 专用
 * 异步预加载所有游戏资源，支持进度回调
 */
class ImageLoader {
  constructor(canvas) {
    this.canvas = canvas;
    this.images = {};       // name → Image 对象
    this.totalCount = 0;
    this.loadedCount = 0;
  }

  /**
   * 加载图片资源列表
   * @param {Array} resources - [{name:'player', url:'/images/player.png'}, ...]
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
            console.warn('图片加载失败:', res.url);
            completed++;
            if (onProgress) {
              onProgress(self.loadedCount, self.totalCount, res.name);
            }
            if (completed >= self.totalCount) {
              resolve(self.images); // 即使部分失败也继续
            }
          };
          img.src = res.url;
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
