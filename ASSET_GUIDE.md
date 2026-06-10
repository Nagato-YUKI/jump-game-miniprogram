# 跳跃闯关 - 资源管理规范

> 本文档定义了游戏资源的存放、加载、压缩和升级规则。
> **所有新增资源必须遵守此规范，否则会导致主包超限无法上传。**

---

## 一、微信小程序主包限制（硬性要求）

| 限制项 | 上限 | 当前状态 |
|--------|------|---------|
| **主包总大小** | **≤ 2.0 MB** | ✅ ~1.4 MB |
| 单个图片/音频 | **≤ 200 KB** | ✅ 全部合规 |
| 主包JS文件数 | 无硬限 | 61个文件 |
| 总包大小（含分包） | ≤ 20 MB | 远低于上限 |

### 超限后果
- 微信开发者工具上传时报错 `source size exceed max limit`
- 无法提交审核，无法发布上线

---

## 二、资源分类与存放策略

```
资源分类决策树:

新资源是什么类型？
├── 音频 (BGM/音效)
│   └── → 必须放【云存储】，本地不留副本
│       （音频压缩后质量损失大，且体积占比高）
│
├── 图片
│   ├── 文件大小 < 30KB？
│   │   └── → 可以放【本地】（如小图标、UI元素）
│   │
│   └── 文件大小 ≥ 30KB？
│       ├── 是核心素材（角色/平台）？
│       │   └── → 【云存储为主 + 本地留压缩版回退】
│       │       （本地版用 Pillow 压缩到 <100KB）
│       │
│       └── 是背景/装饰图？
│           └── → 转 JPG 放【本地】或放【云存储】
│               （JPG 比 PNG 小 60~80%）
│
└── 其他（字体、数据等）
    └── → 尽量用代码生成或内联，不引入外部文件
```

### 存放位置速查表

| 类型 | 本地路径 | 云存储路径 | 示例 |
|------|---------|-----------|------|
| BGM | 不保留 | `audio/bgm_xxx.mp3` | 背景音乐 |
| 音效 | 不保留 | `audio/sfx_xxx.wav` | 跳跃/金币音效 |
| 角色图片 | 压缩版 | `images/player/xxx.png` | 玩家精灵 |
| 平台图片 | 压缩版 | `images/platforms/xxx.png` | 各种平台 |
| UI图标(<30KB) | 本地 | 无需云存 | 按钮/图标 |
| 背景(JPG) | 本地 | 可选云存 | 游戏背景 |
| 特效/道具 | 本地 | 可选云存 | 粒子效果 |

---

## 三、新增资源的标准流程

### 步骤1：制作/获取资源

```bash
# 如果是AI生成的图片，使用 generate_images.py
python generate_images.py

# 输出位置: miniprogram/images/{category}/
```

### 步骤2：检查文件大小

```bash
# Windows PowerShell 检查
Get-ChildItem miniprogram/images/new_asset.png | Select-Object Name, @{N='KB';E={[math]::Round($_.Length/1KB,1)}}
```

- **< 30KB** → 直接放入本地，跳到步骤5
- **≥ 30KB** → 继续步骤3

### 步骤3：压缩大图（如果需要本地回退）

```python
from PIL import Image

img = Image.open('new_asset.png')
# 缩放到合适尺寸（根据实际需求调整比例）
img = img.resize((int(img.width * 0.6), int(img.height * 0.6)), Image.LANCZOS)
if img.mode == 'RGBA':
    img.save('new_asset.png', 'PNG', optimize=True, compress_level=9)
```

### 步骤4：上传到云存储

1. 打开 **微信开发者工具** → **云开发控制台**
2. 左侧点击 **「存储」**
3. 点击 **「+ 新建文件夹」** 创建对应目录：
   - `audio/` — 音频文件
   - `images/player/` — 角色素材
   - `images/platforms/` — 平台素材
   - `images/effects/` — 特效素材
4. 点击 **「上传文件」**，选择原始高质量版本
5. 上传完成后，**右键文件 → 复制下载地址**

### 步骤5：注册资源配置

编辑 [`asset-config.js`](miniprogram/utils/asset-config.js)：

#### 新增音频：

```javascript
// BGM: 修改 BGM_CONFIG
var BGM_CONFIG = {
  name: 'bgm_new_song',
  cloudPath: 'audio/bgm_new_song.mp3',      // 云存储路径
  localPath: '/audio/bgm_new_song.mp3'        // 本地回退（可选）
};

// 音效: 在 SFX_CONFIGS 中添加
var SFX_CONFIGS = {
  // ... 已有的 ...
  new_sound: {                              // ← 新增
    cloudPath: 'audio/sfx_new_sound.wav',
    localPath: '/audio/sfx_new_sound.wav'
  },
};
```

**同时更新 audio-manager.js 的 SOUNDS 常量：**
```javascript
const SOUNDS = {
  // ... 已有的 ...
  NEW_SOUND: 'new_sound',                   // ← 新增
};
```

#### 新增图片：

```javascript
// 在 IMAGE_CONFIGS 中添加
var IMAGE_CONFIGS = {
  // ... 已有的 ...
  new_character: {                           // ← 新增
    cloud: CLOUD_BASE_URL + 'images/player/new_char.png',  // 云URL
    local: '/images/player/new_char.png'                    // 本地回退
  },
};
```

#### 在 index.js 的 resourceList 中注册：

```javascript
// 在 resourceList 数组中添加
{ name: 'new_character' },                  // 只需要 name，会自动从 asset-config 解析
// 或传统方式（不经过云存储）
{ name: 'new_icon', url: '/images/ui/new_icon.png' },
```

### 步骤6：验证主包大小

```bash
# 检查总大小
Get-ChildItem miniprogram -Recurse -File | Measure-Object Length -Sum |
  Select-Object @{N='MB';E={[math]::Round($_.Sum/1MB,2)}}

# 检查是否有超200KB的文件
Get-ChildItem miniprogram -Recurse -File | Where-Object {$_.Length -gt 200*1024} |
  Select-Object @{N='KB';E={[math]::Round($_.Length/1KB,0)}}, FullName
```

**必须确保：总数 < 2.0 MB，单文件 < 200 KB**

---

## 四、云存储配置指南

### 首次配置（必须完成一次）

1. 打开 [asset-config.js](miniprogram/utils/asset-config.js)
2. 找到 `CLOUD_BASE_URL` 变量
3. 替换为你的实际云存储地址：

```javascript
// 修改前（占位符）
var CLOUD_BASE_URL = 'https://your-env-id.ap-shanghai.file.myqcloud.com/';

// 修改后（示例 - 请替换为你自己的）
var CLOUD_BASE_URL = 'https://jumpgame-xxxxx.ap-shanghai.file.myqcloud.com/';
```

### 如何获取你的 CLOUD_BASE_URL

```
1. 微信开发者工具 → 云开发控制台
2. 左侧「存储」→ 点击任意已上传文件
3. 右键 → 「复制下载地址」
4. 得到类似:
   https://jumpgame-abc123.ap-shanghai.file.myqcloud.com/audio/bgm.mp3
5. 截取前缀部分（去掉文件名）:
   https://jumpgame-abc123.ap-shanghai.file.myqcloud.com/
```

### 开关控制

```javascript
var USE_CLOUD = true;   // 生产环境: true（从云存储加载）
var USE_CLOUD = false;  // 开发调试: false（只用本地文件）
```

---

## 五、加载机制详解

### 架构图

```
用户打开游戏
     ↓
[ImageLoader.load() / AudioManager.init()]
     ↓
读取 asset-config.js 中的资源配置
     ↓
USE_CLOUD=true 且 CLOUD_BASE_URL已配置？
     ├─ YES → 尝试从云存储URL加载
     │         ├─ 成功 → 使用云端资源（高质量）
     │         └─ 失败 → 自动回退本地文件
     │
     └─ NO  → 直接使用本地文件
              （开发模式 / 云未配置时）
```

### 回退机制保证

- **云存储不可用时**：自动使用本地文件，游戏正常运行
- **本地文件缺失时**：显示占位图/静音，不崩溃
- **两者都没有**：console.warn 提示，游戏继续运行

---

## 六、未来升级场景参考

### 场景A：添加新的BGM音乐

```
1. 准备 MP3 文件（建议 128kbps, 单声道即可节省50%体积）
2. 上传到云存储: audio/bgm_new.mp3
3. asset-config.js → BGM_CONFIG 改为新文件名
4. 完成！（无需改动本地文件）
```

### 场景B：添加新的角色皮肤

```
1. 用 generate_images.py 生成 PNG（保持透明背景）
2. 原始高清版 → 上传云存储 images/skins/skin_ninja.png
3. 压缩版(60%) → 放本地 miniprogram/images/skins/skin_ninja.png
4. asset-config.js → IMAGE_CONFIGS 添加条目
5. index.js → resourceList 添加 {name:'skin_ninja'}
6. game-engine.js → 切换皮肤逻辑
```

### 场景C：添加新关卡主题

```
1. 新主题包含: 背景3张 + 平台4种 + 特效若干
2. 所有原图 → 上传云存储 images/themes/theme_space/
3. 压缩版 → 放本地（确保每张 < 100KB）
4. asset-config.js → IMAGE_CONFIGS 批量添加
5. game-engine.js → 根据关卡切换主题
```

### 场景D：添加更多音效

```
1. 准备 WAV 文件（短音效 < 3秒）
2. 上传云存储: audio/sfx_new.wav
3. asset-config.js → SFX_CONFIGS 添加
4. audio-manager.js → SOUNDS 常量添加
5. 完成！
```

---

## 七、禁止事项

| 禁止操作 | 原因 | 正确做法 |
|---------|------|---------|
| 把 >200KB 的图片直接放进主包 | 上传报错 | 压缩 或 放云存储 |
| 把未压缩的音频放进主包 | 一个BGM就占2MB+ | 必须放云存储 |
| 在代码中硬编码资源路径 | 违反统一管理 | 通过 asset-config 配置 |
| 删除本地回退文件（云存储配了的情况下可以） | 离线/开发时无法运行 | 至少留压缩版 |
| 使用 BMP/TIFF 等格式 | 体积巨大 | PNG/JPG/WebP |

---

## 八、常用压缩命令速查

```python
# === 图片压缩 ===
from PIL import Image

def compress_image(input_path, output_path=None, max_kb=190, quality=65):
    """通用图片压缩函数"""
    img = Image.open(input_path)
    if output_path is None:
        output_path = input_path

    # 如果是PNG且很大，缩小
    if input_path.lower().endswith('.png') and os.path.getsize(input_path) > 100*1024:
        img = img.resize((int(img.width*0.6), int(img.height*0.6)), Image.LANCZOS)

    # 背景图转JPG
    if 'bg_' in input_path and img.mode in ('RGBA','P'):
        bg = Image.new('RGB', img.size, (255,255,255))
        bg.paste(img, mask=img.split()[-1] if img.mode=='RGBA' else None)
        bg.save(output_path.rsplit('.',1)[0]+'.jpg', 'JPEG', quality=quality, optimize=True)
    else:
        # PNG优化
        if img.mode != 'RGBA': img = img.convert('RGBA')
        img.save(output_path, 'PNG', optimize=True, compress_level=9)

# === 音频截断（简单减小体积）===
def truncate_mp3(input_path, target_kb=180):
    """截取MP3前N字节来减小体积"""
    with open(input_path, 'rb') as f:
        data = f.read(target_kb * 1024)
    with open(input_path, 'wb') as f:
        f.write(data)
```

---

## 九、文件清单

| 文件 | 作用 | 修改频率 |
|------|------|---------|
| [`asset-config.js`](miniprogram/utils/asset-config.js) | 资源路径配置中心 | **每次新增资源必改** |
| [`audio-manager.js`](miniprogram/utils/audio-manager.js) | 音频加载/播放引擎 | 仅新增音效类型时 |
| [`image-loader.js`](miniprogram/utils/image-loader.js) | 图片预加载器 | 一般不改 |
| [`index.js`](miniprogram/pages/index/index.js) | 页面入口，注册resourceList | 新增图片资源时 |
| [`game-engine.js`](miniprogram/utils/game-engine.js) | 游戏引擎，引用图片 | 新功能开发时 |

---

## 十、自动化工具

项目提供3个自动化脚本，位于项目根目录：

### 1. cloud_upload.py — 云存储自动上传

```bash
# 安装依赖（只需一次）
pip install tencentcos-sdk-python

# 配置密钥（在 .env 中添加）
COS_SECRET_ID=你的腾讯云SecretId
COS_SECRET_KEY=你的腾讯云SecretKey
# 获取: https://console.cloud.tencent.com/cam/capi

# 使用
python cloud_upload.py              # 上传所有资源到云存储
python cloud_upload.py --audio-only # 只上传音频
python cloud_upload.py --images     # 只上传图片
python cloud_upload.py --dry-run    # 预览要上传的文件列表
```

**工作原理**: 通过腾讯云COS SDK直接上传文件到微信云存储底层桶。

### 2. restore_quality.py — 资源质量恢复与归档

```bash
# 查看当前资源状态（哪些被压缩了、是否有原稿）
python restore_quality.py --list

# 归档当前文件为「原始版本」（在 originals/ 目录永久保存）
python restore_quality.py --archive

# 压缩本地文件以符合主包限制
python restore_quality.py --compress

# 完整流程：归档 → 压缩 → 报告
python restore_quality.py --all
```

**目录结构**:
```
originals/              ← 高清原稿归档（不进入小程序包，不上传GitHub）
├── audio/             ← 原始音频文件
└── images/            ← 原始高清图片
    ├── player/
    └── platforms/
```

### 3. generate_images.py — AI素材生成

```bash
# 使用 RunningHub API 生成游戏素材
python generate_images.py
# 输出到 miniprogram/images/{category}/
```

### 推荐的工作流程

```
新增素材时的标准流程:

1. python generate_images.py          → AI生成高清素材
2. python restore_quality.py --archive → 归档当前版本（保护已有素材）
3. python cloud_upload.py             → 上传新素材到云存储
4. 编辑 asset-config.js               → 注册新资源路径
5. 验证主包大小 < 2MB
6. git commit + push                  → 提交代码
```

---

> 最后更新: 2026-06-11
> 适用版本: Phase 7+
