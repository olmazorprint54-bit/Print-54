"""
Zich ustma-ust yozuvlar: yuqoridagi yozuvda Q, J, g, y kabi pastga tushadigan harf bo'lsa,
uning "dumi" pastdagi yozuvning bosh harflariga tegadimi — shablonning haqiqiy shriftlari
bilan o'lchanadi. Tegsa, yuqoridagi joyga "lift" yoziladi (shrift o'lchamiga nisbatan, em):
server (api/_lib/pres-gen.js fillText) matnda shunday harf bo'lsa qutini shuncha ko'taradi.

Ishlatish: python tail.py <specs_dir> <repo_dir> [id ...]
"""
import json
import os
import sys

from fonts import Fonts



def metrics(fonts, typeface, caps):
    f = fonts.get(typeface, 1000)
    asc, desc = f.getmetrics()
    tail = max(f.getbbox(c, anchor="ls")[3] for c in ("QJ" if caps else "gjpqyQJ")) / 1000.0
    cap = -f.getbbox("H", anchor="ls")[1] / 1000.0
    return asc / (asc + desc), max(0.0, tail), cap


def text_top(t):
    y, h = t["box"][1], t["box"][3]
    th = (t.get("lines") or 1) * t["lineH"]
    return y + h - th if t.get("anchor") == "b" else y + (h - th) / 2 if t.get("anchor") == "ctr" else y


def annotate(sid, specs_dir, repo_dir):
    """Har bir sarlavha/yorliq uchun (em — shu yozuv shrift o'lchamiga nisbatan, k=1 da):
      base — matn tepasidan oxirgi qator tayanch chizig'igacha, tail — Q/J/g dumi chuqurligi,
      below — ostidagi yaqin yozuvlar: gap (tepalar orasi), cap (pastdagining tepasidan
      bosh harfi tepasigacha; u kichraytirilsa shu masofa ham kichrayadi).
    Server (pres-gen.js descLift) haqiqiy kichraytirishlar bilan hisoblaydi."""
    path = os.path.join(specs_dir, sid + ".json")
    spec = json.load(open(path, encoding="utf8"))
    fonts = Fonts(os.path.join(repo_dir, sid + ".pptx"))
    n = 0
    for sl in spec["slides"]:
        slots = [t for t in sl["slots"] if t.get("box") and t.get("lineH") and t.get("sz")]
        for a in slots:
            for k in ("lift", "base", "tail", "below"):
                a.pop(k, None)
            if a["kind"] not in ("title", "label"):
                continue
            ra, tail, _ = metrics(fonts, a.get("font"), a.get("caps"))
            em_a = a["sz"] * 12700
            top_a = text_top(a)
            base = (((a.get("lines") or 1) - 1) * a["lineH"] + a["lineH"] * ra) / em_a
            x, w = a["box"][0], a["box"][2]
            below = []
            for b in slots:
                if b is a:
                    continue
                ow = min(x + w, b["box"][0] + b["box"][2]) - max(x, b["box"][0])
                if ow < 0.3 * min(w, b["box"][2]):
                    continue
                top_b = text_top(b)
                if top_b < top_a + 0.3 * a["lineH"]:
                    continue  # yonida yoki yuqorida
                rb, _, cap_b = metrics(fonts, b.get("font"), b.get("caps"))
                gap = (top_b - top_a) / em_a
                cap = (b["lineH"] * rb - cap_b * b["sz"] * 12700) / em_a
                if gap + cap - base > 1.0:
                    continue  # uzoqda
                below.append({"id": b["id"], "gap": round(gap, 3), "cap": round(cap, 3)})
            if below:
                a["base"], a["tail"], a["below"] = round(base, 3), round(tail, 3), below
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
