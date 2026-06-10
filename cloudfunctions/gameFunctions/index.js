const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 提交分数
const submitScore = async (data, wxContext) => {
  const { score, level, name } = data;
  const openid = wxContext.OPENID;

  try {
    // 查询是否已有记录
    const userRecord = await db.collection('scores')
      .where({ openid })
      .get();

    if (userRecord.data.length > 0) {
      // 更新最高分
      const existing = userRecord.data[0];
      const updateData = {
        score: Math.max(existing.score, score),
        updateTime: db.serverDate()
      };
      if (level) {
        updateData.level = Math.max(existing.level || 0, level);
      }
      if (name) {
        updateData.name = name;
      }
      await db.collection('scores')
        .doc(existing._id)
        .update({ data: updateData });
    } else {
      // 新增记录
      await db.collection('scores').add({
        data: {
          openid,
          name: name || '匿名玩家',
          score,
          level: level || 1,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      });
    }

    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e };
  }
};

// 获取排行榜
const getRanking = async (data) => {
  const { limit = 100 } = data || {};
  try {
    const result = await db.collection('scores')
      .orderBy('score', 'desc')
      .limit(limit)
      .get();
    return { success: true, data: result.data };
  } catch (e) {
    return { success: false, errMsg: e };
  }
};

// 获取个人最佳
const getMyBest = async (data, wxContext) => {
  const openid = wxContext.OPENID;
  try {
    const result = await db.collection('scores')
      .where({ openid })
      .get();
    if (result.data.length > 0) {
      return { success: true, data: result.data[0] };
    }
    return { success: true, data: null };
  } catch (e) {
    return { success: false, errMsg: e };
  }
};

// 云函数入口
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  switch (event.type) {
    case 'submitScore':
      return await submitScore(event.data, wxContext);
    case 'getRanking':
      return await getRanking(event.data);
    case 'getMyBest':
      return await getMyBest(event.data, wxContext);
    default:
      return { success: false, errMsg: '未知操作类型' };
  }
};
