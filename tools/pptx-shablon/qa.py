"""
Taqdimot shablonlarini AI'siz tekshirish va moslash (chaplanishning oldini olish):
  1) har bir ko'rinish eng uzun matn bilan to'ldiriladi (qa-build.js)
  2) PowerPoint matnlarning haqiqiy chegaralarini o'lchaydi
  3) asl shablonda yo'q bo'lgan ustma-ust tushish yoki slayddan chiqib ketish bo'lsa —
     o'sha matn joyining sig'imi (perLine/max) kamaytiriladi va qayta tekshiriladi

Ishlatish: python qa.py <specs_dir> <repo_dir> <work_dir> <pres-gen.js> [id ...]
"""
import json
import os
import subprocess
import sys

import pythoncom
import win32com.client

pythoncom.CoInitialize()
APP = None


def app():
    global APP
    if APP is None:
        APP = win32com.client.Dispatch("PowerPoint.Application")
    return APP


def restart():
    """PowerPoint qotib qolsa — yopib, qayta ochamiz"""
    global APP
    try:
        APP.Quit()
    except Exception:
        pass
    APP = None
    import time
    time.sleep(5)  # PowerPoint majburan yopilmaydi — foydalanuvchi ochgan fayllar bo'lishi mumkin


def text_boxes(slide):
    """{shape_id: (left, top, right, bottom)} — matnning haqiqiy chegaralari (pt)"""
    out = {}

    def walk(shapes):
        for i in range(1, shapes.Count + 1):
            sh = shapes.Item(i)
            try:
                if sh.Type == 6:  # guruh
                    walk(sh.GroupItems)
                    continue
                if sh.HasTextFrame and sh.TextFrame2.HasText:
                    tr = sh.TextFrame2.TextRange
                    l, t, w, h = tr.BoundLeft, tr.BoundTop, tr.BoundWidth, tr.BoundHeight
                    if w > 0 and h > 0:
                        out[str(sh.Id)] = (l, t, l + w, t + h)
            except Exception:
                pass

    walk(slide.Shapes)
    return out


def overlap(a, b):
    w = min(a[2], b[2]) - max(a[0], b[0])
    h = min(a[3], b[3]) - max(a[1], b[1])
    if w <= 0 or h <= 0:
        return 0
    small = min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]))
    return w * h / max(small, 1)


def measure(path, retry=True):
    try:
        return _measure(path)
    except Exception:
        if not retry:
            raise
        restart()
        return measure(path, False)


def _measure(path):
    p = app().Presentations.Open(os.path.abspath(path), True, False, False)
    try:
        sw, shh = p.PageSetup.SlideWidth, p.PageSetup.SlideHeight
        return [text_boxes(p.Slides.Item(i)) for i in range(1, p.Slides.Count + 1)], (sw, shh)
    finally:
        p.Close()


def problems(boxes, base, size, editable):
    """yangi muammolar: {shape_id: sabab}"""
    sw, sh = size
    bad = {}
    ids = list(boxes)
    for i, a in enumerate(ids):
        ra = boxes[a]
        # slayddan chiqish: past, o'ng, chap VA yuqori (pastga bog'langan quti yuqoriga o'sadi);
        # asl dizaynda biroz chiqib turgan bo'lsa — undan ko'proq chiqmasin
        o = base.get(a, (0, 0, sw, sh))
        if a in editable and (ra[3] > max(sh, o[3]) + 2 or ra[2] > max(sw, o[2]) + 2 or ra[0] < min(0, o[0]) - 2 or ra[1] < min(0, o[1]) - 2):
            bad[a] = "slayddan chiqdi"
        for b in ids[i + 1:]:
            if a not in editable and b not in editable:
                continue
            if overlap(ra, boxes[b]) > 0.12 and not (a in base and b in base and overlap(base[a], base[b]) > 0.05):
                for x in (a, b):
                    if x in editable:
                        bad[x] = f"ustma-ust ({a}/{b})"
    return bad


def qa(sid, specs_dir, repo_dir, work, gen):
    spec_path = os.path.join(specs_dir, sid + ".json")
    tpl = os.path.join(repo_dir, sid + ".pptx")
    spec = json.load(open(spec_path, encoding="utf8"))
    base_all, _ = measure(tpl)
    fixes = 0
    for rnd in range(5):
        out = os.path.join(work, f"{sid}.qa.pptx")
        r = subprocess.run(["node", os.path.join(os.path.dirname(__file__), "qa-build.js"), spec_path, tpl, out, gen],
                           capture_output=True, text=True)
        if r.returncode:
            return f"YIG'ILMADI: {r.stderr.strip()[:200]}"
        order = json.loads(r.stdout.strip().splitlines()[-1])
        got, size = measure(out)
        changed = False
        for k, n in enumerate(order):
            sl = next(s for s in spec["slides"] if s["n"] == n)
            editable = {t["id"] for t in sl["slots"] if t["kind"] != "fixed"}
            bad = problems(got[k], base_all[n - 1], size, editable)
            for t in sl["slots"]:
                if t["id"] in bad and t["perLine"] > 3:
                    t["perLine"] = round(t["perLine"] * 0.82, 1)
                    t["max"] = max(6, round(t["max"] * 0.82))
                    changed = True
                    fixes += 1
        if not changed:
            json.dump(spec, open(spec_path, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
            return f"OK ({rnd} tuzatish bosqichi, {fixes} joy)"
        json.dump(spec, open(spec_path, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
    return f"QISMAN ({fixes} joy tuzatildi, hali muammo bor)"


if __name__ == "__main__":
    specs_dir, repo_dir, work, gen = sys.argv[1:5]
    ids = sys.argv[5:] or sorted(f[:-5] for f in os.listdir(specs_dir) if f.endswith(".json"))
    os.makedirs(work, exist_ok=True)
    for sid in ids:
        try:
            print(sid, qa(sid, specs_dir, repo_dir, work, gen), flush=True)
        except Exception as e:
            print(sid, "XATO", e, flush=True)
