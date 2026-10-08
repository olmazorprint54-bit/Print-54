"""
Barcha taqdimot shablonlarini AI uchun tayyorlaydi:
  1) tahlil (analyze.py) -> <spec_dir>/<id>.json
  2) siqish (shrink.py)  -> <out_dir>/<id>.pptx
Yaroqsiz shablonlar (matn joylari juda kam/kichik) o'tkazib yuboriladi.

Ishlatish:  python batch.py <map.json> <shablonlar_papkasi> <spec_dir> <out_dir>
map.json — [{id, name, cat}] (public/ai/config.js dagi taqdimot shablonlari)
"""
import json
import os
import sys

from analyze import analyze
from shrink import shrink


def usable(spec):
    """AI ishlata oladigan shablonmi: sarlavha slaydi + kamida 3 ta mazmunli ko'rinish"""
    content = [s for s in spec["slides"] if s["role"] == "content"]
    # mazmunli ko'rinish: sarlavha bor, 12 tadan ko'p bo'lmagan matn joyi, jami kamida 100 harf
    good = [s for s in content
            if any(t["kind"] == "title" for t in s["slots"])
            and len([t for t in s["slots"] if t["kind"] != "fixed"]) <= 12
            and sum(t["max"] for t in s["slots"] if t["kind"] in ("text", "label")) >= 100]
    has_title = any(s["role"] == "title" and any(t["kind"] != "fixed" for t in s["slots"]) for s in spec["slides"])
    return has_title and len(good) >= 1, len(good)  # ko'rinish kam bo'lsa AI uni takrorlab ishlatadi


def main(map_path, src_dir, spec_dir, out_dir):
    items = json.load(open(map_path, encoding="utf8"))
    files = {}
    for root, _, names in os.walk(src_dir):
        for n in names:
            if n.lower().endswith(".pptx"):
                files[(os.path.basename(root).lower(), n[:-5].lower())] = os.path.join(root, n)
    ok, skipped = [], []
    for it in items:
        path = files.get((it["cat"].lower(), it["name"].lower()))
        if not path:
            skipped.append((it["id"], "fayl yo'q"))
            continue
        try:
            spec = analyze(path)
        except Exception as e:  # buzuq yoki g'alati fayl
            skipped.append((it["id"], f"tahlil xatosi: {e}"))
            continue
        good, n = usable(spec)
        if not good:
            skipped.append((it["id"], f"mos ko'rinish kam ({n})"))
            continue
        with open(os.path.join(spec_dir, it["id"] + ".json"), "w", encoding="utf8") as f:
            json.dump(spec, f, ensure_ascii=False, separators=(",", ":"))
        dst = os.path.join(out_dir, it["id"] + ".pptx")
        if not os.path.exists(dst):
            shrink(path, dst)
        ok.append(it["id"])
        print(f"OK   {it['id']}  ({n} ko'rinish, {os.path.getsize(dst) // 1024}K)", flush=True)
    for sid, why in skipped:
        print(f"SKIP {sid}: {why}", flush=True)
    json.dump({"ok": ok, "skipped": skipped}, open(os.path.join(spec_dir, "..", "pres-batch.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print(f"\nTAYYOR: {len(ok)} ta, o'tkazildi: {len(skipped)} ta", flush=True)


if __name__ == "__main__":
    main(*sys.argv[1:5])
