"""
Canva shablonini kichraytiradi (dizayn o'zgarmaydi):
  - 1920 pikseldan katta rasmlar kichraytiriladi
  - shaffof bo'lmagan katta PNG -> JPEG (nomi va havolalari yangilanadi)
  - JPEG qayta siqiladi (sifat 82)

Ishlatish:  python shrink.py <manba.pptx> <natija.pptx>
"""
import io
import os
import re
import sys
import zipfile

from PIL import Image

Image.MAX_IMAGE_PIXELS = None
MAX = 1920


def shrink(src, dst):
    zin = zipfile.ZipFile(src)
    renamed = {}
    media = {}
    for it in zin.infolist():
        low = it.filename.lower()
        if "/media/" not in low or not low.endswith((".png", ".jpg", ".jpeg")):
            continue
        data = zin.read(it.filename)
        if len(data) < 120_000:
            continue
        try:
            im = Image.open(io.BytesIO(data))
            im.load()
        except Exception:
            continue
        if max(im.size) > MAX:
            im.thumbnail((MAX, MAX), Image.LANCZOS)
        opaque = im.mode in ("RGB", "L", "CMYK") or (im.mode in ("RGBA", "LA") and im.getextrema()[-1][0] >= 255)
        buf = io.BytesIO()
        if low.endswith(".png") and opaque:
            im.convert("RGB").save(buf, "JPEG", quality=82, optimize=True, progressive=True)
            new = it.filename.rsplit(".", 1)[0] + ".jpeg"
            if buf.tell() < len(data) * 0.8 and new not in zin.namelist():
                renamed[it.filename] = new
                media[new] = buf.getvalue()
            continue
        if low.endswith(".png"):
            im.save(buf, "PNG", optimize=True)
        else:
            im.convert("RGB").save(buf, "JPEG", quality=82, optimize=True, progressive=True)
        if buf.tell() < len(data):
            media[it.filename] = buf.getvalue()

    zout = zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED)
    for it in zin.infolist():
        name = it.filename
        if name.endswith("/"):
            continue
        if name in renamed:
            zout.writestr(renamed[name], media[renamed[name]])
            continue
        data = media.get(name) or zin.read(name)
        if name.endswith(".rels") and renamed:
            text = data.decode("utf8")
            for old, new in renamed.items():
                text = text.replace("media/" + old.rsplit("/", 1)[1], "media/" + new.rsplit("/", 1)[1])
            data = text.encode("utf8")
        if name == "[Content_Types].xml" and renamed:
            text = data.decode("utf8")
            if not re.search(r'Extension="jpeg"', text, re.I):
                text = re.sub(r"(<Types[^>]*>)", r'\1<Default Extension="jpeg" ContentType="image/jpeg"/>', text, 1)
            data = text.encode("utf8")
        zout.writestr(name, data)
    zout.close()


if __name__ == "__main__":
    shrink(sys.argv[1], sys.argv[2])
    a, b = os.path.getsize(sys.argv[1]), os.path.getsize(sys.argv[2])
    print(f"{a // 1024}K -> {b // 1024}K ({100 * b // a}%)  {os.path.basename(sys.argv[1])}")
