/**
 * 分数管理器
 * 负责分数计算、最高分缓存和云同步
 */

const BEST_SCORE_KEY = 'jumpgame_best_score';

class ScoreManager {
  constructor() {
    this.bestScore = this.loadBestScore();
  }

  // 加载本地最高分
  loadBestScore() {
    try {
      const score = wx.getStorageSync(BEST_SCORE_KEY);
      return score || 0;
    } catch (e) {
      return 0;
    }
  }

  // 保存本地最高分
  saveBestScore(score) {
    try {
      wx.setStorageSync(BEST_SCORE_KEY, score);
    } catch (e) {
      console.error('保存最高分失败', e);
    }
  }

  // 获取最高分
  getBestScore() {
    return this.bestScore;
  }

  // 更新最高分
  updateBestScore(score) {
    if (score > this.bestScore) {
      this.bestScore = score;
      this.saveBestScore(score);
      return true; // 刷新记录
    }
    return false;
  }

  // 提交分数到云端
  submitScore(score, level, name) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'gameFunctions',
        data: {
          type: 'submitScore',
          data: { score, level, name },
        },
        success: (res) => {
          if (res.result && res.result.success) {
            resolve(res.result);
          } else {
            reject(new Error(res.result ? res.result.errMsg : '提交失败'));
          }
        },
        fail: (err) => {
          console.error('提交分数失败', err);
          reject(err);
        },
      });
    });
  }

  // 获取排行榜
  getRanking(limit) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'gameFunctions',
        data: {
          type: 'getRanking',
          data: { limit: limit || 100 },
        },
        success: (res) => {
          if (res.result && res.result.success) {
            resolve(res.result.data);
          } else {
            reject(new Error(res.result ? res.result.errMsg : '获取失败'));
          }
        },
        fail: (err) => {
          console.error('获取排行榜失败', err);
          reject(err);
        },
      });
    });
  }

  // 获取个人最佳
  getMyBest() {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'gameFunctions',
        data: {
          type: 'getMyBest',
          data: {},
        },
        success: (res) => {
          if (res.result && res.result.success) {
            resolve(res.result.data);
          } else {
            reject(new Error(res.result ? res.result.errMsg : '获取失败'));
          }
        },
        fail: (err) => {
          console.error('获取个人最佳失败', err);
          reject(err);
        },
      });
    });
  }
}

module.exports = ScoreManager;
