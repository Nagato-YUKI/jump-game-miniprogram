// pages/ranking/index.js
const ScoreManager = require('../../utils/score-manager');

Page({
  data: {
    activeTab: 'global',
    rankingList: [],
    myBest: null,
    loading: false,
  },

  scoreManager: null,

  onLoad() {
    this.scoreManager = new ScoreManager();
    this.loadRanking();
    this.loadMyBest();
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadRanking();
    this.loadMyBest();
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.loadRanking();
  },

  // 加载排行榜
  loadRanking() {
    this.setData({ loading: true });
    this.scoreManager.getRanking(100)
      .then((data) => {
        this.setData({
          rankingList: data || [],
          loading: false,
        });
        wx.stopPullDownRefresh();
      })
      .catch((err) => {
        console.error('加载排行榜失败', err);
        this.setData({ loading: false });
        wx.stopPullDownRefresh();
        wx.showToast({
          title: '加载失败，请检查网络',
          icon: 'none',
        });
      });
  },

  // 加载个人最佳
  loadMyBest() {
    this.scoreManager.getMyBest()
      .then((data) => {
        if (data && data.score) {
          this.setData({ myBest: data.score });
        } else {
          this.setData({ myBest: this.scoreManager.getBestScore() });
        }
      })
      .catch(() => {
        // 云端获取失败，使用本地缓存
        this.setData({ myBest: this.scoreManager.getBestScore() });
      });
  },
});
