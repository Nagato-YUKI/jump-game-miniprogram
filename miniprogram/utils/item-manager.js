/**
 * 道具管理器
 * 管理游戏内所有道具的生成、更新、碰撞检测和渲染
 */

// 道具类型定义
var ITEM_TYPES = {
  COIN: 'coin',           // 金币 - 收集加分
  SHIELD: 'shield',       // 护盾 - 一次免死
  SPRING_SHOE: 'spring_shoe', // 弹簧鞋 - 增强跳跃力(5秒)
  MAGNET: 'magnet',       // 磁铁 - 吸引金币(8秒)
  CLOUD: 'cloud',         // 减速云 - 降低重力(3秒)
  JETPACK: 'jetpack',     // 喷气背包 - 向上飞行3秒
  DOUBLE_SCORE: 'double_score', // 双倍得分 - 10秒内得分翻倍
  INVINCIBLE: 'invincible',   // 无敌星 - 5秒无敌
  DIAMOND: 'diamond',     // 钻石宝石 - 即时+200分
};

// 道具配置
var ITEM_CONFIG = {
  coin: { width: 24, height: 24, score: 50, color: '#FFD700', floatOffset: 0 },
  shield: { width: 28, height: 28, duration: 0, color: '#4ECDC4', floatOffset: -2 },
  spring_shoe: { width: 26, height: 26, duration: 5000, color: '#FF8C00', floatOffset: -3 },
  magnet: { width: 26, height: 26, duration: 8000, range: 120, color: '#E74C3C', floatOffset: -2 },
  cloud: { width: 60, height: 24, duration: 3000, color: '#FFE4E1', floatOffset: 0 },
  jetpack: { width: 30, height: 36, duration: 3000, color: '#FF4500', floatOffset: -5, score: 0 },
  double_score: { width: 28, height: 28, duration: 10000, color: '#FFD700', floatOffset: -2, score: 0, multiplier: 2 },
  invincible: { width: 32, height: 32, duration: 5000, color: '#FF69B4', floatOffset: -3, score: 0 },
  diamond: { width: 22, height: 22, duration: 0, color: '#9B59B6', floatOffset: -1, score: 200 },
};

function ItemManager(screenWidth, screenHeight) {
  this.screenWidth = screenWidth;
  this.screenHeight = screenHeight;
  this.items = [];        // 活跃道具列表
  this.activeEffects = {}; // 激活效果 { type, endTime }
}

/**
 * 在指定平台上生成道具
 * @param {Object} platform - 平台对象
 * @param {number} level - 当前关卡
 */
ItemManager.prototype.spawnOnPlatform = function(platform, level) {
  // 根据关卡调整道具生成概率
  var rand = Math.random();
  var threshold = Math.min(0.25 + level * 0.03, 0.50);

  if (rand > threshold) return null; // 不生成道具

  // 选择道具类型
  var typeRand = Math.random();
  var type;

  if (level <= 3) {
    type = ITEM_TYPES.COIN; // 低关卡只有金币
  } else if (level <= 7) {
    // level 4-7: 加入 double_score(10%)
    if (typeRand < 0.60) type = ITEM_TYPES.COIN;
    else if (typeRand < 0.75) type = ITEM_TYPES.SHIELD;
    else if (typeRand < 0.85) type = ITEM_TYPES.SPRING_SHOE;
    else if (typeRand < 0.95) type = ITEM_TYPES.CLOUD;
    else type = ITEM_TYPES.DOUBLE_SCORE; // 5% 双倍得分
  } else {
    // level > 7: 加入 jetpack(5%), invincible(3%), diamond(7%)
    if (typeRand < 0.50) type = ITEM_TYPES.COIN;
    else if (typeRand < 0.62) type = ITEM_TYPES.SHIELD;
    else if (typeRand < 0.72) type = ITEM_TYPES.SPRING_SHOE;
    else if (typeRand < 0.82) type = ITEM_TYPES.MAGNET;
    else if (typeRand < 0.89) type = ITEM_TYPES.CLOUD;
    else if (typeRand < 0.94) type = ITEM_TYPES.DOUBLE_SCORE;   // 5%
    else if (typeRand < 0.99) type = ITEM_TYPES.DIAMOND;       // 5%
    else if (typeRand < 0.996) type = ITEM_TYPES.JETPACK;      // 0.6%
    else type = ITEM_TYPES.INVINCIBLE;                          // 0.4%
  }

  var config = ITEM_CONFIG[type];
  var item = {
    x: platform.x + platform.width / 2 - config.width / 2 + (Math.random() - 0.5) * (platform.width - config.width),
    y: platform.y - config.height - 5 - config.floatOffset,
    width: config.width,
    height: config.height,
    type: type,
    collected: false,
    bobOffset: 0,     // 上下浮动偏移
    bobSpeed: 0.03 + Math.random() * 0.02, // 浮动速度
    bobPhase: Math.random() * Math.PI * 2, // 浮动相位
  };

  this.items.push(item);
  return item;
};

/**
 * 更新所有道具状态
 * @param {number} cameraY - 摄像机Y坐标
 * @param {Object} player - 角色对象
 */
ItemManager.prototype.update = function(cameraY, player) {
  var self = this;
  var now = Date.now();

  // 更新浮动动画
  for (var i = 0; i < this.items.length; i++) {
    var item = this.items[i];
    item.bobOffset = Math.sin(now * item.bobSpeed + item.bobPhase) * 3;
  }

  // 清理过期效果
  for (var key in this.activeEffects) {
    if (this.activeEffects[key] && now > this.activeEffects[key].endTime) {
      delete this.activeEffects[key];
    }
  }

  // 移除屏幕外太远的道具
  this.items = this.items.filter(function(item) {
    return item.y - cameraY < self.screenHeight + 100 && !item.collected;
  });

  // 检测碰撞
  return this.checkCollision(player);
};

/**
 * 检测角色与道具的碰撞
 * @param {Object} player
 * @returns {string|null} - 触发的道具类型或null
 */
ItemManager.prototype.checkCollision = function(player) {
  var px = player.x, py = player.y;
  var pw = player.width, ph = player.height;
  var collectedType = null;

  for (var i = 0; i < this.items.length; i++) {
    var item = this.items[i];
    if (item.collected) continue;

    var ix = item.x, iy = item.y + item.bobOffset; // 加上浮动偏移
    var iw = item.width, ih = item.height;

    // AABB 碰撞检测（放大判定范围让收集更容易）
    var padding = item.type === 'coin' ? 8 : 4; // 金币额外宽容8px
    if (px < ix + iw + padding && px + pw > ix - padding && py < iy + ih + padding && py + ph > iy - padding) {
      item.collected = true;
      collectedType = item.type;

      // 触发道具效果
      this.activateEffect(item.type);

      // 只收集一个每帧（避免同时触发多个）
      break;
    }
  }

  return collectedType;
};

/**
 * 激活道具效果
 * @param {string} type
 */
ItemManager.prototype.activateEffect = function(type) {
  var now = Date.now();

  switch (type) {
    case ITEM_TYPES.SHIELD:
      this.activeEffects.shield = { endTime: now + 999999 }; // 护盾持续到用完
      break;
    case ITEM_TYPES.SPRING_SHOE:
      this.activeEffects.springShoe = { endTime: now + ITEM_CONFIG.spring_shoe.duration };
      break;
    case ITEM_TYPES.MAGNET:
      this.activeEffects.magnet = { endTime: now + ITEM_CONFIG.magnet.duration };
      break;
    case ITEM_TYPES.CLOUD:
      this.activeEffects.cloud = { endTime: now + ITEM_CONFIG.cloud.duration };
      break;
    case ITEM_TYPES.JETPACK:
      this.activeEffects.jetpack = { endTime: now + ITEM_CONFIG.jetpack.duration };
      break;
    case ITEM_TYPES.DOUBLE_SCORE:
      this.activeEffects.doubleScore = { endTime: now + ITEM_CONFIG.double_score.duration, multiplier: 2 };
      break;
    case ITEM_TYPES.INVINCIBLE:
      this.activeEffects.invincible = { endTime: now + ITEM_CONFIG.invincible.duration };
      break;
    // COIN 和 DIAMOND 无持续效果，直接得分
  }
};

/**
 * 检查效果是否激活
 * @param {string} type
 * @returns {boolean}
 */
ItemManager.prototype.hasEffect = function(type) {
  var effect = this.activeEffects[type];
  return effect && Date.now() < effect.endTime;
};

/**
 * 获取所有活跃道具（用于渲染）
 */
ItemManager.prototype.getItems = function() {
  return this.items;
};

/**
 * 重置（新游戏时调用）
 */
ItemManager.prototype.reset = function() {
  this.items = [];
  this.activeEffects = {};
};

/**
 * 获取道具配置
 */
ItemManager.prototype.getConfig = function(type) {
  return ITEM_CONFIG[type] || null;
};

// 导出常量供外部使用
ItemManager.ITEM_TYPES = ITEM_TYPES;
ItemManager.ITEM_CONFIG = ITEM_CONFIG;

module.exports = ItemManager;
