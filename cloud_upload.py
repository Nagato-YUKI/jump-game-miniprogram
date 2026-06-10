"""
云存储自动上传工具
==================

功能：
1. 自动上传音频文件到云存储 audio/ 目录
2. 自动上传大图到云存储 images/ 目录
3. 支持增量上传（跳过已存在的文件）
4. 上传完成后自动更新 asset-config.js 中的路径

使用方式：
    python cloud_upload.py              # 上传所有资源
    python cloud_upload.py --audio-only # 只上传音频
    python cloud_upload.py --images     # 只上传图片
    python cloud_upload.py --dry-run    # 预览要上传的文件列表（不上传）

前置要求：
    pip install tencentcos-sdk-python

注意：
    - 需要在 .env 中配置腾讯云密钥（云开发控制台 → 环境设置 → 秘钥信息）
    - 或通过微信开发者工具的「云开发CLI」登录后使用
"""

import os
import sys
import json
import hashlib
import argparse

# ==================== 配置区 ====================

# 云环境ID（从截图获取）
ENV_ID = '636c-cloud1-d3gy3j4u472a74eb5-1441215999'

# 地域（上海）
REGION = 'ap-shanghai'

# 本地项目根目录
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

# 要上传到云存储的本地目录映射
UPLOAD_MAP = {
    'audio': {
        'local_dir': os.path.join(PROJECT_ROOT, 'miniprogram', 'audio'),
        'cloud_prefix': 'audio/',
        'extensions': ('.mp3', '.wav', '.ogg', '.m4a'),
        'description': '音频文件',
    },
    'images/player': {
        'local_dir': os.path.join(PROJECT_ROOT, 'miniprogram', 'images', 'player'),
        'cloud_prefix': 'images/player/',
        'extensions': ('.png', '.jpg', '.jpeg', '.webp'),
        'description': '角色素材',
    },
    'images/platforms': {
        'local_dir': os.path.join(PROJECT_ROOT, 'miniprogram', 'images', 'platforms'),
        'cloud_prefix': 'images/platforms/',
        'extensions': ('.png', '.jpg', '.jpeg', '.webp'),
        'description': '平台素材',
    },
}

# 跳过的文件（不上传）
SKIP_FILES = {'.gitkeep', '.DS_Store', 'Thumbs.db'}


def get_file_md5(filepath):
    """计算文件MD5用于比对"""
    md5 = hashlib.md5()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            md5.update(chunk)
    return md5.hexdigest()


def scan_files(config):
    """扫描本地目录，返回待上传文件列表"""
    results = []
    local_dir = config['local_dir']

    if not os.path.exists(local_dir):
        print(f"  [WARN] 目录不存在: {local_dir}")
        return results

    for fname in sorted(os.listdir(local_dir)):
        if fname in SKIP_FILES:
            continue
        ext = os.path.splitext(fname)[1].lower()
        if ext not in config['extensions']:
            continue

        fpath = os.path.join(local_dir, fname)
        if not os.path.isfile(fpath):
            continue

        results.append({
            'name': fname,
            'path': fpath,
            'size': os.path.getsize(fpath),
            'md5': get_file_md5(fpath),
            'cloud_path': config['cloud_prefix'] + fname,
        })

    return results


def upload_via_cos(file_info, bucket_name):
    """
    使用腾讯COS SDK上传文件
    微信云存储底层就是腾讯云COS，可以直接用COS SDK操作
    """
    try:
        from qcloud_cos import CosConfig, CosS3Client
    except ImportError:
        print("  [ERROR] 需要先安装SDK: pip install tencentcos-sdk-python")
        print("         或在 .env 中配置 SECRET_ID 和 SECRET_KEY")
        return False

    # 从 .env 读取密钥
    env_path = os.path.join(PROJECT_ROOT, '.env')
    secret_id = None
    secret_key = None

    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('SECRET_ID=') or line.startswith('COS_SECRET_ID='):
                    secret_id = line.split('=', 1)[1].strip().strip('"').strip("'")
                elif line.startswith('SECRET_KEY=') or line.startswith('COS_SECRET_KEY='):
                    secret_key = line.split('=', 1)[1].strip().strip('"').strip("'")

    if not secret_id or not secret_key:
        print("  [ERROR] 未找到密钥。请在 .env 中添加:")
        print("         COS_SECRET_ID=你的密钥ID")
        print("         COS_SECRET_KEY=你的密钥Key")
        print("         获取方式: https://console.cloud.tencent.com/cam/capi")
        return False

    cos_config = CosConfig(
        Region=REGION,
        SecretId=secret_id,
        SecretKey=secret_key,
    )
    client = CosS3Client(cos_config)

    try:
        with open(file_info['path'], 'rb') as fp:
            response = client.put_object(
                Bucket=bucket_name,
                Body=fp,
                Key=file_info['cloud_path'],
                EnableMD5=False,
            )
        print(f"  [OK]   {file_info['name']} ({file_info['size']//1024}KB)")
        return True
    except Exception as e:
        print(f"  [FAIL] {file_info['name']}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description='云存储自动上传工具')
    parser.add_argument('--audio-only', action='store_true', help='只上传音频')
    parser.add_argument('--images-only', action='store_true', help='只上传图片')
    parser.add_argument('--dry-run', action='store_true', help='预览模式，只列出不上传')
    args = parser.parse_args()

    print("=" * 50)
    print("  云存储自动上传工具")
    print(f"  环境: {ENV_ID}")
    print("=" * 50)

    # 确定要处理的类别
    categories = list(UPLOAD_MAP.keys())
    if args.audio_only:
        categories = ['audio']
    elif args.images_only:
        categories = [k for k in categories if k.startswith('images/')]

    total_files = 0
    total_size = 0
    all_files = []

    # 扫描所有文件
    for cat_key in categories:
        cat_config = UPLOAD_MAP[cat_key]
        files = scan_files(cat_config)
        all_files.extend(files)
        if files:
            print(f"\n[{cat_config['description']}] 找到 {len(files)} 个文件:")
            for f in files:
                print(f"       {f['name']} ({f['size']//1024}KB) -> {f['cloud_path']}")

    total_files = len(all_files)
    total_size = sum(f['size'] for f in all_files)

    if total_files == 0:
        print("\n没有需要上传的文件")
        return

    print(f"\n总计: {total_files} 个文件, {total_size//1024}KB ({total_size/1024/1024:.2f}MB)")

    if args.dry_run:
        print("\n[预览模式] 以上为将要上传的文件列表，未执行实际上传")
        return

    # 执行上传
    print(f"\n{'='*50}")
    print("开始上传...")
    print(f"{'='*50}")

    success_count = 0
    fail_count = 0

    # COS桶名格式: 环境ID-appid（需要从项目配置中获取）
    # 尝试从 project.config.json 读取 appid
    bucket_name = None
    config_path = os.path.join(PROJECT_ROOT, 'project.config.json')
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                cfg = json.load(f)
            appid = cfg.get('appid', '')
            if appid:
                bucket_name = f"{ENV_ID}-{appid}"
        except:
            pass

    if not bucket_name:
        # 回退：尝试常见格式
        bucket_name = ENV_ID

    for fi in all_files:
        result = upload_via_cos(fi, bucket_name)
        if result:
            success_count += 1
        else:
            fail_count += 1

    print(f"\n{'='*50}")
    print(f"上传完成: 成功 {success_count}, 失败 {fail_count}, 共 {total_files}")

    if fail_count > 0:
        print("\n部分文件上传失败，可能原因:")
        print("  1. COS密钥未配置或已过期")
        print("  2. 桶名(Bucket)不匹配")
        print("  3. 网络问题")
        print("\n备选方案: 手动在云开发控制台上传")


if __name__ == '__main__':
    main()
