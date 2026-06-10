// app.js
App({
  onLaunch: function () {
    this.globalData = {
      env: "cloud1-d3gy3j3u472a74eb5",
    };
    // 云开发延迟初始化，避免阻塞页面加载和超时报错
    if (wx.cloud) {
      setTimeout(function () {
        try {
          wx.cloud.init({
            env: "cloud1-d3gy3j3u472a74eb5",
            traceUser: true,
          });
        } catch (e) {
          console.warn('云开发初始化失败（本地调试可忽略）:', e.message);
        }
      }, 500);
    }
  },
});
