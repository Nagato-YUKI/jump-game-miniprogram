"""
跳跃闯关游戏 - AI 图片生成脚本 v3
主后端：RunningHub（游戏素材生成工作流，自动抠图 PNG）
备用：SiliconFlow / 智谱
"""

import os
import sys
import time
import requests

# ============ 配置 ============
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(PROJECT_DIR, "miniprogram", "images")
ENV_FILE = os.path.join(PROJECT_DIR, ".env")

# RunningHub 配置
RUNNINGHUB_API_KEY = ""
RUNNINGHUB_APP_ID = "2033808886779613186"
RUNNINGHUB_RUN_URL = "https://www.runninghub.cn/openapi/v2/run/ai-app/2033808886779613186"
RUNNINGHUB_QUERY_URL = "https://www.runninghub.cn/openapi/v2/query"

# 资源定义（RunningHub 用英文 prompt 效果更好）
RESOURCES = [
    # 角色 (3张)
    {"name": "player_idle", "dir": "player",
     "prompt": "A cute round cartoon ball character in idle pose, front-facing. Chubby pink-red spherical body (#FF6B6B), large expressive kawaii eyes with white highlights, tiny arms and legs sticking out, happy smiling face, small round nose, rosy cheeks. Simple clean lines, flat design with subtle black outline. Game sprite, isolated on pure white background, no extra elements.",
     "width": "512", "height": "512"},
    {"name": "player_jump", "dir": "player",
     "prompt": "A cute round cartoon ball character in jumping pose. Same character - chubby pink-red body (#FF6B6B), large kawaii eyes, tiny limbs. Body compressed and squashed vertically. Excited expression with open mouth smile, eyes wide with joy, arms raised up enthusiastically. Flat design with subtle black outline. Dynamic energetic pose, game sprite, isolated on pure white background.",
     "width": "512", "height": "512"},
    {"name": "player_fall", "dir": "player",
     "prompt": "A cute round cartoon ball character in falling pose. Same character - pink-red body (#FF6B6B), large kawaii eyes, tiny limbs. Body stretched vertically downward. Slightly worried expression with sweat drop on forehead, eyes looking down, arms flailing for balance. Flat design with subtle black outline. Game sprite, isolated on pure white background.",
     "width": "512", "height": "512"},

    # 平台 (4张)
    {"name": "platform_normal", "dir": "platforms",
     "prompt": "A horizontal green grass platform for a platformer game. Rounded rectangle shape, vibrant green color (#6BCB77), top edge decorated with small grass blade details. Slight darker green bottom for depth. Flat design with thin dark green outline. Game sprite, isolated on pure white background, no extra elements.",
     "width": "768", "height": "256"},
    {"name": "platform_spring", "dir": "platforms",
     "prompt": "A horizontal blue spring platform for a platformer game. Sky blue top surface (#4ECDC4), bottom section featuring visible coiled spring mechanism in darker blue. Looks bouncy and elastic. Small arrow icons on sides. Flat design with thin outline. Game sprite, isolated on pure white background.",
     "width": "768", "height": "256"},
    {"name": "platform_fragile", "dir": "platforms",
     "prompt": "A horizontal fragile cracked red platform for a platformer game. Warning red color (#FF6B6B), covered with visible crack lines spreading across surface like spiderweb pattern. Some pieces about to break off. Flat design with thin outline. Game sprite, isolated on pure white background.",
     "width": "768", "height": "256"},
    {"name": "platform_moving", "dir": "platforms",
     "prompt": "A horizontal moving metal platform for a platformer game. Metallic purple-violet color (#9B59B6 gradient), shiny glossy surface with highlight reflections. Small wheel or gear symbols on sides. Futuristic tech appearance. Flat design with thin outline. Game sprite, isolated on pure white background.",
     "width": "768", "height": "256"},

    # 背景 (3张)
    {"name": "bg_gradient", "dir": "bg",
     "prompt": "A seamless vertical sky gradient background for a mobile platformer game. Smooth gradient from light sky blue (#87CEEB) at top through soft cyan to pale mint-white (#F7FFF7) at bottom. No objects or elements, pure gradient only. Bright cheerful atmosphere, soft and dreamy feel.",
     "width": "768", "height": "1024"},
    {"name": "bg_clouds", "dir": "bg",
     "prompt": "White fluffy cartoon clouds decoration layer. Multiple cloud shapes of varying sizes scattered across canvas. Flat design white clouds with subtle light gray shadow underneath. Rounded puffy cumulus cloud shapes. Isolated on pure white background. Cute kawaii cloud style, soft edges.",
     "width": "768", "height": "1024"},
    {"name": "bg_mountains", "dir": "bg",
     "prompt": "Distant mountain range silhouette decoration layer. Layered mountain peaks in soft blue-gray tones (#B0C4DE, #A0B8CF, #90ABC4). Flat design no texture, stylized simplified mountain shapes with gentle curves. 2-3 layers creating depth/parallax effect. Isolated on pure white background. Calm serene, minimalist.",
     "width": "768", "height": "1024"},

    # UI 按钮 (3张)
    {"name": "btn_start", "dir": "ui",
     'prompt': 'A large rounded UI button for mobile game. Wide pill-shaped button with full round corners. Beautiful red-to-light-red gradient background (#FF6B6B to #FF8E8E). Clean modern UI button style. Isolated on pure white background, no text.',
     "width": "512", "height": "256"},
    {"name": "btn_restart", "dir": "ui",
     'prompt': 'A medium rounded UI button for mobile game. Rounded rectangle with border radius, solid red background (#FF6B6B). Clean flat design, game UI panel button style. Isolated on pure white background, no text.',
     "width": "512", "height": "256"},
    {"name": "btn_home", "dir": "ui",
     'prompt': 'A medium rounded UI button for mobile game. Rounded rectangle with border radius, light gray background (#F0F0F0). Clean minimal design, secondary button style. Isolated on pure white background, no text.',
     "width": "512", "height": "256"},

    # UI 面板 (2张)
    {"name": "panel_start", "dir": "ui",
     "prompt": "A tall semi-transparent white UI panel for game start screen. Large rounded rectangle with border radius (24px). White background with slight translucency. Subtle soft shadow around edges. Clean empty panel with plenty of padding space. Modern mobile game UI style, glass-morphism effect. Isolated on pure white background.",
     "width": "512", "height": "768"},
    {"name": "panel_gameover", "dir": "ui",
     "prompt": "A medium-sized white UI popup panel for game over screen. Rounded rectangle with large border radius (24px). Solid white background (#FFFFFF). Noticeable drop shadow for floating card effect. Clean panel with internal spacing. Modern mobile game popup/dialog style. Isolated on pure white background.",
     "width": "512", "height": "512"},

    # UI 其他 (2张)
    {"name": "logo_title", "dir": "ui",
     'prompt': 'Game title logo text in artistic stylized lettering. Bold playful rounded font. Gradient color from coral red (#FF6B6B) to teal cyan (#4ECDC4) left to right. Thick rounded letters with personality. Fun bouncy letter shapes suggesting jumping motion. Game logo style, eye-catching. Isolated on pure white background.',
     "width": "512", "height": "256"},
    {"name": "icon_pause", "dir": "ui",
     "prompt": "A pause button icon for game UI. Circular semi-transparent gray background. Two vertical parallel bars pause symbol in white at center. Clean minimalist design. Circular touch target. Flat design. Standard pause icon, game UI control style. Isolated on pure white background.",
     "width": "256", "height": "256"},

    # 特效粒子 (3张)
    {"name": "particle_star", "dir": "effects",
     "prompt": "A single golden star particle for score effects. Classic five-pointed star shape. Bright golden yellow color (#FFB800) with lighter yellow highlight on upper points. Small white spark in center. Slight glow effect around edges. Flat design. Isolated on pure white background. Celebratory reward particle, cartoon game style.",
     "width": "256", "height": "256"},
    {"name": "effect_spring", "dir": "effects",
     "prompt": "A spring bounce visual effect ring. Concentric glowing circles expanding outward. Cyan-blue color (#4ECDC4) with transparency gradient from solid center to transparent outer ring. 2-3 ring layers. Energy ripple effect suggesting bounce upward. Flat design glow. Isolated on pure white background.",
     "width": "256", "height": "256"},
    {"name": "effect_break", "dir": "effects",
     "prompt": "A platform breaking shattering particle effect. Multiple small irregular polygon fragments flying outward from center. Red-orange fragments (#FF6B6B, #FF4444, #CC3333) in various sizes. Angular shard shapes. Explosion pattern radiating from center point. Flat design. Isolated on pure white background.",
     "width": "256", "height": "256"},

    # 道具 (5张)
    {"name": "item_coin", "dir": "items",
     "prompt": "A shiny golden coin or star collectible item for a platformer game. Round gold coin shape with bright golden yellow color (#FFD700), shiny metallic surface with highlight reflection. Small five-pointed star sparkle in center. Flat design cartoon style. Isolated on pure white background, no extra elements.",
     "width": "64", "height": "64"},
    {"name": "item_shield", "dir": "items",
     "prompt": "A shield power-up item for a platformer game. Round shield icon shape in sky blue color (#4ECDC4) with white cross/shield symbol in center. Glowing protective aura effect around edges. Cartoon flat design style. Isolated on pure white background.",
     "width": "64", "height": "64"},
    {"name": "item_spring_shoe", "dir": "items",
     "prompt": "A spring shoe power-up item for a platformer game. Cute cartoon sneaker shoe shape in orange-red gradient color (#FF8C00 to #FF6347). Spring coil visible at the bottom. Bouncy energetic appearance. Cartoon flat design style. Isolated on pure white background.",
     "width": "56", "height": "56"},
    {"name": "item_magnet", "dir": "items",
     "prompt": "A magnet power-up item for a platformer game. U-shaped horseshoe magnet shape in red color (#E74C3C) with magnetic field lines around it. Small metal particles floating nearby. Cartoon flat design style. Isolated on pure white background.",
     "width": "56", "height": "56"},
    {"name": "item_cloud", "dir": "items",
     "prompt": "A slow-down cloud obstacle/item for a platformer game. Fluffy white cumulus cloud shape with soft pink tint (#FFE4E1) inside. Gentle sleepy expression face with closed eyes. Small zzz text floating above. Cartoon kawaii flat design style. Isolated on pure white background.",
     "width": "96", "height": "48"},

    # 特效 (2张)
    {"name": "effect_coin_collect", "dir": "effects",
     "prompt": "A coin collection sparkle effect particle. Bright golden yellow starburst pattern radiating outward from center. Multiple small star shapes exploding outward. Celebratory reward particle effect. Flat design. Isolated on pure white background.",
     "width": "32", "height": "32"},
    {"name": "effect_shield_break", "dir": "effects",
     "prompt": "A shield breaking shatter effect. Blue shield fragment pieces flying outward from center in explosion pattern. Sky blue (#4ECDC4) fragments of various sizes. Energy crack effect. Flat design. Isolated on pure white background.",
     "width": "64", "height": "64"},

    # 图标 (2张)
    {"name": "icon_life", "dir": "ui",
     "prompt": "A small heart icon for life/HP display in game HUD. Simple cute heart shape in bright red-pink color (#FF6B6B). Clean minimal flat design. No outline. Small size suitable for UI display. Isolated on pure white background.",
     "width": "24", "height": "24"},
    {"name": "icon_coin_hud", "dir": "ui",
     "prompt": "A small coin icon for score display in game HUD. Simple round gold coin shape in golden yellow (#FFD700). Minimal flat design with small shine highlight. Tiny size suitable for UI header. Isolated on pure white background.",
     "width": "20", "height": "20"},
]


def load_env(path):
    env = {}
    if not os.path.exists(path):
        return env
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip()
    return env


ENV = load_env(ENV_FILE)
RUNNINGHUB_API_KEY = ENV.get("RUNNINGHUB_API_KEY", "")
GEMINI_API_KEY = ENV.get("GEMINI_API_KEY", "")
ZHIPU_API_KEY = ENV.get("ZHIPU_API_KEY", "")
ZHIPU_MODEL = ENV.get("ZHIPU_MODEL", "glm-image")
SILICONFLOW_API_KEY = ENV.get("SILICONFLOW_API_KEY", "")
SILICONFLOW_IMAGE_MODEL = ENV.get("SILICONFLOW_IMAGE_MODEL", "Qwen/Qwen-Image")


# ============ RunningHub 后端 ============

def submit_runninghub_task(prompt, width="512", height="512"):
    """提交任务到 RunningHub，返回 taskId 或 None"""
    if not RUNNINGHUB_API_KEY:
        print("    RunningHub Key 未配置")
        return None
    try:
        payload = {
            "nodeInfoList": [
                {"nodeId": "11", "fieldName": "prompt", "fieldValue": prompt, "description": "prompt"},
                {"nodeId": "6", "fieldName": "width", "fieldValue": width, "description": "width"},
                {"nodeId": "6", "fieldName": "height", "fieldValue": height, "description": "height"},
            ],
            "instanceType": "default",
            "usePersonalQueue": False
        }
        response = requests.post(
            RUNNINGHUB_RUN_URL,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {RUNNINGHUB_API_KEY}"},
            json=payload, timeout=60,
        )
        if response.status_code != 200:
            print(f"    RH 提交失败 HTTP {response.status_code}: {response.text[:300]}")
            return None
        result = response.json()
        task_id = result.get("taskId")
        status = result.get("status")
        if task_id and status in ("RUNNING", "QUEUED"):
            return task_id
        elif status == "FAILED":
            print(f"    RH 任务失败: {result.get('errorMessage', '未知')}")
            return None
        else:
            print(f"    RH 未知状态: {result}")
            return None
    except Exception as e:
        print(f"    RH 提交异常: {e}")
        return None


def wait_runninghub_task(task_id, timeout=300):
    """轮询等待任务完成，返回图片 URL 或 None"""
    start = time.time()
    poll_interval = 10
    while time.time() - start < timeout:
        time.sleep(poll_interval)
        try:
            response = requests.post(
                RUNNINGHUB_QUERY_URL,
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {RUNNINGHUB_API_KEY}"},
                json={"taskId": task_id}, timeout=30,
            )
            if response.status_code != 200:
                print(f"    RH 查询失败 HTTP {response.status_code}")
                continue
            result = response.json()
            status = result.get("status")
            if status == "SUCCESS":
                results = result.get("results", [])
                for r in results:
                    if r.get("outputType") == "png":
                        return r.get("url")
                if results:
                    return results[0].get("url")
                return None
            elif status == "FAILED":
                print(f"    RH 任务失败: {result.get('errorMessage', '未知')}")
                return None
            else:
                print(f"\r    RH 状态: {status} (等待中...)  ", end="", flush=True)
        except Exception as e:
            print(f"    RH 查询异常: {e}")
            continue
    print(f"\n    RH 查询超时 ({timeout}s)")
    return None


def download_image(url):
    """下载图片，返回 bytes 或 None"""
    try:
        response = requests.get(url, timeout=120)
        if response.status_code == 200:
            return response.content
        else:
            print(f"    下载失败 HTTP {response.status_code}")
            return None
    except Exception as e:
        print(f"    下载异常: {e}")
        return None


def generate_image_runninghub(prompt, width="512", height="512"):
    """RunningHub 完整流程：提交 -> 轮询 -> 下载 -> 返回 bytes"""
    print("    提交到 RunningHub...", end="", flush=True)
    task_id = submit_runninghub_task(prompt, width, height)
    if not task_id:
        return None
    print(f" OK (taskId={task_id[:16]}...)")
    print("    等待生成...", end="", flush=True)
    url = wait_runninghub_task(task_id)
    if not url:
        return None
    print(f"\r    等待生成... OK  ", flush=True)
    print("    下载图片...", end="", flush=True)
    data = download_image(url)
    if data:
        print(f" OK ({len(data) / 1024:.1f} KB)")
    return data


# ============ 备用后端 ============

def generate_image_siliconflow(prompt):
    """调用 SiliconFlow 生成图片，返回图片 bytes 或 None"""
    if not SILICONFLOW_API_KEY:
        return None
    try:
        response = requests.post(
            "https://api.siliconflow.cn/v1/images/generations",
            headers={"Authorization": f"Bearer {SILICONFLOW_API_KEY}", "Content-Type": "application/json"},
            json={"model": SILICONFLOW_IMAGE_MODEL, "prompt": prompt, "image_size": "1024x1024", "output_format": "png"},
            timeout=120,
        )
        if response.status_code != 200:
            print(f"    SiliconFlow HTTP {response.status_code}: {response.text[:300]}")
            return None
        result = response.json()
        image_url = result.get("images", [{}])[0].get("url")
        if not image_url:
            return None
        return download_image(image_url)
    except Exception as e:
        print(f"    SiliconFlow Error: {e}")
        return None


def generate_image_zhipu(prompt):
    """调用智谱 GLM-Image 生成图片，返回图片 bytes 或 None"""
    if not ZHIPU_API_KEY:
        return None
    try:
        response = requests.post(
            "https://open.bigmodel.cn/api/paas/v4/images/generations",
            headers={"Authorization": f"Bearer {ZHIPU_API_KEY}", "Content-Type": "application/json"},
            json={"model": ZHIPU_MODEL, "prompt": prompt, "size": "1024x1024"},
            timeout=90,
        )
        if response.status_code != 200:
            print(f"    智谱 HTTP {response.status_code}: {response.text[:200]}")
            return None
        result = response.json()
        image_url = result.get("data", [{}])[0].get("url")
        if not image_url:
            return None
        return download_image(image_url)
    except Exception as e:
        print(f"    智谱 Error: {e}")
        return None


def generate_image_with_fallback(prompt, width="512", height="512"):
    """RunningHub 优先，失败后回退 SiliconFlow / 智谱"""
    data = generate_image_runninghub(prompt, width, height)
    if data:
        return data, "runninghub"
    print("    RunningHub 失败，尝试 SiliconFlow...", end="", flush=True)
    data = generate_image_siliconflow(prompt)
    if data:
        print(" OK")
        return data, "siliconflow"
    print("    SiliconFlow 失败，尝试智谱...", end="", flush=True)
    data = generate_image_zhipu(prompt)
    if data:
        print(" OK")
        return data, "zhipu"
    print(" FAIL")
    return None, "none"


# ============ 主函数 ============

def main():
    print(f"=== 跳跃闯关游戏 - AI 图片生成 v3 ===")
    print(f"主后端: RunningHub (游戏素材生成 + 自动抠图)")
    print(f"备用: SiliconFlow / 智谱")
    print(f"输出目录: {OUTPUT_DIR}")
    print(f"资源数量: {len(RESOURCES)}")
    print()

    success_count = 0
    fail_count = 0

    for i, res in enumerate(RESOURCES):
        name = res["name"]
        subdir = res["dir"]
        prompt = res["prompt"]
        width = res.get("width", "512")
        height = res.get("height", "512")

        out_dir = os.path.join(OUTPUT_DIR, subdir)
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, f"{name}.png")

        print(f"[{i + 1}/{len(RESOURCES)}] {name}...", end=" ", flush=True)

        data, backend = generate_image_with_fallback(prompt, width, height)

        if data:
            with open(out_path, "wb") as f:
                f.write(data)
            size_kb = len(data) / 1024
            print(f"  -> OK via {backend} ({size_kb:.1f} KB)")
            success_count += 1
        else:
            print(f"  -> FAIL")
            fail_count += 1

        # 避免 API 限流
        time.sleep(2)

    print()
    print(f"=== 完成: {success_count} 成功, {fail_count} 失败 ===")


if __name__ == "__main__":
    main()
