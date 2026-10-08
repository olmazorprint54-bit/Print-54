"""
Shablon shriftlari: PPTX ichidagi Canva shriftlari (EOT -> TTF) yoki Windows shriftlari.
Matn enini haqiqiy shrift bilan o'lchash uchun (analyze.py, qa_sim.py).
"""
import io
import os
import re
import struct
import zipfile

from PIL import ImageFont

WIN = os.path.join(os.environ.get("WINDIR", "C:/Windows"), "Fonts")
SYSTEM = {
    "calibri": "calibri.ttf", "calibri light": "calibril.ttf", "georgia": "georgia.ttf", "arial": "arial.ttf",
    "segoe ui": "segoeui.ttf", "comic sans ms": "comic.ttf", "times new roman": "times.ttf", "century gothic": "GOTHIC.TTF",
    "trebuchet ms": "trebuc.ttf", "tw cen mt": "TCM_____.TTF", "gill sans mt": "GIL_____.TTF", "corbel": "corbel.ttf",
    "candara": "Candara.ttf", "garamond": "GARA.TTF", "franklin gothic book": "FRABK.TTF", "rockwell": "ROCK.TTF",
}


def eot_to_ttf(data):
    """Embedded OpenType -> TTF (siqilmagan bo'lsa)"""
    if len(data) < 16:
        return None
    _, size, _, flags = struct.unpack("<IIII", data[:16])
    if flags & 0x4 or size <= 0 or size > len(data):
        return None
    font = data[-size:]
    if flags & 0x10000000:
        font = bytes(b ^ 0x50 for b in font)
    return font


class Fonts:
    def __init__(self, pptx_path):
        self.z = zipfile.ZipFile(pptx_path)
        self.raw = {}  # typeface (kichik harf) -> TTF bayt
        self.cache = {}
        self.theme = {}
        pres = self.z.read("ppt/presentation.xml").decode("utf8", "ignore")
        rels = self.z.read("ppt/_rels/presentation.xml.rels").decode("utf8", "ignore")
        relmap = {}
        for r in re.findall(r"<Relationship [^>]*/>", rels):
            i = re.search(r'Id="([^"]+)"', r).group(1)
            relmap[i] = re.search(r'Target="([^"]+)"', r).group(1)
        for block in re.findall(r"<p:embeddedFont>.*?</p:embeddedFont>", pres, re.S):
            fam = re.search(r'typeface="([^"]+)"', block).group(1)
            rid = re.search(r'<p:regular r:id="([^"]+)"', block) or re.search(r'r:id="([^"]+)"', block)
            if not rid or rid.group(1) not in relmap:
                continue
            try:
                ttf = eot_to_ttf(self.z.read("ppt/" + relmap[rid.group(1)].lstrip("/")))
                if ttf:
                    ImageFont.truetype(io.BytesIO(ttf), 10)
                    self.raw[fam.lower()] = ttf
            except Exception:
                pass
        try:
            th = self.z.read("ppt/theme/theme1.xml").decode("utf8", "ignore")
            mj = re.search(r"<a:majorFont>\s*<a:latin typeface=\"([^\"]*)\"", th)
            mn = re.search(r"<a:minorFont>\s*<a:latin typeface=\"([^\"]*)\"", th)
            self.theme = {"+mj-lt": mj.group(1) if mj else "Calibri", "+mn-lt": mn.group(1) if mn else "Calibri"}
        except KeyError:
            self.theme = {"+mj-lt": "Calibri", "+mn-lt": "Calibri"}

    def get(self, typeface, size=100):
        name = self.theme.get(typeface or "", typeface or "Calibri")
        key = (name.lower(), size)
        if key in self.cache:
            return self.cache[key]
        f = None
        if name.lower() in self.raw:
            f = ImageFont.truetype(io.BytesIO(self.raw[name.lower()]), size)
        else:
            path = SYSTEM.get(name.lower())
            for cand in ([os.path.join(WIN, path)] if path else []) + [os.path.join(WIN, name.replace(" ", "") + ".ttf")]:
                if os.path.exists(cand):
                    f = ImageFont.truetype(cand, size)
                    break
        if f is None:
            f = ImageFont.truetype(os.path.join(WIN, "arial.ttf"), size)
        self.cache[key] = f
        return f

    def width(self, text, typeface, size_pt):
        """Matn eni (pt)"""
        f = self.get(typeface, 100)
        return f.getlength(text) * size_pt / 100.0

    def em(self, typeface, caps=False):
        """O'rtacha harf eni (shrift o'lchamiga nisbatan) — o'zbekcha namunaviy matn bo'yicha"""
        s = "Kompyuter tuzilishi va uning asosiy qismlari haqida qisqacha ma'lumot o'quvchilar uchun"
        if caps:
            s = s.upper()
        f = self.get(typeface, 100)
        return f.getlength(s) / (len(s) * 100.0)


def wrap_lines(fonts, text, typeface, size_pt, width_pt):
    """So'zma-so'z qatorlarga bo'lish (PowerPoint kabi) — qatorlar soni"""
    n = 0
    for para in str(text).split("\n"):
        words = para.split()
        if not words:
            n += 1
            continue
        line = ""
        for w in words:
            cand = (line + " " + w).strip()
            if line and fonts.width(cand, typeface, size_pt) > width_pt:
                n += 1
                line = w
                while fonts.width(line, typeface, size_pt) > width_pt and len(line) > 1:  # juda uzun so'z bo'linadi
                    cut = len(line)
                    while cut > 1 and fonts.width(line[:cut], typeface, size_pt) > width_pt:
                        cut -= 1
                    n += 1
                    line = line[cut:]
            else:
                line = cand
        n += 1
    return n
