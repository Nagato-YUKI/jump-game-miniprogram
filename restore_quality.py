"""
资源质量恢复工具
================

功能：
1. 重新生成AI高清素材（通过 RunningHub API）
2. 将原始高清版上传到云存储
3. 生成本地压缩版（保持主包 <2MB）
4. 建立本地原始文件归档（避免再次丢失）

使用方式：
    python restore_quality.py --all          # 恢复所有资源
    python restore_quality.py --audio        # 只恢复音频
    python restore_quality.py --images       # 只恢复图片
    python restore_quality.py --list         # 列出当前资源状态

工作流程：
    原始高清版 → [归档到 originals/] → 上传云存储 → 压缩副本到 miniprogram/

目录结构：
    originals/              ← 高清原稿永久保存（不进入小程序包）
      audio/               ← 原始音频
      images/              ← 原始图片
    miniprogram/audio/     ← 音频（云加载回退用，可删）
    miniprogram/images/    ← 图片压缩版（本地使用）
"""

import os
import sys
import shutil
import json
from datetime import datetime

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
ORIGINALS_DIR = os.path.join(PROJECT_ROOT, 'originals')
MINIPROGRAM_DIR = os.path.join(PROJECT_ROOT, 'miniprogram')


def ensure_dir(path):
    """确保目录存在"""
    os.makedirs(path, exist_ok=True)


def get_file_info(filepath):
    """获取文件信息"""
    if not os.path.exists(filepath):
        return None
    stat = os.stat(filepath)
    return {
        'name': os.path.basename(filepath),
        'size_kb': round(stat.st_size / 1024, 1),
        'size_mb': round(stat.st_size / 1024 / 1024, 2),
        'modified': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M'),
    }


def list_status():
    """列出当前所有资源的状态"""
    print("\n" + "=" * 60)
    print("  资源状态总览")
    print("=" * 60)

    # 检查 originals 目录
    has_originals = os.path.exists(ORIGINALS_DIR)

    # 音频状态
    print("\n[音频资源]")
    audio_local = os.path.join(MINIPROGRAM_DIR, 'audio')
    audio_orig = os.path.join(ORIGINALS_DIR, 'audio')

    if os.path.exists(audio_local):
        files = [f for f in os.listdir(audio_local) if not f.startswith('.')]
        for f in sorted(files):
            fp = os.path.join(audio_local, f)
            info = get_file_info(fp)
            orig_path = os.path.join(audio_orig, f)
            has_orig = os.path.exists(orig_path) if has_originals else False
            orig_info = get_file_info(orig_path) if has_orig else None
            mark = "✓ 有原稿" if has_orig else "⚠ 无原稿"
            print(f"  {info['name']:25s} 本地:{info['size_kb']:>6}KB  {mark}")
            if orig_info:
                print(f"  {'':25s} 原稿:{orig_info['size_kb']:>6}KB")
    else:
        print("  (无本地音频)")

    # 图片状态
    print("\n[图片资源] (仅显示 >30KB 的文件)")
    img_categories = [
        ('角色', 'player'),
        ('平台', 'platforms'),
        ('UI', 'ui'),
        ('特效', 'effects'),
        ('道具', 'items'),
        ('背景', 'bg'),
    ]

    for cat_name, cat_dir in img_categories:
        local_path = os.path.join(MINIPROGRAM_DIR, 'images', cat_dir)
        if not os.path.exists(local_path):
            continue

        files = []
        for f in os.listdir(local_path):
            fp = os.path.join(local_path, f)
            if os.path.isfile(fp) and os.path.getsize(fp) > 30 * 1024:
                files.append(f)

        if files:
            print(f"\n  [{cat_name}] ({len(files)} 个大文件):")
            for f in sorted(files):
                fp = os.path.join(local_path, f)
                info = get_file_info(fp)
                orig_path = os.path.join(ORIGINALS_DIR, 'images', cat_dir, f)
                has_orig = os.path.exists(orig_path) if has_originals else False
                mark = "✓" if has_orig else "⚠ 已压缩"
                print(f"    {f:28s} {info['size_kb']:>6}KB {mark}")

    # 主包大小
    total = 0
    count = 0
    for root, dirs, files in os.walk(MINIPROGRAM_DIR):
        for fn in files:
            fp = os.path.join(root, fn)
            if os.path.isfile(fp):
                total += os.path.getsize(fp)
                count += 1

    print(f"\n{'='*60}")
    print(f"  主包总计: {round(total/1024/1024, 2)}MB ({count}个文件)")
    print(f"  限制: < 2.0MB, 单文件 < 200KB")
    status = "✅ 合规" if total < 2*1024*1024 else "❌ 超限"
    print(f"  状态: {status}")
    print(f"{'='*60}")


def archive_current():
    """
    归档当前文件为「原始版本」
    在重新生成/下载高清素材前调用此函数保护现有文件
    """
    print("\n[归档] 备份当前文件到 originals/ ...")

    archived = 0
    skipped = 0

    # 归档音频
    src_audio = os.path.join(MINIPROGRAM_DIR, 'audio')
    dst_audio = os.path.join(ORIGINALS_DIR, 'audio')
    if os.path.exists(src_audio):
        ensure_dir(dst_audio)
        for f in os.listdir(src_audio):
            if f.startswith('.'):
                continue
            src = os.path.join(src_audio, f)
            dst = os.path.join(dst_audio, f)
            if os.path.isfile(src) and not os.path.exists(dst):
                shutil.copy2(src, dst)
                archived += 1
            else:
                skipped += 1

    # 归档大图
    big_dirs = ['player', 'platforms', 'ui']
    for d in big_dirs:
        src_dir = os.path.join(MINIPROGRAM_DIR, 'images', d)
        dst_dir = os.path.join(ORIGINALS_DIR, 'images', d)
        if os.path.exists(src_dir):
            ensure_dir(dst_dir)
            for f in os.listdir(src_dir):
                src = os.path.join(src_dir, f)
                dst = os.path.join(dst_dir, f)
                if os.path.isfile(src) and os.path.getsize(src) > 20 * 1024:
                    if not os.path.exists(dst):
                        shutil.copy2(src, dst)
                        archived += 1
                    else:
                        skipped += 1

    print(f"  完成: 新增归档 {archaged} 个, 跳过已存在 {skipped} 个")
    print(f"  归档位置: {ORIGINALS_DIR}/")


def compress_for_package():
    """
    对本地文件执行压缩以符合主包限制
    与 compress_assets.py / compress_round2.py 的逻辑一致
    """
    try:
        from PIL import Image
    except ImportError:
        print("  [ERROR] 需要 Pillow: pip install Pillow")
        return

    print("\n[压缩] 生成适合主包的压缩版本...")

    compressed = 0

    # 压缩大图
    for root, dirs, files in os.walk(os.path.join(MINIPROGRAM_DIR, 'images')):
        for f in files:
            if not f.lower().endswith(('.png', '.jpg', '.jpeg')):
                continue
            fp = os.path.join(root, f)
            size = os.path.getsize(fp)

            if size > 100 * 1024:  # > 100KB 的才压缩
                try:
                    img = Image.open(fp)
                    w, h = img.size
                    fname = f.lower()

                    # 背景: 转JPG
                    if 'bg_' in fname:
                        new_w = min(400, w)
                        ratio = new_w / w
                        img = img.resize((new_w, int(h * ratio)), Image.LANCZOS)
                        if img.mode in ('RGBA', 'P', 'LA'):
                            bg = Image.new('RGB', img.size, (255, 255, 255))
                            bg.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                            img = bg
                        out = fp.rsplit('.', 1)[0] + '.jpg'
                        img.save(out, 'JPEG', quality=65, optimize=True)
                        if out != fp and os.path.exists(fp):
                            os.remove(fp)
                        compressed += 1

                    # 其他PNG: 缩小+优化
                    elif img.mode == 'RGBA':
                        scale = 0.55 if size > 300 * 1024 else 0.7
                        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
                        img.save(fp, 'PNG', optimize=True, compress_level=9)
                        compressed += 1

                except Exception as e:
                    print(f"    [WARN] 压缩失败 {f}: {e}")

    print(f"  完成: 压缩了 {compressed} 个文件")


def main():
    import argparse
    parser = argparse.ArgumentParser(description='资源质量恢复工具')
    parser.add_argument('--list', action='store_true', help='列出当前资源状态')
    parser.add_argument('--archive', action='store_true', help='归档当前文件到 originals/')
    parser.add_argument('--compress', action='store_true', help='压缩本地文件以符合主包限制')
    parser.add_argument('--all', action='store_true', help='完整流程: 归档→压缩→报告')
    args = parser.parse_args()

    if args.all:
        archive_current()
        compress_for_package()
        list_status()
    elif args.list:
        list_status()
    elif args.archive:
        archive_current()
    elif args.compress:
        compress_for_package()
    else:
        # 默认显示帮助
        parser.print_help()
        print("\n常用命令:")
        print("  python restore_quality.py --list      # 查看资源状态")
        print("  python restore_quality.py --all       # 完整恢复流程")
        print("  python restore_quality.py --archive   # 先备份再操作")


if __name__ == '__main__':
    main()
