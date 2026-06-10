/**
 * 资源配置中心 - 统一管理所有游戏资源的路径（云存储优先 + 本地回退）
 *
 * ==================== 使用说明 ====================
 *
 * 1. 云存储URL配置：
 *    将音频/大图上传到「云开发控制台 → 存储」后，填写下方 CLOUD_BASE_URL
 *    格式: https://env-id.ap-shanghai.file.myqcloud.com/
 *    获取方式: 云开发控制台 → 存储 → 点击任意文件 → 复制下载地址的前缀部分
 *
 * 2. 开关控制：
 *    USE_CLOUD = true   → 优先从云存储加载（推荐生产环境）
 *    USE_CLOUD = false  → 只用本地文件（开发调试用）
 *
 * 3. 新增资源规则（详见 ASSET_GUIDE.md）：
 *    - 音频文件 → 放云存储，本地不留副本
 *    - 图片 < 50KB → 可以放本地（如UI图标、小按钮）
 *    - 图片 > 50KB → 放云存储，本地留压缩版做回退
 *    - 主包总大小必须 < 2MB
 */

// ==================== 云存储配置 ====================

/**
 * 是否启用云存储加载
 * 生产环境建议 true，开发调试可临时设为 false
 */
var USE_CLOUD = true;

/**
 * 云存储基础URL
 * TODO: 上传文件到云存储后，替换为你的实际地址
 *
 * 获取步骤:
 * 1. 打开微信开发者工具 → 云开发控制台
 * 2. 左侧点击「存储」
 * 3. 新建文件夹: audio/  和  images/
 * 4. 上传音频/图片文件到对应文件夹
 * 5. 点击任意已上传文件 → 复制「下载地址」
 * 6. 提取前缀部分填入下方（到环境ID为止）
 *
 * 示例: https://your-env-id.ap-shanghai.file.myqcloud.com/
 */
var CLOUD_BASE_URL = 'https://636c-cloud1-d3gy3j4u472a74eb5-1441215999.tcb.qcloud.la/';

// ==================== 音频资源配置 ====================

/**
 * BGM 背景音乐配置
 * @type {Object} { name, cloudPath, localPath }
 */
var BGM_CONFIG = {
  name: 'bgm_cutie_patootie',
  // 云存储路径（相对CLOUD_BASE_URL）
  cloudPath: 'audio/bgm_cutie_patootie.mp3',
  // 本地回退路径（仅开发用）
  localPath: '/audio/bgm_cutie_patootie.mp3'
};

/**
 * 音效列表配置
 * @type {Object.<string, {cloudPath: string, localPath: string}>}
 */
var SFX_CONFIGS = {
  jump:        { cloudPath: 'audio/sfx_jump.wav',        localPath: '/audio/sfx_jump.wav' },
  spring:      { cloudPath: 'audio/sfx_spring.wav',       localPath: '/audio/sfx_spring.wav' },
  break:       { cloudPath: 'audio/sfx_break.wav',        localPath: '/audio/sfx_break.wav' },
  coin:        { cloudPath: 'audio/sfx_coin.wav',         localPath: '/audio/sfx_coin.wav' },
  shield:      { cloudPath: 'audio/sfx_shield.wav',       localPath: '/audio/sfx_shield.wav' },
  spring_shoe: { cloudPath: 'audio/sfx_spring_shoe.wav',  localPath: '/audio/sfx_spring_shoe.wav' },
  magnet:      { cloudPath: 'audio/sfx_magnet.wav',       localPath: '/audio/sfx_magnet.wav' },
  hurt:        { cloudPath: 'audio/sfx_hurt.wav',         localPath: '/audio/sfx_hurt.wav' },
  gameover:    { cloudPath: 'audio/sfx_gameover.wav',     localPath: '/audio/sfx_gameover.wav' },
  newrecord:   { cloudPath: 'audio/sfx_newrecord.wav',    localPath: '/audio/sfx_newrecord.wav' },
  button:      { cloudPath: 'audio/sfx_button.wav',       localPath: '/audio/sfx_button.wav' },
};

// ==================== 图片资源配置 ====================

/**
 * 图片资源配置表
 * key: 资源名称（与 index.js resourceList 中的 name 对应）
 * value: { cloud, local } 云端和本地路径
 *
 * 规则:
 * - cloud: 云存储完整URL（用于生产环境加载）
 * - local: 本地相对路径（用于开发环境和云加载失败时的回退）
 */
var IMAGE_CONFIGS = {
  // 角色
  player_idle:  { cloud: CLOUD_BASE_URL + 'images/player/player_idle.png',  local: '/images/player/player_idle.png' },
  player_jump:  { cloud: CLOUD_BASE_URL + 'images/player/player_jump.png',  local: '/images/player/player_jump.png' },
  player_fall:  { cloud: CLOUD_BASE_URL + 'images/player/player_fall.png',  local: '/images/player/player_fall.png' },

  // 平台
  platform_normal:  { cloud: CLOUD_BASE_URL + 'images/platforms/platform_normal.png',  local: '/images/platforms/platform_normal.png' },
  platform_spring:  { cloud: CLOUD_BASE_URL + 'images/platforms/platform_spring.png',  local: '/images/platforms/platform_spring.png' },
  platform_fragile: { cloud: CLOUD_BASE_URL + 'images/platforms/platform_fragile.png', local: '/images/platforms/platform_fragile.png' },
  platform_moving:  { cloud: CLOUD_BASE_URL + 'images/platforms/platform_moving.png',  local: '/images/platforms/platform_moving.png' },

  // 背景
  bg_gradient: { cloud: CLOUD_BASE_URL + 'images/bg/bg_gradient.jpg', local: '/images/bg/bg_gradient.jpg' },
  bg_clouds:   { cloud: CLOUD_BASE_URL + 'images/bg/bg_clouds.jpg',   local: '/images/bg/bg_clouds.jpg' },
  bg_mountains:{ cloud: CLOUD_BASE_URL + 'images/bg/bg_mountains.jpg',local: '/images/bg/bg_mountains.jpg' },

  // UI面板
  btn_start:     { cloud: CLOUD_BASE_URL + 'images/ui/btn_start.png',      local: '/images/ui/btn_start.png' },
  btn_restart:   { cloud: CLOUD_BASE_URL + 'images/ui/btn_restart.png',    local: '/images/ui/btn_restart.png' },
  btn_home:      { cloud: CLOUD_BASE_URL + 'images/ui/btn_home.png',       local: '/images/ui/btn_home.png' },
  panel_start:   { cloud: CLOUD_BASE_URL + 'images/ui/panel_start.png',    local: '/images/ui/panel_start.png' },
  panel_gameover:{ cloud: CLOUD_BASE_URL + 'images/ui/panel_gameover.png', local: '/images/ui/panel_gameover.png' },
  logo_title:    { cloud: CLOUD_BASE_URL + 'images/ui/logo_title.png',     local: '/images/ui/logo_title.png' },
  icon_pause:    { cloud: CLOUD_BASE_URL + 'images/ui/icon_pause.png',     local: '/images/ui/icon_pause.png' },

  // 特效
  particle_star:  { cloud: CLOUD_BASE_URL + 'images/effects/particle_star.png',  local: '/images/effects/particle_star.png' },
  effect_spring:  { cloud: CLOUD_BASE_URL + 'images/effects/effect_spring.png',  local: '/images/effects/effect_spring.png' },
  effect_break:   { cloud: CLOUD_BASE_URL + 'images/effects/effect_break.png',   local: '/images/effects/effect_break.png' },

  // 道具
  item_coin:       { cloud: CLOUD_BASE_URL + 'images/items/item_coin.png',        local: '/images/items/item_coin.png' },
  item_shield:     { cloud: CLOUD_BASE_URL + 'images/items/item_shield.png',      local: '/images/items/item_shield.png' },
  item_spring_shoe:{ cloud: CLOUD_BASE_URL + 'images/items/item_spring_shoe.png', local: '/images/items/item_spring_shoe.png' },
  item_magnet:     { cloud: CLOUD_BASE_URL + 'images/items/item_magnet.png',      local: '/images/items/item_magnet.png' },
  item_cloud:      { cloud: CLOUD_BASE_URL + 'images/items/item_cloud.png',       local: '/images/items/item_cloud.png' },
};

// ==================== 工具方法 ====================

/**
 * 获取资源的最终URL（云存储优先，失败回退本地）
 * @param {Object} config - { cloud: string|null, local: string }
 * @returns {string} 实际使用的URL
 */
function resolveUrl(config) {
  if (USE_CLOUD && config.cloud) {
    return config.cloud;
  }
  return config.local;
}

/**
 * 获取BGM的播放URL
 * @returns {string}
 */
function getBGMUrl() {
  if (USE_CLOUD && CLOUD_BASE_URL && !CLOUD_BASE_URL.includes('your-env-id')) {
    return CLOUD_BASE_URL + BGM_CONFIG.cloudPath;
  }
  return BGM_CONFIG.localPath;
}

/**
 * 获取音效的播放URL
 * @param {string} name - 音效名
 * @returns {string}
 */
function getSFXUrl(name) {
  var cfg = SFX_CONFIGS[name];
  if (!cfg) return '';
  if (USE_CLOUD && CLOUD_BASE_URL && !CLOUD_BASE_URL.includes('your-env-id')) {
    return CLOUD_BASE_URL + cfg.cloudPath;
  }
  return cfg.localPath;
}

/**
 * 检查是否在真机运行（非开发工具预览）
 * 云存储URL在预览环境返回418，只有真机才能正常访问
 * @returns {boolean}
 */
function isRealDevice() {
  try {
    var info = wx.getAccountInfoSync();
    var env = info && info.miniProgram && info.miniProgram.envVersion;
    // develop=开发版 trial=体验版 release=正式版
    return env === 'release' || env === 'trial';
  } catch(e) {
    // getAccountInfoSync 不可用时默认走本地（安全策略）
    return false;
  }
}

/**
 * 检查云存储是否可用（已配置 + 真机环境）
 * @returns {boolean}
 */
function isCloudReady() {
  return USE_CLOUD &&
         CLOUD_BASE_URL &&
         !CLOUD_BASE_URL.includes('your-env-id') &&
         CLOUD_BASE_URL.startsWith('http') &&
         isRealDevice();
}

module.exports = {
  USE_CLOUD: USE_CLOUD,
  CLOUD_BASE_URL: CLOUD_BASE_URL,
  BGM_CONFIG: BGM_CONFIG,
  SFX_CONFIGS: SFX_CONFIGS,
  IMAGE_CONFIGS: IMAGE_CONFIGS,
  resolveUrl: resolveUrl,
  getBGMUrl: getBGMUrl,
  getSFXUrl: getSFXUrl,
  isCloudReady: isCloudReady,
  isRealDevice: isRealDevice,
};
