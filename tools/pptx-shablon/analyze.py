"""
Canva taqdimot shablonini tahlil qiladi va AI uchun "spec" (JSON) yozadi:
har bir slaydda qaysi matn joylari bor (sarlavha / matn / yorliq), qancha
harf sig'adi va qaysi joylar rasm (foto) uchun.

Rasmlar ko'pincha guruh (grpSp) ichida — haqiqiy o'lcham guruh masshtabi
bilan hisoblanadi. Server (api/_lib/pres-gen.js) shakllarni id bo'yicha
topib matn va rasmni almashtiradi.

Ishlatish:  python analyze.py <shablon.pptx> <chiqish.json>
"""
import io
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

from PIL import Image

Image.MAX_IMAGE_PIXELS = None
EMU_PT = 12700
NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
R_EMBED = "{%s}embed" % NS["r"]


def rels_of(z, part):
    folder, name = part.rsplit("/", 1)
    try:
        xml = z.read(f"{folder}/_rels/{name}.rels").decode("utf8")
    except KeyError:
        return {}
    out = {}
    for r in re.findall(r"<Relationship [^>]*/>", xml):
        i = re.search(r'Id="([^"]+)"', r).group(1)
        t = re.search(r'Target="([^"]+)"', r).group(1)
        out[i] = t
    return out


def resolve(base_part, target):
    parts = base_part.split("/")[:-1]
    for seg in target.split("/"):
        if seg == "..":
            parts.pop()
        elif seg and seg != ".":
            parts.append(seg)
    return "/".join(parts)


def is_photo(z, path):
    ext = path.rsplit(".", 1)[-1].lower()
    if ext in ("jpg", "jpeg"):
        return True
    if ext == "png":
        try:
            im = Image.open(io.BytesIO(z.read(path)))
            if min(im.size) < 300:
                return False
            return im.mode == "RGB" or (im.mode == "RGBA" and im.getextrema()[3][0] >= 250)
        except Exception:
            return False
    return False


def walk(node, tf, cb):
    """tf = (ox, oy, sx, sy): bola koordinatalarini slayd koordinatasiga o'tkazish"""
    for ch in node:
        tag = ch.tag.split("}")[1]
        if tag == "grpSp":
            x = ch.find("p:grpSpPr/a:xfrm", NS)
            if x is None:
                walk(ch, tf, cb)
                continue
            off, ext = x.find("a:off", NS), x.find("a:ext", NS)
            choff, chext = x.find("a:chOff", NS), x.find("a:chExt", NS)
            gx, gy = int(off.get("x")), int(off.get("y"))
            gw, gh = int(ext.get("cx")), int(ext.get("cy"))
            cx0, cy0 = int(choff.get("x")), int(choff.get("y"))
            cw, chh = max(int(chext.get("cx")), 1), max(int(chext.get("cy")), 1)
            sx, sy = gw / cw, gh / chh
            ox, oy, psx, psy = tf
            # bola (x) -> guruh: gx + (x - cx0) * sx -> ota: ox + (...) * psx
            walk(ch, (ox + (gx - cx0 * sx) * psx, oy + (gy - cy0 * sy) * psy, psx * sx, psy * sy), cb)
        elif tag in ("sp", "pic"):
            cb(ch, tf)


def analyze(path):
    z = zipfile.ZipFile(path)
    pres = z.read("ppt/presentation.xml").decode("utf8")
    m = re.search(r'<p:sldSz cx="(\d+)" cy="(\d+)"', pres)
    cx, cy = int(m.group(1)), int(m.group(2))
    prels = rels_of(z, "ppt/presentation.xml")
    order = re.findall(r'<p:sldId [^>]*r:id="(rId\d+)"', pres)
    slides = []
    for n, rid in enumerate(order, 1):
        part = resolve("ppt/presentation.xml", prels[rid])
        root = ET.fromstring(z.read(part))
        rels = rels_of(z, part)
        slots, photos = [], []

        def visit(el, tf):
            ox, oy, sx, sy = tf
            sid = el.find(".//p:cNvPr", NS).get("id")
            xfrm = el.find("p:spPr/a:xfrm", NS)
            if xfrm is None or xfrm.find("a:off", NS) is None:
                return
            x, y = int(xfrm.find("a:off", NS).get("x")), int(xfrm.find("a:off", NS).get("y"))
            w, h = int(xfrm.find("a:ext", NS).get("cx")), int(xfrm.find("a:ext", NS).get("cy"))
            ax, ay, aw, ah = ox + x * sx, oy + y * sy, w * sx, h * sy
            tx = el.find("p:txBody", NS)
            if tx is not None:
                paras = ["".join(t.text or "" for t in p.iter("{%s}t" % NS["a"])) for p in tx.findall("a:p", NS)]
                full = "\n".join(paras).strip()
                if full:
                    sizes = [int(r.get("sz")) for r in tx.iter("{%s}rPr" % NS["a"]) if r.get("sz")] or [1800]
                    sz = max(sizes) / 100 * sy  # guruh ichida shrift ham masshtablanmaydi, lekin quti ha
                    sz = max(sizes) / 100
                    ln = tx.find(".//a:lnSpc/a:spcPts", NS)
                    line_h = (int(ln.get("val")) / 100 if ln is not None else sz * 1.2) * EMU_PT
                    rprs = list(tx.iter("{%s}rPr" % NS["a"]))
                    bold = any(r.get("b") in ("1", "true") for r in rprs)
                    caps = any(r.get("cap") == "all" for r in rprs) or (full == full.upper() and any(c.isalpha() for c in full))
                    slots.append({"id": sid, "text": full, "chars": len(full), "paras": len([p for p in paras if p.strip()]),
                                  "sz": sz, "x": ax, "y": ay, "w": aw, "h": ah, "lineH": line_h, "bold": bold, "caps": caps})
                    return
            blip = el.find(".//a:blip", NS)
            if blip is not None and blip.find(".//{http://schemas.microsoft.com/office/drawing/2016/SVG/main}svgBlip") is None:
                target = rels.get(blip.get(R_EMBED))
                area = aw * ah / (cx * cy)
                if target and 0.03 <= area <= 0.9 and is_photo(z, resolve(part, target)):
                    photos.append({"id": sid, "w": round(aw), "h": round(ah), "area": round(area, 3)})

        walk(root.find("p:cSld/p:spTree", NS), (0, 0, 1, 1), visit)

        # Rollar: eng katta shrift — sarlavha; uzun — matn; qisqa — yorliq; raqam — o'zgarmas
        text_slots = [s for s in slots if not re.fullmatch(r"[\d\W_]{1,4}", s["text"])]
        for s in slots:
            if s not in text_slots:
                s["kind"] = "fixed"
        if text_slots:
            top = max(text_slots, key=lambda s: (s["sz"], -s["y"]))
            for s in text_slots:
                ph = s["text"].strip().upper()
                if ph == "[SARLAVHA]":
                    s["kind"] = "title"
                elif ph == "[MATN]":
                    s["kind"] = "text"
                elif s is top and s["chars"] <= 90:
                    s["kind"] = "title"
                elif s["chars"] > 60 or s["paras"] > 2:
                    s["kind"] = "text"
                else:
                    s["kind"] = "label"
        # Sig'im (harf): namuna matn uzunligi; sarlavha/yorliq — kamida quti enidagi bir qator;
        # [MATN] belgisi — quti eni va pastgacha bo'lgan joy
        # cpl — bir qatorga sig'adigan harf: namuna matn 2+ qator bo'lsa — o'sha shriftda
        # o'lchangan (eng aniq), aks holda quti eni va shrift turi (KATTA/qalin — kengroq)
        for s in slots:
            placeholder = s["text"].strip().startswith("[")
            lines = max(1, round(s["h"] / max(s["lineH"], 1)))
            f = (0.62 if s["caps"] else 0.5) + (0.06 if s["bold"] else 0)
            cpl_w = s["w"] / (s["sz"] * EMU_PT * f)
            # namuna matn haqiqatan bir necha qatorga o'ralgan bo'lsagina (quti matndan baland bo'lishi mumkin)
            if lines >= 2 and s["chars"] >= 20 and not placeholder and s["chars"] > cpl_w * 0.9:
                cpl = min(cpl_w * 1.1, s["chars"] / lines)
            else:
                cpl = cpl_w
            cpl = max(4, cpl)
            if s["kind"] == "text" and placeholder:
                lines = max(2, min(12, int((cy * 0.93 - s["y"]) / max(s["lineH"], 1))))
                s["max"] = cpl * lines
            elif s["kind"] in ("title", "label"):
                if placeholder:
                    lines = 2
                s["max"] = max(cpl * lines, 8)
            else:
                s["max"] = max(s["chars"], cpl * lines, 12)
            s["perLine"] = cpl
            s["lines"] = lines
        low = " ".join(s["text"].lower() for s in slots)
        role = "title" if n == 1 else "end" if n == len(order) and re.search(r"thank|rahmat|e.tibor|спасибо|savol", low) else "content"
        slides.append({"n": n, "part": part, "role": role, "slots": [
            {k: (round(s[k], 1) if k == "perLine" else round(s[k]) if k == "max" else s[k]) for k in ("id", "kind", "chars", "max", "perLine", "lines", "caps", "sz", "paras", "text")}
            for s in slots
        ], "photos": photos})
    return {"size": [cx, cy], "slides": slides}


if __name__ == "__main__":
    spec = analyze(sys.argv[1])
    with open(sys.argv[2], "w", encoding="utf8") as f:
        json.dump(spec, f, ensure_ascii=False, indent=1)
    for s in spec["slides"]:
        kinds = ", ".join(f'{t["kind"]}({t["max"]})' for t in s["slots"] if t["kind"] != "fixed")
        print(f'{s["n"]:>2} {s["role"]:<7} {kinds}{" | foto×" + str(len(s["photos"])) if s["photos"] else ""}')
