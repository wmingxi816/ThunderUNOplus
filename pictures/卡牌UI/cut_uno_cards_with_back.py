#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UNO 卡牌智能切割（含最后一张 back）

功能：
1. 自动识别 10×7 网格；
2. 切割线放在空白区域中心，避免硬切歪；
3. 每个格子自动删除外部背景（仅删除从边缘连通的白/浅灰背景）；
4. 默认把每张卡牌裁到最干净的真实边界（tight）；
5. 最后一张卡牌命名为 back。

依赖：
    pip install pillow

最常用：
    python cut_uno_cards_with_back.py uno_card_set_reference_chart.png -o cards_out

查看切线调试图：
    python cut_uno_cards_with_back.py uno_card_set_reference_chart.png -o cards_out --debug

如果你还想统一导出成 280x392：
    python cut_uno_cards_with_back.py uno_card_set_reference_chart.png -o cards_out --mode contain --size 280x392

输出模式：
    --mode tight    裁到真实边界，最干净，默认
    --mode ratio    不拉伸，补透明边到 1:1.4
    --mode contain  固定尺寸，保持比例，可能有少量透明边
    --mode stretch  固定尺寸并铺满，不留边，但会轻微拉伸
"""

from __future__ import annotations

import argparse
import math
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

COLS = 10
ROWS = 7
RATIO_H = 1.4  # width:height = 1:1.4

CARD_NAMES = [
    # Row 1
    "red_0", "red_1", "red_2", "red_3", "red_4", "red_5", "red_6", "red_7", "red_8", "red_9",
    # Row 2
    "yellow_0", "yellow_1", "yellow_2", "yellow_3", "yellow_4", "yellow_5", "yellow_6", "yellow_7", "yellow_8", "yellow_9",
    # Row 3
    "blue_0", "blue_1", "blue_2", "blue_3", "blue_4", "blue_5", "blue_6", "blue_7", "blue_8", "blue_9",
    # Row 4
    "green_0", "green_1", "green_2", "green_3", "green_4", "green_5", "green_6", "green_7", "green_8", "green_9",
    # Row 5
    "red_plus2", "red_plus4", "red_skip", "red_swap", "red_discard", "red_reverse",
    "yellow_plus2", "yellow_plus4", "yellow_skip", "yellow_swap",
    # Row 6
    "yellow_discard", "yellow_reverse",
    "blue_plus2", "blue_plus4", "blue_skip", "blue_swap", "blue_discard", "blue_reverse",
    "green_plus2", "green_plus4",
    # Row 7
    "green_skip", "green_swap", "green_discard", "green_reverse",
    "black_faces", "black_plus6", "black_plus4_swap", "black_plus10", "black_wild", "back",
]


def parse_size(text: str) -> tuple[int, int]:
    if "x" not in text.lower():
        raise argparse.ArgumentTypeError("尺寸格式应为 WIDTHxHEIGHT，例如 280x392")
    a, b = text.lower().split("x", 1)
    w, h = int(a), int(b)
    if w <= 0 or h <= 0:
        raise argparse.ArgumentTypeError("宽高必须大于 0")
    return w, h


def is_bg_pixel(r: int, g: int, b: int, a: int, *, alpha_min: int, bg_min: int, neutral_delta: int) -> bool:
    if a <= alpha_min:
        return True

    return (
        r >= bg_min and g >= bg_min and b >= bg_min
        and (max(r, g, b) - min(r, g, b)) <= neutral_delta
    )


def candidate_bg_flat(img: Image.Image, *, alpha_min: int, bg_min: int, neutral_delta: int) -> bytearray:
    img = img.convert("RGBA")
    w, h = img.size
    pix = img.load()
    bg = bytearray(w * h)

    for y in range(h):
        base = y * w
        for x in range(w):
            r, g, b, a = pix[x, y]
            if is_bg_pixel(r, g, b, a, alpha_min=alpha_min, bg_min=bg_min, neutral_delta=neutral_delta):
                bg[base + x] = 1
    return bg


def make_content_mask(img: Image.Image, *, alpha_min: int, bg_min: int, neutral_delta: int, dilate: int) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    pix = img.load()

    bg = candidate_bg_flat(img, alpha_min=alpha_min, bg_min=bg_min, neutral_delta=neutral_delta)

    mask = Image.new("1", (w, h), 0)
    mp = mask.load()

    for y in range(h):
        base = y * w
        for x in range(w):
            if pix[x, y][3] > alpha_min and not bg[base + x]:
                mp[x, y] = 1

    if dilate > 1:
        if dilate % 2 == 0:
            dilate += 1
        mask = mask.filter(ImageFilter.MaxFilter(dilate))

    return mask


def axis_counts(mask: Image.Image, axis: str) -> list[int]:
    w, h = mask.size
    mp = mask.load()

    if axis == "x":
        return [sum(1 for y in range(h) if mp[x, y]) for x in range(w)]
    elif axis == "y":
        return [sum(1 for x in range(w) if mp[x, y]) for y in range(h)]
    else:
        raise ValueError("axis must be 'x' or 'y'")


def find_groups(counts: list[int], threshold: int, min_len: int = 5) -> list[tuple[int, int]]:
    groups = []
    start = None

    for i, c in enumerate(counts):
        if c > threshold:
            if start is None:
                start = i
        else:
            if start is not None:
                if i - start >= min_len:
                    groups.append((start, i - 1))
                start = None

    if start is not None and len(counts) - start >= min_len:
        groups.append((start, len(counts) - 1))

    return groups


def choose_blank_boundary(counts: list[int], left_end: int, right_start: int, blank_limit: int) -> int:
    a = left_end + 1
    b = right_start - 1

    if a > b:
        return (left_end + right_start + 1) // 2

    best_run = None
    run_start = None

    for i in range(a, b + 1):
        if counts[i] <= blank_limit:
            if run_start is None:
                run_start = i
        else:
            if run_start is not None:
                run = (run_start, i - 1)
                if best_run is None or (run[1] - run[0]) > (best_run[1] - best_run[0]):
                    best_run = run
                run_start = None

    if run_start is not None:
        run = (run_start, b)
        if best_run is None or (run[1] - run[0]) > (best_run[1] - best_run[0]):
            best_run = run

    if best_run is not None:
        return (best_run[0] + best_run[1]) // 2

    return min(range(a, b + 1), key=lambda i: counts[i])


def bounds_from_groups(groups: list[tuple[int, int]], total: int, counts: list[int], blank_limit: int) -> list[int]:
    bounds = [0]
    for (_s1, e1), (s2, _e2) in zip(groups, groups[1:]):
        bounds.append(choose_blank_boundary(counts, e1, s2, blank_limit))
    bounds.append(total)
    return bounds


def detect_grid_bounds(
    img: Image.Image,
    *,
    cols: int,
    rows: int,
    alpha_min: int,
    bg_min: int,
    neutral_delta: int,
    dilate: int,
    threshold_ratio: float,
) -> tuple[list[int], list[int], Image.Image]:
    w, h = img.size

    mask = make_content_mask(
        img,
        alpha_min=alpha_min,
        bg_min=bg_min,
        neutral_delta=neutral_delta,
        dilate=dilate,
    )

    x_counts = axis_counts(mask, "x")
    y_counts = axis_counts(mask, "y")

    x_threshold = max(3, int(h * threshold_ratio))
    y_threshold = max(3, int(w * threshold_ratio))

    x_blank_limit = max(1, x_threshold // 4)
    y_blank_limit = max(1, y_threshold // 4)

    x_groups = find_groups(x_counts, x_threshold)
    y_groups = find_groups(y_counts, y_threshold)

    if len(x_groups) != cols or len(y_groups) != rows:
        raise RuntimeError(
            f"网格识别失败：识别到 {len(x_groups)} 列、{len(y_groups)} 行；"
            f"预期是 {cols} 列、{rows} 行。\n"
            f"可以尝试加 --debug 看调试图，或调整 --threshold-ratio。"
        )

    x_bounds = bounds_from_groups(x_groups, w, x_counts, x_blank_limit)
    y_bounds = bounds_from_groups(y_groups, h, y_counts, y_blank_limit)
    return x_bounds, y_bounds, mask


def remove_external_background(img: Image.Image, *, alpha_min: int, bg_min: int, neutral_delta: int) -> Image.Image:
    """
    只把从四周边界连通进来的背景设为透明。
    这样可保留卡牌内部白色图形、文字、白色椭圆等元素。
    """
    img = img.convert("RGBA")
    w, h = img.size
    pix = img.load()

    bg = candidate_bg_flat(img, alpha_min=alpha_min, bg_min=bg_min, neutral_delta=neutral_delta)

    seen = bytearray(w * h)
    q = deque()

    def add(x: int, y: int) -> None:
        if not (0 <= x < w and 0 <= y < h):
            return
        idx = y * w + x
        if not seen[idx] and bg[idx]:
            seen[idx] = 1
            q.append((x, y))

    for x in range(w):
        add(x, 0)
        add(x, h - 1)
    for y in range(h):
        add(0, y)
        add(w - 1, y)

    while q:
        x, y = q.popleft()
        add(x + 1, y)
        add(x - 1, y)
        add(x, y + 1)
        add(x, y - 1)

    for y in range(h):
        base = y * w
        for x in range(w):
            if seen[base + x]:
                r, g, b, _ = pix[x, y]
                pix[x, y] = (r, g, b, 0)

    return img


def alpha_bbox(img: Image.Image, alpha_min: int = 0) -> tuple[int, int, int, int] | None:
    img = img.convert("RGBA")
    w, h = img.size
    pix = img.load()

    x0, y0, x1, y1 = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            if pix[x, y][3] > alpha_min:
                x0 = min(x0, x)
                y0 = min(y0, y)
                x1 = max(x1, x)
                y1 = max(y1, y)

    if x1 < 0:
        return None

    return x0, y0, x1 + 1, y1 + 1


def crop_transparent_edges(img: Image.Image, alpha_min: int = 0, edge_margin: int = 0) -> Image.Image:
    box = alpha_bbox(img, alpha_min)
    if box is None:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0))

    x0, y0, x1, y1 = box
    x0 = max(0, x0 - edge_margin)
    y0 = max(0, y0 - edge_margin)
    x1 = min(img.width, x1 + edge_margin)
    y1 = min(img.height, y1 + edge_margin)
    return img.crop((x0, y0, x1, y1))


def pad_to_ratio(img: Image.Image, ratio_h: float = RATIO_H) -> Image.Image:
    w, h = img.size
    target_w = math.ceil(h / ratio_h)
    target_h = h

    if target_w < w:
        target_w = w
        target_h = math.ceil(w * ratio_h)

    out = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    out.alpha_composite(img, ((target_w - w) // 2, (target_h - h) // 2))
    return out


def contain_fixed_size(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    w, h = img.size

    scale = min(target_w / w, target_h / h)
    new_w = max(1, round(w * scale))
    new_h = max(1, round(h * scale))

    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.alpha_composite(resized, ((target_w - new_w) // 2, (target_h - new_h) // 2))
    return out


def stretch_fixed_size(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    return img.resize(size, Image.Resampling.LANCZOS)


def save_debug_images(img: Image.Image, mask: Image.Image, x_bounds: list[int], y_bounds: list[int], out_dir: Path) -> None:
    debug_dir = out_dir / "debug"
    debug_dir.mkdir(parents=True, exist_ok=True)

    mask.convert("L").save(debug_dir / "content_mask.png")

    preview = img.convert("RGBA")
    draw = ImageDraw.Draw(preview)
    for x in x_bounds:
        draw.line([(x, 0), (x, preview.height)], fill=(255, 0, 0, 255), width=2)
    for y in y_bounds:
        draw.line([(0, y), (preview.width, y)], fill=(0, 0, 255, 255), width=2)
    preview.save(debug_dir / "grid_debug.png")


def export_card(
    cell: Image.Image,
    *,
    mode: str,
    size: tuple[int, int],
    alpha_min: int,
    bg_min: int,
    neutral_delta: int,
    edge_margin: int,
) -> Image.Image:
    cleaned = remove_external_background(
        cell,
        alpha_min=alpha_min,
        bg_min=bg_min,
        neutral_delta=neutral_delta,
    )
    tight = crop_transparent_edges(cleaned, alpha_min=0, edge_margin=edge_margin)

    if mode == "tight":
        return tight
    elif mode == "ratio":
        return pad_to_ratio(tight)
    elif mode == "contain":
        return contain_fixed_size(tight, size)
    elif mode == "stretch":
        return stretch_fixed_size(tight, size)
    else:
        raise ValueError(f"未知 mode: {mode}")


def main():
    parser = argparse.ArgumentParser(description="智能切割 UNO 卡牌（含最后一张 back）")
    parser.add_argument("input", help="拼接图路径，例如 uno_card_set_reference_chart.png")
    parser.add_argument("-o", "--output", default="cards_out", help="输出文件夹，默认 cards_out")
    parser.add_argument("--mode", choices=["tight", "ratio", "contain", "stretch"], default="tight", help="输出模式，默认 tight")
    parser.add_argument("--size", type=parse_size, default=(280, 392), help="固定输出尺寸，仅 contain/stretch 使用，默认 280x392")
    parser.add_argument("--debug", action="store_true", help="导出调试图")
    parser.add_argument("--edge-margin", type=int, default=0, help="裁边后额外保留的透明边距，默认 0")

    parser.add_argument("--bg-min", type=int, default=225, help="浅色背景阈值，默认 225")
    parser.add_argument("--neutral-delta", type=int, default=35, help="中性色容差，默认 35")
    parser.add_argument("--alpha-min", type=int, default=10, help="透明度阈值，默认 10")
    parser.add_argument("--dilate", type=int, default=3, help="Mask 膨胀尺寸，默认 3")
    parser.add_argument("--threshold-ratio", type=float, default=0.01, help="行/列非空判定阈值比例，默认 0.01")

    args = parser.parse_args()

    src = Path(args.input)
    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    img = Image.open(src).convert("RGBA")

    x_bounds, y_bounds, mask = detect_grid_bounds(
        img,
        cols=COLS,
        rows=ROWS,
        alpha_min=args.alpha_min,
        bg_min=args.bg_min,
        neutral_delta=args.neutral_delta,
        dilate=args.dilate,
        threshold_ratio=args.threshold_ratio,
    )

    print(f"识别到 {COLS} 列 × {ROWS} 行")
    print(f"X 切线: {x_bounds}")
    print(f"Y 切线: {y_bounds}")
    print(f"输出模式: {args.mode}")

    if args.debug:
        save_debug_images(img, mask, x_bounds, y_bounds, out_dir)
        print(f"已导出调试图到: {(out_dir / 'debug').resolve()}")

    for row in range(ROWS):
        for col in range(COLS):
            idx = row * COLS + col
            name = CARD_NAMES[idx]

            cell = img.crop((x_bounds[col], y_bounds[row], x_bounds[col + 1], y_bounds[row + 1]))
            card = export_card(
                cell,
                mode=args.mode,
                size=args.size,
                alpha_min=args.alpha_min,
                bg_min=args.bg_min,
                neutral_delta=args.neutral_delta,
                edge_margin=args.edge_margin,
            )

            out_name = f"{idx:02d}_{name}.png"
            card.save(out_dir / out_name)
            print(f"导出: {out_name}")

    print(f"完成。共导出 {len(CARD_NAMES)} 张卡牌到: {out_dir.resolve()}")


if __name__ == "__main__":
    main()
