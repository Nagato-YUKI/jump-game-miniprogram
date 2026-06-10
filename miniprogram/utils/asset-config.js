/**
 * 资源配置中心 - 统一管理所有游戏资源的路径
 *
 * ==================== 加载策略 ====================
 *
 * 云端优先: wx.cloud.downloadFile() → 本地文件回退
 * - wx.cloud.downloadFile() 在模拟器/真机调试/体验版/正式版 全部兼容
 * - 本地文件作为安全兜底（云存储不可用时自动使用）
 *
 * ==================== 新增资源规则 ====================
 *
 * 1. 新图片/音频 → 先上传到云开发控制台「存储」对应目录
 * 2. 在下方配置中添加条目（fileID + localPath）
 * 3. 在 index.js resourceList 中注册名称
 * 4. 完成！（本地文件可选保留或删除）
 */

// ==================== 云存储配置 ====================

var USE_CLOUD = true;

/**
 * 云环境ID（用于构建 cloud:// fileID）
 * 获取方式: 微信开发者工具 → 云开发控制台 → 环境名称旁的ID
 */
var CLOUD_ENV_ID = '636c-cloud1-d3gy3j4u472a74eb5-1441215999';

/**
 * 构建云文件ID
 * @param {string} cloudPath - 云存储中的相对路径 (如 'audio/bgm.mp3')
 * @returns {string} 完整的 cloud:// fileID
 */
function makeCloudFileID(cloudPath) {
  return 'cloud://' + CLOUD_ENV_ID + '.' + cloudPath;
}

// ==================== 音频资源配置 ====================

var BGM_CONFIG = {
  name: 'bgm_cutie_patootie',
  fileID: makeCloudFileID('audio/bgm_cutie_patootie.mp3'),
  localPath: '/audio/bgm_cutie_patootie.mp3'
};

var SFX_CONFIGS = {
  jump:        { fileID: makeCloudFileID('audio/sfx_jump.wav'),        localPath: '/audio/sfx_jump.wav' },
  spring:      { fileID: makeCloudFileID('audio/sfx_spring.wav'),       localPath: '/audio/sfx_spring.wav' },
  break:       { fileID: makeCloudFileID('audio/sfx_break.wav'),        localPath: '/audio/sfx_break.wav' },
  coin:        { fileID: makeCloudFileID('audio/sfx_coin.wav'),         localPath: '/audio/sfx_coin.wav' },
  shield:      { fileID: makeCloudFileID('audio/sfx_shield.wav'),       localPath: '/audio/sfx_shield.wav' },
  spring_shoe: { fileID: makeCloudFileID('audio/sfx_spring_shoe.wav'),  localPath: '/audio/sfx_spring_shoe.wav' },
  magnet:      { fileID: makeCloudFileID('audio/sfx_magnet.wav'),       localPath: '/audio/sfx_magnet.wav' },
  hurt:        { fileID: makeCloudFileID('audio/sfx_hurt.wav'),         localPath: '/audio/sfx_hurt.wav' },
  gameover:    { fileID: makeCloudFileID('audio/sfx_gameover.wav'),     localPath: '/audio/sfx_gameover.wav' },
  newrecord:   { fileID: makeCloudFileID('audio/sfx_newrecord.wav'),    localPath: '/audio/sfx_newrecord.wav' },
  button:      { fileID: makeCloudFileID('audio/sfx_button.wav'),       localPath: '/audio/sfx_button.wav' },
};

// ==================== 图片资源配置 ====================

var IMAGE_CONFIGS = {
  // 角色
  player_idle:  { fileID: makeCloudFileID('images/player/player_idle.png'),  local: '/images/player/player_idle.png' },
  player_jump:  { fileID: makeCloudFileID('images/player/player_jump.png'),  local: '/images/player/player_jump.png' },
  player_fall:  { fileID: makeCloudFileID('images/player/player_fall.png'),  local: '/images/player/player_fall.png' },

  // 平台
  platform_normal:  { fileID: makeCloudFileID('images/platforms/platform_normal.png'),  local: '/images/platforms/platform_normal.png' },
  platform_spring:  { fileID: makeCloudFileID('images/platforms/platform_spring.png'),  local: '/images/platforms/platform_spring.png' },
  platform_fragile: { fileID: makeCloudFileID('images/platforms/platform_fragile.png'), local: '/images/platforms/platform_fragile.png' },
  platform_moving:  { fileID: makeCloudFileID('images/platforms/platform_moving.png'),  local: '/images/platforms/platform_moving.png' },

  // 背景
  bg_gradient: { fileID: makeCloudFileID('images/bg/bg_gradient.jpg'), local: '/images/bg/bg_gradient.jpg' },
  bg_clouds:   { fileID: makeCloudFileID('images/bg/bg_clouds.jpg'),   local: '/images/bg/bg_clouds.jpg' },
  bg_mountains:{ fileID: makeCloudFileID('images/bg/bg_mountains.jpg'),local: '/images/bg/bg_mountains.jpg' },

  // UI面板
  btn_start:     { fileID: makeCloudFileID('images/ui/btn_start.png'),      local: '/images/ui/btn_start.png' },
  btn_restart:   { fileID: makeCloudFileID('images/ui/btn_restart.png'),    local: '/images/ui/btn_restart.png' },
  btn_home:      { fileID: makeCloudFileID('images/ui/btn_home.png'),       local: '/images/ui/btn_home.png' },
  panel_start:   { fileID: makeCloudFileID('images/ui/panel_start.png'),    local: '/images/ui/panel_start.png' },
  panel_gameover:{ fileID: makeCloudFileID('images/ui/panel_gameover.png'), local: '/images/ui/panel_gameover.png' },
  logo_title:    { fileID: makeCloudFileID('images/ui/logo_title.png'),     local: '/images/ui/logo_title.png' },
  icon_pause:    { fileID: makeCloudFileID('images/ui/icon_pause.png'),     local: '/images/ui/icon_pause.png' },

  // 特效
  particle_star:       { fileID: makeCloudFileID('images/effects/particle_star.png'),        local: '/images/effects/particle_star.png' },
  effect_spring:       { fileID: makeCloudFileID('images/effects/effect_spring.png'),        local: '/images/effects/effect_spring.png' },
  effect_break:        { fileID: makeCloudFileID('images/effects/effect_break.png'),         local: '/images/effects/effect_break.png' },
  effect_shield_break: { fileID: makeCloudFileID('images/effects/effect_shield_break.png'),  local: '/images/effects/effect_shield_break.png' },
  effect_coin_collect: { fileID: makeCloudFileID('images/effects/effect_coin_collect.png'),  local: '/images/effects/effect_coin_collect.png' },

  // 道具
  item_coin:       { fileID: makeCloudFileID('images/items/item_coin.png'),        local: '/images/items/item_coin.png' },
  item_shield:     { fileID: makeCloudFileID('images/items/item_shield.png'),      local: '/images/items/item_shield.png' },
  item_spring_shoe:{ fileID: makeCloudFileID('images/items/item_spring_shoe.png'), local: '/images/items/item_spring_shoe.png' },
  item_magnet:     { fileID: makeCloudFileID('images/items/item_magnet.png'),      local: '/images/items/item_magnet.png' },
  item_cloud:      { fileID: makeCloudFileID('images/items/item_cloud.png'),       local: '/images/items/item_cloud.png' },

  // HUD图标
  icon_coin_hud:   { fileID: makeCloudFileID('images/ui/icon_coin_hud.png'),     local: '/images/ui/icon_coin_hud.png' },
  icon_life:       { fileID: makeCloudFileID('images/ui/icon_life.png'),         local: '/images/ui/icon_life.png' },
};

// ==================== 云下载工具方法 ====================

/**
 * 从云存储下载文件到临时路径
 * 兼容所有运行环境：模拟器 / 真机调试 / 体验版 / 正式版
 *
 * @param {string} fileID - cloud:// 格式的文件ID
 * @returns {Promise<string>} 临时文件路径 (tempFilePath)
 */
function downloadFromCloud(fileID) {
  return new Promise(function (resolve, reject) {
    if (!fileID || !fileID.startsWith('cloud://')) {
      reject(new Error('无效的云文件ID: ' + fileID));
      return;
    }
    wx.cloud.downloadFile({
      fileID: fileID,
      success: function (res) {
        if (res.tempFilePath) {
          console.log('[AssetConfig] 云下载成功:', fileID.split('/').pop());
          resolve(res.tempFilePath);
        } else {
          reject(new Error('云下载返回空路径'));
        }
      },
      fail: function (err) {
        console.warn('[AssetConfig] 云下载失败:', err.errMsg || err);
        reject(err);
      }
    });
  });
}

module.exports = {
  USE_CLOUD: USE_CLOUD,
  CLOUD_ENV_ID: CLOUD_ENV_ID,
  BGM_CONFIG: BGM_CONFIG,
  SFX_CONFIGS: SFX_CONFIGS,
  IMAGE_CONFIGS: IMAGE_CONFIGS,
  downloadFromCloud: downloadFromCloud,
};
