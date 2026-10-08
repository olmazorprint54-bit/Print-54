"""
Canva bo'lmagan taqdimot shablonlarini AI tizimiga mos .pptx qilib yasaydi:
  builtin  — ilovadagi 8 ta ichki dizayn (rang/shrift/bezak tavsifidan)
  office   — PowerPoint mavzulari (Facet, Ion, ...): maketlaridan namuna slaydlar
Natija: <out>/<id>.pptx — keyin analyze.py + shrink.py bilan ishlanadi.

Ishlatish:
  python make_templates.py builtin <out_dir>
  python make_templates.py office <PowerPoint_papkasi> <out_dir>
"""
import glob
import io
import os
import re
import sys
import zipfile

from lxml import etree
from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Emu, Pt

LOREM = ("Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore "
         "et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip "
         "ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu "
         "fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt "
         "mollit anim id est laborum. ") * 4
W, H = Emu(18288000), Emu(10287000)  # 1920x1080 (Canva bilan bir xil)


def photo_bytes():
    im = Image.new("RGB", (1600, 1000), (190, 198, 210))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=80)
    buf.seek(0)
    return buf


def lorem_for(w, h, size_pt, caps=False, fill=0.55):
    """Quti o'lchamiga mos namuna matn (analyze.py shu matndan sig'imni o'lchaydi)"""
    per_line = int(w / (size_pt * 12700 * (0.62 if caps else 0.5)))
    lines = max(1, int(h / (size_pt * 12700 * 1.2)))
    n = max(12, int(per_line * lines * fill))  # slayd ortiqcha matn bilan to'lib ketmasin
    t = LOREM[:n].rsplit(" ", 1)[0].rstrip(",") + "."
    return t.upper() if caps else t


def hexrgb(h):
    h = h.lstrip("#")
    return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def set_text(tf, text, size, color, font, bold=False, align=None):
    tf.clear()
    tf.word_wrap = True
    paras = text.split("\n")
    for i, line in enumerate(paras):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        if align is not None:
            p.alignment = align
        r = p.add_run()
        r.text = line
        r.font.size = Pt(size)
        r.font.bold = bold
        if color is not None:
            r.font.color.rgb = color
        if font:
            r.font.name = font


def alpha(shape, pct):
    """Shakl to'ldirishiga shaffoflik (0..100)"""
    sf = shape.fill._xPr.find(".//{http://schemas.openxmlformats.org/drawingml/2006/main}srgbClr")
    if sf is not None:
        a = etree.SubElement(sf, "{http://schemas.openxmlformats.org/drawingml/2006/main}alpha")
        a.set("val", str(int(pct * 1000)))


# ======================= ICHKI DIZAYNLAR =======================
STYLES = {
    "classic": dict(bg="#FFFFFF", title="#1F3A93", text="#334155", accent="#2E6BE6", font="Calibri", deco="bar"),
    "minimal": dict(bg="#FAFAF7", title="#111111", text="#444444", accent="#111111", font="Georgia", deco="line"),
    "night": dict(bg=("#0F172A", "#1E293B"), title="#FFFFFF", text="#CBD5E1", accent="#38BDF8", font="Calibri", deco="glow"),
    "nature": dict(bg="#F1F8F2", title="#1B5E20", text="#2E3B2F", accent="#43A047", font="Calibri", deco="leaf"),
    "academic": dict(bg="#FFFDF7", title="#7B1E1E", text="#333333", accent="#C9A227", font="Georgia", deco="frame"),
    "gradient": dict(bg=("#6D28D9", "#DB2777"), title="#FFFFFF", text="#F5F3FF", accent="#FDE68A", font="Calibri", deco="circles"),
    "kids": dict(bg="#FFF8E1", title="#E65100", text="#4E342E", accent="#29B6F6", font="Comic Sans MS", deco="dots"),
    "cmyk": dict(bg="#FFFFFF", title="#111111", text="#333333", accent="#E6007E", font="Calibri", deco="cmyk"),
}


def deco(slide, st, kind):
    acc = hexrgb(st["accent"])
    d = st["deco"]
    shapes = slide.shapes

    def add(shape_type, x, y, w, h, color, pct=None, line=False):
        s = shapes.add_shape(shape_type, Emu(x), Emu(y), Emu(w), Emu(h))
        if line:
            s.fill.background()
            s.line.color.rgb = color
            s.line.width = Pt(3)
        else:
            s.fill.solid()
            s.fill.fore_color.rgb = color
            s.line.fill.background()
            if pct is not None:
                alpha(s, pct)
        return s

    if d == "bar":
        add(MSO_SHAPE.RECTANGLE, 0, 0, 360000, H, acc)
        if kind == "title":
            add(MSO_SHAPE.RECTANGLE, 0, H - 900000, W, 900000, acc)
    elif d == "line":
        add(MSO_SHAPE.RECTANGLE, 1000000, 2350000 if kind != "title" else 6200000, 2400000, 60000, acc)
    elif d == "glow":
        add(MSO_SHAPE.OVAL, W - 5500000, -2500000, 8000000, 8000000, acc, 18)
        add(MSO_SHAPE.OVAL, -2500000, H - 3500000, 6000000, 6000000, acc, 10)
    elif d == "leaf":
        add(MSO_SHAPE.OVAL, W - 3000000, -1500000, 4500000, 4500000, acc, 35)
        add(MSO_SHAPE.OVAL, -1500000, H - 2500000, 4000000, 4000000, acc, 25)
    elif d == "frame":
        add(MSO_SHAPE.RECTANGLE, 400000, 400000, W - 800000, H - 800000, acc, line=True)
    elif d == "circles":
        add(MSO_SHAPE.OVAL, W - 4800000, -2000000, 6500000, 6500000, RGBColor(255, 255, 255), 14)
        add(MSO_SHAPE.OVAL, -1800000, H - 3000000, 5000000, 5000000, RGBColor(255, 255, 255), 10)
    elif d == "dots":
        for i, c in enumerate(["#29B6F6", "#FFCA28", "#EF5350", "#66BB6A"]):
            add(MSO_SHAPE.OVAL, W - 3600000 + i * 800000, 500000, 520000, 520000, hexrgb(c))
    elif d == "cmyk":
        for i, c in enumerate(["#00AEEF", "#E6007E", "#FFED00", "#111111"]):
            add(MSO_SHAPE.RECTANGLE, W - 3300000 + i * 700000, 600000, 520000, 520000, hexrgb(c))


def background(slide, st):
    bg = st["bg"]
    fill = slide.background.fill
    if isinstance(bg, tuple):
        fill.gradient()
        fill.gradient_angle = 45
        stops = fill.gradient_stops
        stops[0].color.rgb = hexrgb(bg[0])
        stops[1].color.rgb = hexrgb(bg[1])
    else:
        fill.solid()
        fill.fore_color.rgb = hexrgb(bg)


def make_builtin(sid, st, out):
    prs = Presentation()
    prs.slide_width, prs.slide_height = W, H
    blank = prs.slide_layouts[6]
    tc, xc, font = hexrgb(st["title"]), hexrgb(st["text"]), st["font"]
    acc = hexrgb(st["accent"])
    M = 1000000  # chekka

    def box(slide, x, y, w, h, text, size, color, bold=False, align=None):
        tb = slide.shapes.add_textbox(Emu(x), Emu(y), Emu(w), Emu(h))
        tf = tb.text_frame
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        set_text(tf, text, size, color, font, bold, align)
        return tb

    def new(kind):
        s = prs.slides.add_slide(blank)
        background(s, st)
        deco(s, st, kind)
        return s

    one = lambda size: int(size * 1.25 * 12700)  # bir qator balandligi (analyze.py qatorlarni shundan sanaydi)

    def title(slide, y=1000000, size=80):
        box(slide, M, y, W - 2 * M, one(size), "Lorem ipsum dolor sit amet", size, tc, True)

    # 1. Titul
    s = new("title")
    box(s, M, 2700000, W - 2 * M, 2 * one(110), "Lorem Ipsum Dolor Sit Amet Elit", 110, tc, True)
    box(s, M, 6400000, W - 2 * M, one(44), "Consectetur adipiscing elit sed do", 44, xc)
    # 2. Matn
    s = new("content"); title(s)
    box(s, M, 2700000, W - 2 * M, 6300000, lorem_for(W - 2 * M, 6300000, 40), 40, xc)
    # 3. Ikki ustun
    s = new("content"); title(s)
    cw = (W - 2 * M - 800000) // 2
    for i in range(2):
        x = M + i * (cw + 800000)
        box(s, x, 2700000, cw, one(52), "Lorem ipsum dolor", 52, acc, True)
        box(s, x, 3800000, cw, 5300000, lorem_for(cw, 5300000, 36), 36, xc)
    # 4. Rasm + matn
    s = new("content"); title(s)
    tw = (W - 2 * M) // 2 - 300000
    box(s, M, 2700000, tw, 6300000, lorem_for(tw, 6300000, 36), 36, xc)
    s.shapes.add_picture(photo_bytes(), Emu(M + tw + 600000), Emu(2700000), Emu(W - 2 * M - tw - 600000), Emu(6000000))
    # 5. Uch band
    s = new("content"); title(s)
    cw = (W - 2 * M - 2 * 600000) // 3
    for i in range(3):
        x = M + i * (cw + 600000)
        box(s, x, 2700000, cw, one(48), "Lorem ipsum", 48, acc, True)
        box(s, x, 3800000, cw, 5300000, lorem_for(cw, 5300000, 32), 32, xc)
    # 6. Xulosa
    s = new("content"); title(s)
    box(s, M, 2700000, W - 2 * M, 6300000, lorem_for(W - 2 * M, 6300000, 42), 42, xc)
    # 7. Rahmat
    s = new("title")
    box(s, M, 3200000, W - 2 * M, one(140), "Thank you!", 140, tc, True, PP_ALIGN.CENTER)
    box(s, M, 6000000, W - 2 * M, one(44), "Questions and discussion", 44, xc, False, PP_ALIGN.CENTER)
    prs.save(os.path.join(out, sid + ".pptx"))


# ======================= POWERPOINT MAVZULARI =======================
OFFICE_IDS = {
    "Facet": "pp-facet", "Gallery": "pp-gallery", "Integral": "pp-integral", "Ion": "pp-ion", "Ion Boardroom": "pp-ion-boardroom",
    "Slice": "pp-slice", "Wisp": "pp-wisp", "Banded": "pp-banded", "Basis": "pp-basis", "Berlin": "pp-berlin",
    "Circuit": "pp-circuit", "Damask": "pp-damask", "Droplet": "pp-droplet", "Dividend": "pp-dividend", "Parallax": "pp-parallax",
}
WANT = [("Title Slide", "title"), ("Title and Content", "text"), ("Two Content", "two"), ("Comparison", "cmp"),
        ("Picture with Caption", "pic"), ("Content with Caption", "cap"), ("Section Header", "section")]


def remove_all_slides(prs):
    ids = prs.slides._sldIdLst
    for sld in list(ids):
        prs.part.drop_rel(sld.rId)
        ids.remove(sld)


def fill_layout_slide(prs, layout, kind, last=False):
    s = prs.slides.add_slide(layout)
    for ph in list(s.placeholders):
        t = ph.placeholder_format.type
        tname = str(t).split(".")[-1].split(" ")[0] if t is not None else ""
        # o'lcham va joyni maketdan slaydga yozib qo'yamiz (analyze.py uchun)
        x, y, w, h = ph.left, ph.top, ph.width, ph.height
        if None in (x, y, w, h):
            continue
        ph.left, ph.top, ph.width, ph.height = x, y, w, h
        if tname == "PICTURE":
            pic = ph.insert_picture(photo_bytes())
            pic.left, pic.top, pic.width, pic.height = x, y, w, h  # rasm o'lchami slaydda yozilsin
            continue
        if not ph.has_text_frame:
            continue
        if tname in ("CENTER_TITLE",):
            set_text(ph.text_frame, "Thank you!" if last else "Lorem Ipsum Dolor Sit", 54, None, None, False)
        elif tname == "TITLE":
            set_text(ph.text_frame, "Lorem Ipsum Dolor", 40, None, None)
        elif tname == "SUBTITLE":
            set_text(ph.text_frame, "Questions and discussion" if last else "Consectetur adipiscing elit", 22, None, None)
        elif tname in ("BODY", "OBJECT"):
            size = 16 if kind in ("pic", "cap", "section") and h < 3000000 else 20
            txt = lorem_for(w, h, size)
            if kind in ("text", "two", "cmp") and h > 2500000:
                parts = re.split(r"(?<=\.)\s+", txt)
                txt = "\n".join(p for p in parts if p)[: len(txt)]
            set_text(ph.text_frame, txt if len(txt) > 30 or kind != "cmp" else "Lorem ipsum dolor", size, None, None)
    return s


def make_office(path, out):
    z = zipfile.ZipFile(path)
    name = re.search(r'<a:theme [^>]*name="([^"]*)"', z.read("ppt/theme/theme1.xml").decode("utf8", "ignore")).group(1)
    sid = OFFICE_IDS.get(name)
    if not sid:
        return None
    prs = Presentation(path)  # asl o'lcham (13,33") saqlanadi — maketlar shunga chizilgan
    remove_all_slides(prs)
    by_name = {l.name: l for l in prs.slide_layouts}
    for lname, kind in WANT:
        if lname in by_name:
            fill_layout_slide(prs, by_name[lname], kind)
    if "Title Slide" in by_name:
        fill_layout_slide(prs, by_name["Title Slide"], "title", last=True)
    prs.save(os.path.join(out, sid + ".pptx"))
    return sid


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "builtin":
        out = sys.argv[2]
        os.makedirs(out, exist_ok=True)
        for sid, st in STYLES.items():
            make_builtin(sid, st, out)
            print("OK", sid)
    else:
        src, out = sys.argv[2], sys.argv[3]
        os.makedirs(out, exist_ok=True)
        for f in sorted(glob.glob(os.path.join(src, "*.pptx"))):
            sid = make_office(f, out)
            print("OK" if sid else "SKIP", os.path.basename(f), sid or "")
