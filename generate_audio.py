"""
生成游戏音频文件（WAV格式）
使用Python标准库生成简单的音效和BGM，无需外部依赖
运行方式：python generate_audio.py
"""
import os
import struct
import math
import random

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(PROJECT_DIR, "miniprogram", "audio")


def write_wav(filename, samples, sample_rate=44100):
    """写入WAV文件（16bit PCM单声道）"""
    # 确保目录存在
    os.makedirs(os.path.dirname(filename), exist_ok=True)

    # 归一化到[-1, 1]然后转到16位整数
    max_val = max(abs(s) for s in samples) if samples else 1
    if max_val == 0:
        max_val = 1

    data = b''
    for s in samples:
        val = int(s / max_val * 32767 * 0.8)  # 80%音量避免爆音
        data += struct.pack('<h', val)

    # WAV文件头
    num_channels = 1
    bits_per_sample = 16
    byte_rate = sample_rate * num_channels * bits_per_sample // 8
    block_align = num_channels * bits_per_sample // 8
    data_size = len(data)
    file_size = 36 + data_size

    with open(filename, 'wb') as f:
        f.write(b'RIFF')
        f.write(struct.pack('<I', file_size))
        f.write(b'WAVE')
        f.write(b'fmt ')
        f.write(struct.pack('<IHHIIHH', 16, 1, num_channels,
                             sample_rate, byte_rate, block_align, bits_per_sample))
        f.write(b'data')
        f.write(struct.pack('<I', data_size))
        f.write(data)


def generate_sine(freq, duration, sample_rate=44100):
    """生成正弦波"""
    n_samples = int(sample_rate * duration)
    return [math.sin(2 * math.pi * freq * i / sample_rate) for i in range(n_samples)]


def generate_envelope(samples, attack=0.01, decay=0.05, sustain=0.7, release=0.1, sample_rate=44100):
    """添加ADSR包络"""
    total = len(samples)
    result = []
    attack_samples = int(attack * sample_rate)
    decay_samples = int(decay * sample_rate)
    release_samples = int(release * sample_rate)

    for i, s in enumerate(samples):
        t = i / total
        if i < attack_samples:
            env = i / attack_samples
        elif i < attack_samples + decay_samples:
            env = 1.0 - (1.0 - sustain) * (i - attack_samples) / decay_samples
        elif i > total - release_samples:
            env = sustain * (total - i) / release_samples
        else:
            env = sustain
        result.append(s * env)
    return result


def mix(*waves):
    """混合多个波形"""
    length = max(len(w) for w in waves)
    result = [0.0] * length
    for w in waves:
        for i, v in enumerate(w):
            result[i] += v
    return result


# ==================== 音效生成 ====================

def make_jump_sound():
    """跳跃音效：快速上升的短促音"""
    base = generate_sine(520, 0.12)
    # 频率滑升效果
    for i in range(len(base)):
        progress = i / len(base)
        base[i] *= math.sin(2 * math.pi * (520 + progress * 200) * i / 44100)
    env = generate_envelope(base, attack=0.001, decay=0.06, sustain=0.3, release=0.04)
    return env


def make_spring_sound():
    """弹簧音效：弹跳感强"""
    wave = generate_sine(380, 0.25)
    for i in range(len(wave)):
        t = i / len(wave)
        # 弹跳衰减
        wave[i] *= math.sin(t * math.pi * 6) ** 2 * (1 - t * 0.7)
        # 频率微调
        wave[i] *= math.sin(2 * math.pi * (380 + t * 150) * i / 44100)
    env = generate_envelope(wave, attack=0.002, decay=0.08, sustain=0.5, release=0.12)
    return env


def make_break_sound():
    """破碎音效：短促噪声"""
    sr = 22050
    n = int(sr * 0.18)
    noise = [random.uniform(-1, 1) * (1 - i / n) for i in range(n)]
    # 低通滤波模拟破碎
    smoothed = []
    for i in range(len(noise)):
        val = noise[i]
        if i > 0:
            val = val * 0.6 + smoothed[-1] * 0.4
        smoothed.append(val)
    return smoothed


def make_coin_sound():
    """金币收集音效：清脆上升音"""
    wave = generate_sine(880, 0.15)
    for i in range(len(wave)):
        t = i / len(wave)
        wave[i] *= math.sin(2 * math.pi * (880 + t * 440) * i / 44100)
    # 添加泛音
    harmonic = generate_sine(1760, 0.15)
    for i in range(min(len(wave), len(harmonic))):
        wave[i] += harmonic[i] * 0.3
    env = generate_envelope(wave, attack=0.001, decay=0.06, sustain=0.2, release=0.06)
    return env


def make_shield_sound():
    """护盾音效：低沉稳定"""
    wave = generate_sine(340, 0.22)
    harmonic = generate_sine(510, 0.22)
    mixed = mix(wave, [h * 0.4 for h in harmonic])
    env = generate_envelope(mixed, attack=0.02, decay=0.08, sustain=0.8, release=0.1)
    return env


def make_magnet_sound():
    """磁铁音效：嗡鸣感"""
    sr = 44100
    dur = 0.28
    n = int(sr * dur)
    wave = []
    for i in range(n):
        t = i / sr
        # LFO调制产生嗡鸣
        lfo = math.sin(2 * math.pi * 15 * t) * 0.3
        freq = 280 + lfo * 60
        val = math.sin(2 * math.pi * freq * t) * (1 - t / dur * 0.5)
        wave.append(val)
    env = generate_envelope(wave, attack=0.03, decay=0.1, sustain=0.7, release=0.1)
    return env


def make_hurt_sound():
    """受伤音效：下降噪声"""
    sr = 22050
    n = int(sr * 0.25)
    wave = []
    for i in range(n):
        t = i / n
        noise = random.uniform(-1, 1)
        # 频率下降
        freq = 400 * (1 - t * 0.6)
        tone = math.sin(2 * math.pi * freq * i / sr) * (1 - t)
        wave.append(noise * 0.4 + tone * 0.6)
    return wave


def make_gameover_sound():
    """游戏结束音效：下行旋律"""
    notes = [523, 466, 392, 349]  # C5 → B4 → G4 → F4
    wave = []
    note_dur = 0.18
    for freq in notes:
        note_wave = generate_sine(freq, note_dur)
        env = generate_envelope(note_wave, attack=0.01, decay=0.06, sustain=0.4, release=0.08)
        wave.extend(env)
    # 整体淡出
    for i in range(len(wave)):
        wave[i] *= 1 - i / len(wave) * 0.5
    return wave


def make_newrecord_sound():
    """新纪录音效：上行琶音"""
    notes = [523, 659, 784, 1047]  # C5 → E5 → G5 → C6
    wave = []
    note_dur = 0.12
    for freq in notes:
        note_wave = generate_sine(freq, note_dur)
        # 泛音
        h = generate_sine(freq * 2, note_dur)
        combined = [note_wave[j] + h[j] * 0.25 for j in range(len(note_wave))]
        env = generate_envelope(combined, attack=0.005, decay=0.04, sustain=0.5, release=0.05)
        wave.extend(env)
    return wave


def make_button_sound():
    """按钮点击音效：极短软音"""
    wave = generate_sine(1000, 0.05)
    env = generate_envelope(wave, attack=0.001, decay=0.02, sustain=0.1, release=0.02)
    return env


def make_bgm():
    """背景音乐：简单循环旋律（约10秒）"""
    # 使用五声音阶创造轻松的背景音乐
    scale = [262, 294, 330, 392, 440, 524, 588, 660]  # C4 到 E5 的五声+扩展
    bpm = 95
    beat = 60 / bpm  # 每拍秒数

    melody_pattern = [
        (0, 0.5), (2, 0.5), (4, 0.5), (2, 0.5),   # C D E D
        (4, 0.5), (6, 0.5), (7, 1.0),                # G A C(长)
        (6, 0.5), (4, 0.5), (2, 0.5), (0, 0.5),     # A G D C
        (2, 0.5), (4, 1.0),                           # D G(长)
        (4, 0.5), (6, 0.5), (7, 0.5), (6, 0.5),     # G A B A
        (4, 0.5), (2, 0.5), (0, 1.0),                # G D C(长)
        (0, 0.75), (0, 0.25), (2, 0.5), (4, 0.5),   # C- C D E
        (7, 0.5), (4, 0.5), (2, 1.0),                # C G D(长)
    ]

    bass_pattern = [
        (0, 1.0), (0, 1.0), (4, 1.0), (4, 1.0),      # C C G G
        (7, 1.0), (7, 1.0), (4, 1.0), (2, 1.0),       # C C G D
        (0, 1.0), (0, 1.0), (4, 1.0), (4, 1.0),
        (7, 1.0), (7, 1.0), (4, 1.0), (2, 1.0),
        (0, 1.0), (0, 1.0), (4, 1.0), (4, 1.0),
        (7, 1.0), (7, 1.0), (4, 1.0), (2, 1.0),
        (0, 1.0), (0, 1.0), (4, 1.0), (4, 1.0),
        (7, 1.0), (7, 1.0), (4, 1.0), (2, 1.0),
    ]

    sr = 22050  # BGM用较低采样率减小文件大小

    def render_note(freq, duration, sr=sr, volume=0.35):
        n = int(sr * duration)
        wave = []
        for i in range(n):
            t = i / sr
            # 基频 + 轻微泛音
            val = math.sin(2 * math.pi * freq * t)
            val += math.sin(2 * math.pi * freq * 2 * t) * 0.15
            val += math.sin(2 * math.pi * freq * 3 * t) * 0.08
            # 包络
            env = min(1.0, t * 20) * min(1.0, (duration - t) * 5)
            val *= env * volume
            wave.append(val)
        return wave

    # 渲染旋律
    melody_track = [0.0] * 0
    for note_idx, dur in melody_pattern:
        freq = scale[note_idx]
        note_wave = render_note(freq * 2, dur, volume=0.25)  # 高八度
        # 填充到正确长度
        target_len = int(sr * dur)
        while len(note_wave) < target_len:
            note_wave.append(0)
        melody_track.extend(note_wave[:target_len])

    # 渲染低音
    bass_track = [0.0] * 0
    for note_idx, dur in bass_pattern:
        freq = scale[note_idx] / 2  # 低八度
        note_wave = render_note(freq, dur, volume=0.30)
        target_len = int(sr * dur)
        while len(note_wave) < target_len:
            note_wave.append(0)
        bass_track.extend(note_wave[:target_len])

    # 混合
    max_len = max(len(melody_track), len(bass_track))
    while len(melody_track) < max_len:
        melody_track.append(0)
    while len(bass_track) < max_len:
        bass_track.append(0)

    mixed = [melody_track[i] + bass_track[i] for i in range(max_len)]

    # 淡入淡出
    fade_len = int(sr * 0.3)
    for i in range(fade_len):
        mixed[i] *= i / fade_len
    for i in range(fade_len):
        mixed[-(i + 1)] *= i / fade_len

    return mixed


# ==================== 主程序 ====================
def main():
    print("=" * 50)
    print("生成游戏音频文件")
    print(f"输出目录: {OUTPUT_DIR}")
    print("=" * 50)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 音效定义：(文件名, 生成函数, 描述)
    sfx_list = [
        ("sfx_jump", make_jump_sound, "跳跃"),
        ("sfx_spring", make_spring_sound, "弹簧"),
        ("sfx_break", make_break_sound, "破碎"),
        ("sfx_coin", make_coin_sound, "金币"),
        ("sfx_shield", make_shield_sound, "护盾"),
        ("sfx_spring_shoe", make_spring_sound, "弹簧鞋"),  # 复用弹簧音
        ("sfx_magnet", make_magnet_sound, "磁铁"),
        ("sfx_hurt", make_hurt_sound, "受伤"),
        ("sfx_gameover", make_gameover_sound, "游戏结束"),
        ("sfx_newrecord", make_newrecord_sound, "新纪录"),
        ("sfx_button", make_button_sound, "按钮"),
    ]

    # 生成音效
    for name, func, desc in sfx_list:
        path = os.path.join(OUTPUT_DIR, f"{name}.wav")
        samples = func()
        write_wav(path, samples)
        size_kb = os.path.getsize(path) / 1024
        print(f"  [OK] {name}.wav ({desc}) - {size_kb:.1f} KB")

    # 生成BGM
    bgm_path = os.path.join(OUTPUT_DIR, "bgm.wav")
    bgm_samples = make_bgm()
    write_wav(bgm_path, bgm_samples, sample_rate=22050)
    size_kb = os.path.getsize(bgm_path) / 1024
    print(f"  [OK] bgm.wav (背景音乐) - {size_kb:.1f} KB")

    print("\n完成! 共生成 %d 个音频文件" % (len(sfx_list) + 1))

    # 注意：audio-manager.js 中路径是 .mp3，需要改为 .wav 或保持 .mp3 并转换
    print("\n注意: 生成的文件为 WAV 格式")
    print("如需MP3格式，请用 ffmpeg 或其他工具转换:")
    print("  ffmpeg -i input.wav output.mp3")


if __name__ == "__main__":
    main()
