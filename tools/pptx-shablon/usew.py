"""
Sarlavha/yorliq namunasi qutining qancha qismini egallaganini o'lchaydi (useW, 0..1).
Dizayner bezaklarni (strelka, rasm, shakl) odatda namuna matni tugagan joydan keyin
qo'yadi — quti undan kengroq bo'lsa ham. Server (api/_lib/pres-gen.js needScale)
yangi matnni shu kenglikdan (+10%) chiqarmaydi, shu sabab bezakka tegmaydi.

Ishlatish: python usew.py <specs_dir> <repo_dir> [id ...]
"""
import json
import os
import sys

from fonts import Fonts

EMU_PT = 12700


def widest_line(fonts, text, typeface, size_pt, width_pt):
    """So'zma-so'z qatorlarga bo'lingandagi eng keng qator (pt)"""
    best = 0.0
    for para in str(text).split("\n"):
        line = ""
        for w in para.split():
            cand = (line + " " + w).strip()
            if line and fonts.width(cand, typeface, size_pt) > width_pt:
                best = max(best, fonts.width(line, typeface, size_pt))
                line = w
            else:
                line = cand
        if line:
            best = max(best, fonts.width(line, typeface, size_pt))
    return best


def annotate(sid, specs_dir, repo_dir):
    path = os.path.join(specs_dir, sid + ".json")
    spec = json.load(open(path, encoding="utf8"))
    fonts = Fonts(os.path.join(repo_dir, sid + ".pptx"))
    n = 0
    for sl in spec["slides"]:
        for t in sl["slots"]:
            if t["kind"] not in ("title", "label") or not t.get("box") or not t.get("text", "").strip():
                continue
            width_pt = max(1, (t["box"][2] - t.get("ins", 0)) / EMU_PT)
            text = t["text"].upper() if t.get("caps") else t["text"]
            t["useW"] = round(min(1.0, widest_line(fonts, text, t.get("font"), t["sz"], width_pt) / width_pt), 3)
            n += 1
    json.dump(spec, open(path, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
    return n


if __name__ == "__main__":
    specs_dir, repo_dir = sys.argv[1:3]
    ids = sys.argv[3:] or sorted(f[:-5] for f in os.listdir(specs_dir) if f.endswith(".json"))
    for sid in ids:
        try:
            print(sid, annotate(sid, specs_dir, repo_dir), flush=True)
        except Exception as e:
            print(sid, "XATO", e, flush=True)
