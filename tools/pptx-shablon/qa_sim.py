"""
Chaplanish tekshiruvi — PowerPoint'siz, shablonning haqiqiy shriftlari bilan:
  har bir matn joyi eng og'ir holat bilan to'ldiriladi, server (api/_lib/pres-gen.js
  fillText) qanday kichraytirsa xuddi shunday kichraytiriladi, so'zma-so'z qatorlarga
  bo'linib balandligi hisoblanadi; boshqa matnga tegsa yoki slayddan (asl dizayndagidan
  ko'proq) chiqsa — sig'im (perLine/max) kamaytiriladi. Tuzatib bo'lmaydigan ko'rinish
  o'chiriladi.

Ishlatish: python qa_sim.py <specs_dir> <repo_dir> [id ...]
"""
import json
import math
import os
import sys

from fonts import Fonts, wrap_lines

EMU_PT = 12700
WORDS = ("tog'lar yer yuzasining eng baland qismlari bo'lib ular million yillar davomida tektonik jarayonlar natijasida "
         "shakllangan o'zbekistonda chotqol hisor zarafshon tizmalari mavjud iqlimga suv resurslariga o'simliklar "
         "dunyosiga katta ta'sir ko'rsatadi kompyuter tuzilishi protsessor xotira qurilmalari").split()


def filler(n):
    s, i = "", 0
    while len(s) < n:
        s += (" " if s else "") + WORDS[i % len(WORDS)]
        i += 1
    s = s[:n].rsplit(" ", 1)[0] if " " in s[:n] else s[:n]
    return s[:1].upper() + s[1:]


def slot_max(t, slide):
    if t["kind"] == "title":
        return max(t["max"], 30 if slide["role"] == "title" else 22)
    return t["max"]


MIN_PT = 14      # api/_lib/pres-gen.js MIN_PT: hech bir yozuv 14 pt dan kichik emas
CAPS_W = 1.15


def eff_cpl(t):
    """api/_lib/pres-gen.js slotGrid: sarlavha/yorliq namuna kengligidan (+10%) chiqmaydi"""
    use = min(1, max(0.5, t["useW"] * 1.1)) if t["kind"] != "text" and t.get("useW") else 1
    return max(4, (t.get("perLine") or t["max"]) * use)


def need_scale(t, text):
    """api/_lib/pres-gen.js needScale bilan bir xil"""
    cpl = eff_cpl(t)
    rows = max(1, t.get("lines") or math.ceil((t["chars"] or 1) / cpl))
    ln = max(len(text), 1) * (1.08 if t["kind"] == "text" else 1.2)
    caps = t.get("caps") or (text.upper() == text and any(c.isalpha() for c in text))
    longest = max([len(w) for w in text.split()] or [1]) * (CAPS_W if caps else 1.05)
    k = math.sqrt(cpl * rows / ln) if t["kind"] == "text" else cpl * rows / ln
    return min(1, k, cpl / longest)


def min_scale(t):
    sz = t.get("sz") or MIN_PT
    return MIN_PT / sz if sz > MIN_PT else 1.0


def max_chars_at(t, k):
    cpl = eff_cpl(t)
    rows = max(1, t.get("lines") or math.ceil((t["chars"] or 1) / cpl))
    return math.floor(cpl * rows / (k * k * 1.08) if t["kind"] == "text" else cpl * rows / (k * 1.2))


def fit_text(t, text):
    """server: 14 pt da sig'masa matn qisqartiriladi (fitToSlots/trimTo), keyin fillText kichraytiradi"""
    kmin = min_scale(t)
    if need_scale(t, text) < kmin * (0.95 if t["kind"] == "text" else 0.85):
        m = max(6, max_chars_at(t, kmin))
        if len(text) > m:
            text = (text[:m - 1].rsplit(" ", 1)[0] if " " in text[:m - 1] else text[:m - 1]) + "…"
    k = need_scale(t, text)
    return text, (1.0 if k >= 0.97 else max(k, kmin))


def rect(fonts, t, text, k):
    x, y, w, h = t["box"]
    use = min(1, max(0.5, t["useW"] * 1.1)) if t["kind"] != "text" and t.get("useW") else 1
    width_pt = max(1, (w * use - t.get("ins", 0)) / EMU_PT)  # server qutini toraytiradi (narrowBox)
    size = t["sz"] * k
    lines = wrap_lines(fonts, text, t.get("font"), size, width_pt)
    hh = lines * (t["lineH"] / EMU_PT) * k
    top = y / EMU_PT
    if t.get("anchor") == "b":
        top = (y + h) / EMU_PT - hh
    elif t.get("anchor") == "ctr":
        top = (y + h / 2) / EMU_PT - hh / 2
    return (x / EMU_PT, top, (x + w) / EMU_PT, top + hh)


def overlap(a, b):
    w = min(a[2], b[2]) - max(a[0], b[0])
    h = min(a[3], b[3]) - max(a[1], b[1])
    if w <= 0 or h <= 0:
        return 0
    small = min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]))
    return w * h / max(small, 1)


def check_slide(fonts, sl, size):
    sw, sh = size[0] / EMU_PT, size[1] / EMU_PT
    base, got = {}, {}
    for t in sl["slots"]:
        sample = t["text"]
        base[t["id"]] = rect(fonts, t, sample, 1.0)
        if t["kind"] == "fixed":
            got[t["id"]] = base[t["id"]]
            continue
        n = slot_max(t, sl) if t["kind"] != "label" else round(t["max"] * 1.1)
        text = filler(max(4, n))
        if t.get("caps"):
            text = text.upper()
        text, k = fit_text(t, text)
        got[t["id"]] = rect(fonts, t, text, k)
    bad = set()
    ids = list(got)
    editable = {t["id"] for t in sl["slots"] if t["kind"] != "fixed"}
    for i, a in enumerate(ids):
        ra, ba = got[a], base[a]
        if a in editable and (ra[3] > max(sh, ba[3]) + 2 or ra[1] < min(0, ba[1]) - 2):
            bad.add(a)
        for b in ids[i + 1:]:
            if a not in editable and b not in editable:
                continue
            if overlap(ra, got[b]) > 0.12 and overlap(base[a], base[b]) <= 0.05:
                bad.update(x for x in (a, b) if x in editable)
    return bad


def tune(sid, specs_dir, repo_dir):
    path = os.path.join(specs_dir, sid + ".json")
    spec = json.load(open(path, encoding="utf8"))
    if not all("box" in t for s in spec["slides"] for t in s["slots"]):
        return "tuzilma eski (box yo'q) — qayta tahlil kerak"
    fonts = Fonts(os.path.join(repo_dir, sid + ".pptx"))
    fixed_slots, dropped = 0, 0
    for sl in spec["slides"]:
        for _ in range(10):
            bad = check_slide(fonts, sl, spec["size"])
            if not bad:
                break
            for t in sl["slots"]:
                if t["id"] in bad:
                    t["perLine"] = round(t["perLine"] * 0.85, 1)
                    t["max"] = max(6, round(t["max"] * 0.85))
                    fixed_slots += 1
        else:
            if check_slide(fonts, sl, spec["size"]):
                for t in sl["slots"]:
                    t["kind"] = "fixed"
                dropped += 1
    json.dump(spec, open(path, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
    return f"OK ({fixed_slots} tuzatish, {dropped} ko'rinish o'chirildi)"


if __name__ == "__main__":
    specs_dir, repo_dir = sys.argv[1:3]
    ids = sys.argv[3:] or sorted(f[:-5] for f in os.listdir(specs_dir) if f.endswith(".json"))
    for sid in ids:
        try:
            print(sid, tune(sid, specs_dir, repo_dir), flush=True)
        except Exception as e:
            print(sid, "XATO", e, flush=True)
