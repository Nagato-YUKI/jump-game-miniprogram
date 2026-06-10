/**
 * 平台管理器
 * 负责生成和管理游戏平台
 */

// 平台类型配置
const PLATFORM_TYPES = {
  normal: { width: 80, height: 14, color: '#6BCB77' },
  spring: { width: 80, height: 14, color: '#4D96FF' },
  fragile: { width: 70, height: 14, color: '#FF6B6B' },
  moving: { width: 80, height: 14, color: '#9B59B6' },
  portal: { width: 80, height: 14, color: '#8E44AD' },   // 传送门 - 深紫色
  cloud: { width: 90, height: 14, color: '#FFFFFF' },      // 云朵平台 - 白色半透明
};

class PlatformManager {
  constructor(screenWidth, screenHeight) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.platforms = [];
    this.nextPlatformY = 0;
    // 当前关卡（默认为1）
    this.currentLevel = 1;
    // 记录上一个平台是否危险（用于避免连续危险平台）
    this.lastDangerous = false;

    // ========== Phase 5: 自适应难度因子 ==========
    this.adaptiveFactor = {
      platformGap: 1.0,      // 平台间距因子
      fragileProb: 1.0,      // 易碎平台概率因子
      movingSpeed: 1.0,      // 移动平台速度因子
      itemSpawnRate: 1.0,    // 道具生成率因子
    };
  }

  // 初始化平台
  init(level) {
    // 设置当前关卡（向下兼容：不传level默认为1）
    this.currentLevel = level || 1;
    // 重置危险平台标记
    this.lastDangerous = false;

    this.platforms = [];
    this.nextPlatformY = this.screenHeight - 60;

    // 生成初始平台（底部安全区域）
    const firstPlatform = this.createPlatform(
      this.screenWidth / 2 - 40,
      this.nextPlatformY,
      'normal'
    );
    this.platforms.push(firstPlatform);

    // 生成初始可见区域平台
    while (this.nextPlatformY > -100) {
      this.generateNext();
    }

    return firstPlatform;
  }

  // 重置
  reset() {
    this.platforms = [];
    this.nextPlatformY = 0;
    // 重置关卡和危险标记
    this.currentLevel = 1;
    this.lastDangerous = false;
    // Phase 5: 重置自适应因子
    this.adaptiveFactor = {
      platformGap: 1.0,
      fragileProb: 1.0,
      movingSpeed: 1.0,
      itemSpawnRate: 1.0,
    };
  }

  /**
   * Phase 5: 设置自适应难度因子（由GameEngine调用）
   * @param {Object} factor - 自适应因子对象
   */
  setAdaptiveFactor(factor) {
    if (!factor) return;
    try {
      this.adaptiveFactor.platformGap = factor.platformGap || 1.0;
      this.adaptiveFactor.fragileProb = factor.fragileProb || 1.0;
      this.adaptiveFactor.movingSpeed = factor.movingSpeed || 1.0;
      this.adaptiveFactor.itemSpawnRate = factor.itemSpawnRate || 1.0;
    } catch(e) {
      console.warn('[PlatformManager] 设置自适应因子失败', e);
    }
  }

  // 创建单个平台
  createPlatform(x, y, type, customWidth) {
    const config = PLATFORM_TYPES[type] || PLATFORM_TYPES.normal;
    // 使用自定义宽度或默认配置宽度
    const width = customWidth || config.width;
    const platform = {
      x,
      y,
      width: width,
      height: config.height,
      type,
      scored: false,
      destroyed: false,
      // 移动平台属性
      moveSpeed: type === 'moving' ? (Math.random() > 0.5 ? 2 : -2) : 0,
      moveRange: type === 'moving' ? 60 : 0,
      originX: x,
    };

    // 新增：传送门和云朵平台的特殊属性
    if (type === 'portal') {
      platform.isPortal = true;
      platform.portalId = 'portal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      platform.portalRotation = 0; // 旋转角度（用于渲染）
    }
    if (type === 'cloud') {
      platform.isCloud = true;
      platform.cloudAlpha = 0.6; // 半透明
      platform.cloudLife = 3000; // 存活时间3秒
      platform.cloudSpawnTime = Date.now(); // 生成时间
    }

    return platform;
  }

  /**
   * 根据关卡获取难度参数（Phase 6: 五级精细化难度曲线）
   * - ★☆☆☆☆ 新手(1-3关): 宽平台、密集、安全
   * - ★★☆☆☆ 进阶(4-7关): 引入变化
   * - ★★★☆☆ 中级(8-12关): 平衡挑战
   * - ★★★★☆ 高级(13-18关): 高挑战
   * - ★★★★★ 专家(19+关): 极限挑战
   *
   * @param {number} level - 当前关卡
   * @returns {Object} 难度参数
   */
  getDifficultyParams(level) {
    var params;

    if (level <= 3) {
      // ★☆☆☆☆ 新手: 宽平台、密集、安全
      params = {
        minGap: 65, maxGap: 85, platformWidth: 105,
        normalProb: 0.78, springProb: 0.10, fragileProb: 0.04,
        movingProb: 0.04, portalProb: 0, cloudProb: 0,
        itemSpawnRate: 0.18
      };
    } else if (level <= 7) {
      // ★★☆☆☆ 进阶: 引入变化
      params = {
        minGap: 55, maxGap: 95, platformWidth: 90,
        normalProb: 0.62, springProb: 0.14, fragileProb: 0.12,
        movingProb: 0.10, portalProb: 0, cloudProb: 0.02,
        itemSpawnRate: 0.18
      };
    } else if (level <= 12) {
      // ★★★☆☆ 中级: 平衡挑战
      params = {
        minGap: 50, maxGap: 105, platformWidth: 82,
        normalProb: 0.52, springProb: 0.15, fragileProb: 0.16,
        movingProb: 0.13, portalProb: 0.02, cloudProb: 0.06,
        itemSpawnRate: 0.20
      };
    } else if (level <= 18) {
      // ★★★★☆ 高级: 高挑战
      params = {
        minGap: 45, maxGap: 115, platformWidth: 75,
        normalProb: 0.45, springProb: 0.15, fragileProb: 0.18,
        movingProb: 0.16, portalProb: 0.03, cloudProb: 0.08,
        itemSpawnRate: 0.22
      };
    } else {
      // ★★★★★ 专家: 极限挑战
      params = {
        minGap: 40, maxGap: 125, platformWidth: 68,
        normalProb: 0.38, springProb: 0.14, fragileProb: 0.20,
        movingProb: 0.18, portalProb: 0.05, cloudProb: 0.08,
        itemSpawnRate: 0.25
      };
    }

    // Phase 6: S曲线微调（每个等级内部的平滑过渡）
    // 计算当前级别内的进度 0~1
    var levelProgress;
    if (level <= 3) {
      levelProgress = (level - 1) / 3;       // 1-3关: 0~1
    } else if (level <= 7) {
      levelProgress = (level - 4) / 4;       // 4-7关: 0~1
    } else if (level <= 12) {
      levelProgress = (level - 8) / 5;       // 8-12关: 0~1
    } else if (level <= 18) {
      levelProgress = (level - 13) / 6;      // 13-18关: 0~1
    } else {
      levelProgress = Math.min((level - 19) / 10, 1);  // 19+关: 0~1（最多到29关满值）
    }

    // 使用smoothstep做S曲线插值（避免线性跳变感）
    var t = levelProgress * levelProgress * (3 - 2 * levelProgress);  // smoothstep公式

    // 在级别边界处对关键参数进行微调（±5%范围内平滑过渡）
    // 这样可以避免从一级跳到下一级时的突然难度突变
    params.minGap = Math.max(35, params.minGap - t * 3);         // 间距略微减小
    params.maxGap = Math.min(135, params.maxGap + t * 5);        // 最大间距略微增加
    params.platformWidth = Math.max(60, params.platformWidth - t * 2);  // 平台略微变窄

    // Phase 5: 应用自适应难度因子（保持向后兼容）
    var factor = this.adaptiveFactor;
    if (factor) {
      // 平台间距因子：>1时间距更大（更难），<1时间距更小（更简单）
      params.minGap = params.minGap * factor.platformGap;
      params.maxGap = params.maxGap * factor.platformGap;
      // 易碎平台概率因子：>1时概率更高（更难），<1时概率更低（更简单）
      params.fragileProb = Math.min(0.5, params.fragileProb * factor.fragileProb); // 最大50%
      // 道具生成率因子：>1时道具更多（更简单），<1时道具更少（更难）
      params.itemSpawnRate = Math.min(0.4, params.itemSpawnRate * factor.itemSpawnRate); // 最大40%
    }

    return params;
  }

  // 生成下一个平台
  generateNext(level) {
    // 使用传入的关卡或当前关卡（向下兼容）
    level = level || this.currentLevel || 1;
    var params = this.getDifficultyParams(level);

    // 根据难度参数计算间距
    var gap = params.minGap + Math.random() * (params.maxGap - params.minGap);

    this.nextPlatformY -= gap;

    // 使用新的随机类型概率
    var type = this.randomPlatformType(params);

    // 避免连续危险平台组合
    var isDangerous = (type === 'fragile' || type === 'moving');
    if (isDangerous && this.lastDangerous) {
      // 连续两个危险平台，强制替换为普通平台
      type = 'normal';
      isDangerous = false;
    }
    this.lastDangerous = isDangerous;

    // 使用动态平台宽度
    var config = PLATFORM_TYPES[type];
    var width = params.platformWidth + (Math.random() - 0.5) * 30; // ±15px 随机变化
    width = Math.max(55, Math.min(130, width)); // 限制范围

    // 随机水平位置
    var x = Math.random() * (this.screenWidth - width);

    var platform = this.createPlatform(x, this.nextPlatformY, type, width);
    this.platforms.push(platform);

    // 确保相邻平台水平距离不超过最大跳跃距离
    // 角色最大跳跃距离约 150px（考虑物理参数）
    var MAX_JUMP_DISTANCE = 140;

    if (this.platforms.length >= 2) {
      var prev = this.platforms[this.platforms.length - 2];
      var curr = this.platforms[this.platforms.length - 1];
      var horizontalDist = Math.abs(
        (curr.x + curr.width / 2) - (prev.x + prev.width / 2)
      );

      if (horizontalDist > MAX_JUMP_DISTANCE) {
        // 太远了，调整当前平台位置使其更靠近上一个
        var targetX = prev.x + prev.width / 2 +
          (Math.random() > 0.5 ? 1 : -1) * (MAX_JUMP_DISTANCE * (0.6 + Math.random() * 0.35));
        curr.x = Math.max(0, Math.min(this.screenWidth - curr.width, targetX - curr.width / 2));
      }
    }
  }

  // 随机平台类型（支持自定义概率参数）
  randomPlatformType(params) {
    params = params || {};
    var normalProb = params.normalProb || 0.6;
    var springProb = params.springProb || 0.15;
    var fragileProb = params.fragileProb || 0.15;
    var movingProb = params.movingProb || 0.10;
    var portalProb = params.portalProb || 0;
    var cloudProb = params.cloudProb || 0;

    // 计算总概率（确保不超过1）
    var totalProb = normalProb + springProb + fragileProb + movingProb + portalProb + cloudProb;
    if (totalProb > 1) {
      // 归一化
      var scale = 1 / totalProb;
      normalProb *= scale; springProb *= scale; fragileProb *= scale;
      movingProb *= scale; portalProb *= scale; cloudProb *= scale;
    }

    var rand = Math.random();
    if (rand < normalProb) return 'normal';
    rand -= normalProb;
    if (rand < springProb) return 'spring';
    rand -= springProb;
    if (rand < fragileProb) return 'fragile';
    rand -= fragileProb;
    if (rand < movingProb) return 'moving';
    rand -= movingProb;
    if (rand < portalProb) return 'portal';
    return 'cloud'; // 剩余概率给云朵
  }

  // 更新平台
  update(cameraY, score) {
    // 根据分数计算当前关卡（level = floor(score/100) + 1）
    if (score !== undefined && score !== null) {
      this.currentLevel = Math.floor(score / 100) + 1;
    }

    var now = Date.now();

    // 更新各类型平台状态
    for (let i = 0; i < this.platforms.length; i++) {
      const p = this.platforms[i];
      if (p.destroyed) continue;

      // 移动平台
      if (p.type === 'moving') {
        // Phase 5: 应用移动速度自适应因子
        var speedMultiplier = this.adaptiveFactor.movingSpeed || 1.0;
        p.x += p.moveSpeed * speedMultiplier;
        // 边界反弹
        if (p.x <= 0 || p.x + p.width >= this.screenWidth) {
          p.moveSpeed = -p.moveSpeed;
        }
      }

      // 传送门平台：缓慢旋转效果（用于渲染）
      if (p.type === 'portal' && p.isPortal) {
        p.portalRotation = (p.portalRotation + 2) % 360; // 每帧旋转2度
      }

      // 云朵平台：生命周期递减，到期后销毁
      if (p.type === 'cloud' && p.isCloud) {
        var cloudElapsed = now - p.cloudSpawnTime;
        if (cloudElapsed > p.cloudLife) {
          p.destroyed = true; // 到期销毁
        } else {
          // 透明度随时间递减
          p.cloudAlpha = 0.6 * (1 - cloudElapsed / p.cloudLife);
        }
      }
    }

    // 移除屏幕下方太远的平台和已销毁的平台
    this.platforms = this.platforms.filter(p => !p.destroyed && p.y - cameraY < this.screenHeight + 200);

    // 生成新平台（向上延伸）
    while (this.nextPlatformY > cameraY - 200) {
      this.generateNext();
    }
  }

  // 获取平台列表
  getPlatforms() {
    return this.platforms;
  }
}

module.exports = PlatformManager;
