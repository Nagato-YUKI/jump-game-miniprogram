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
};

// 道具配置
var ITEM_CONFIG = {
  coin: { width: 24, height: 24, score: 50, color: '#FFD700', floatOffset: 0 },
  shield: { width: 28, height: 28, duration: 0, color: '#4ECDC4', floatOffset: -2 },
  spring_shoe: { width: 26, height: 26, duration: 5000, color: '#FF8C00', floatOffset: -3 },
  magnet: { width: 26, height: 26, duration: 8000, range: 120, color: '#E74C3C', floatOffset: -2 },
  cloud: { width: 60, height: 24, duration: 3000, color: '#FFE4E1', floatOffset: 0 },
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
  var threshold = Math.min(0.15 + level * 0.02, 0.45);

  if (rand > threshold) return null; // 不生成道具

  // 选择道具类型
  var typeRand = Math.random();
  var type;

  if (level <= 3) {
    type = ITEM_TYPES.COIN; // 低关卡只有金币
  } else if (level <= 7) {
    if (typeRand < 0.70) type = ITEM_TYPES.COIN;
    else if (typeRand < 0.85) type = ITEM_TYPES.SHIELD;
    else if (typeRand < 0.95) type = ITEM_TYPES.SPRING_SHOE;
    else type = ITEM_TYPES.CLOUD;
  } else {
    if (typeRand < 0.55) type = ITEM_TYPES.COIN;
    else if (typeRand < 0.68) type = ITEM_TYPES.SHIELD;
    else if (typeRand < 0.78) type = ITEM_TYPES.SPRING_SHOE;
    else if (typeRand < 0.88) type = ITEM_TYPES.MAGNET;
    else if (typeRand < 0.96) type = ITEM_TYPES.CLOUD;
    else type = ITEM_TYPES.COIN; // 额外金币
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

    // AABB 碰撞检测（稍微放大判定范围让收集更容易）
    if (px < ix + iw && px + pw > ix && py < iy + ih && py + ph > iy) {
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
    // COIN 无持续效果，直接得分
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
