#!/usr/bin/env python
"""把 tiles 目录中的 JPEG 瓦片拼接为一张 JPEG。

用法：python stitch_tiles.py <tiles_dir> <out.jpg> <W> <H> <tileW> <tileH>
tiles_dir 需包含 index.json（由 scripts/fetch-images.mjs 生成）。
输出一行 JSON：{"w":..,"h":..,"tiles":..,"bytes":..}
"""
import io
import json
import os
import sys

sys.path.insert(
    0,
    os.path.join(
        os.path.dirname(os.path.dirname(sys.executable)), "Lib", "site-packages"
    ),
)

from PIL import Image  # noqa: E402


def main():
    tiles_dir, out_path, W, H, TW, TH = (
        sys.argv[1],
        sys.argv[2],
        int(sys.argv[3]),
        int(sys.argv[4]),
        int(sys.argv[5]),
        int(sys.argv[6]),
    )
    with open(os.path.join(tiles_dir, "index.json"), "r", encoding="utf-8") as f:
        idx = json.load(f)

    canvas = Image.new("RGB", (W, H), (255, 255, 255))
    done = 0
    for t in idx["tiles"]:
        p = os.path.join(tiles_dir, t["file"])
        try:
            with open(p, "rb") as fh:
                data = fh.read()
            im = Image.open(io.BytesIO(data))
            im.load()
            if im.mode != "RGB":
                im = im.convert("RGB")
            canvas.paste(im, (t["x"] * TW, t["y"] * TH))
            done += 1
        except Exception as e:  # 边缘瓦片可能损坏，跳过但记录
            print(f"warn: tile {t['n']} {e}", file=sys.stderr)

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    canvas.save(out_path, "JPEG", quality=88, optimize=True, progressive=True)
    print(
        json.dumps(
            {
                "w": canvas.width,
                "h": canvas.height,
                "tiles": done,
                "bytes": os.path.getsize(out_path),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
