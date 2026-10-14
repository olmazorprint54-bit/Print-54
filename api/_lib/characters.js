// api/_lib/characters.js
// ---------------------------------------------------------------
// «Jonli personaj»: mijozning tayyor PPTX taqdimotiga harakatlanuvchi personaj
// (shaffof GIF) qo'shiladi. Odatda — oxirgi «Rahmat» slaydiga; mijoz xohlasa
// birinchi yoki istalgan slaydlarga. Musiqa: personajning o'z ovozi, ovozsiz
// yoki mijoz yuklagan fayl. Slayd ochilganda o'zi boshlanadi (PowerPoint
// namoyish rejimida, F5). Hech qanday AI kerak emas.
// Fayllar: api/_lib/pres/characters/<id>.gif va <id>.mp3 (xususiy repoda;
// ommaviy Print-54 repoda yo'q — u yerda ro'yxat bo'sh, imkoniyat o'chiq).
// ---------------------------------------------------------------
const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

const DIR = path.join(__dirname, "pres", "characters");
const ALL = [
  { id: "hamster", name: "Hamster", w: 360, h: 390, ms: 13000 },
];
const have = (c) => fs.existsSync(path.join(DIR, c.id + ".gif"));
const list = () => ALL.filter(have);
const get = (id) => list().find((c) => c.id === id) || null;

// o'lcham: slayd kengligiga nisbatan (Katta — avvalgidan 1,5 baravar)
const SIZE = { m: 0.19, l: 0.285, xl: 0.38 };
const AUDIO_TYPES = { mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav" };

const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const nextId = (xml, re) => Math.max(0, ...[...xml.matchAll(re)].map((m) => parseInt(m[1], 10))) + 1;
const userErr = (m) => Object.assign(new Error(m), { user: true });

// PowerPoint o'zi yozadigan shablon: slayd ochilganda «oldingisi bilan» boshlanadi, takrorlanadi, slayd almashganda to'xtaydi
const timing = (spid) => `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst><p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst><p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="5" presetID="1" presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="withEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr><p:cTn id="6" dur="1" fill="hold"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr></p:cmd></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq><p:audio><p:cMediaNode vol="80000" showWhenStopped="0"><p:cTn id="7" repeatCount="indefinite" fill="hold" display="0"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:endCondLst><p:cond evt="onStopAudio" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:endCondLst></p:cTn><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cMediaNode></p:audio></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;

// Taqdimotdagi slaydlar soni va tartibi (slayd fayl yo'llari)
async function slidesOf(zip) {
  const read = async (p) => { const f = zip.file(p); return f ? f.async("string") : null; };
  const pres = await read("ppt/presentation.xml");
  const presRels = await read("ppt/_rels/presentation.xml.rels");
  const sz = pres && pres.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
  if (!pres || !presRels || !sz) throw userErr("PowerPoint faylni o'qib bo'lmadi: fayl buzilgan bo'lishi mumkin.");
  const relMap = {};
  for (const m of presRels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = (m[0].match(/\bId="([^"]+)"/) || [])[1], t = (m[0].match(/\bTarget="([^"]+)"/) || [])[1];
    if (id && t) relMap[id] = t.startsWith("/") ? t.slice(1) : path.posix.normalize("ppt/" + t);
  }
  const order = [...pres.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)].map((m) => relMap[m[1]]).filter(Boolean);
  if (!order.length) throw userErr("Taqdimotda slayd topilmadi.");
  return { order, W: parseInt(sz[1], 10), H: parseInt(sz[2], 10), read };
}

// o = { sound: "char" | "none" | "custom", music: Buffer, musicExt, where: "last"|"first"|"both"|"custom",
//       slideText: "3, 5-7", side: "right"|"left", size: "m"|"l"|"xl" }
async function addCharacter(buf, id, o = {}) {
  const ch = get(id);
  if (!ch) throw userErr("Bunday personaj topilmadi.");
  const zip = await JSZip.loadAsync(buf).catch(() => { throw userErr("PowerPoint faylni o'qib bo'lmadi: fayl buzilgan yoki parol bilan himoyalangan bo'lishi mumkin."); });
  const { order, W, H, read } = await slidesOf(zip);
  const n = order.length;

  // qaysi slaydlarga
  let idx;
  if (o.where === "first") idx = [0];
  else if (o.where === "both") idx = [0, n - 1];
  else if (o.where === "custom") {
    if (!String(o.slideText || "").trim()) throw userErr("Slayd raqamlarini yozing. Masalan: 3, 5-7");
    try { idx = require("./doc-tools").parsePages(o.slideText, n).slice(0, 12); }
    catch (e) { throw userErr(String(e.message).replace(/PDF da (\d+) ta sahifa bor/, "Taqdimotda $1 ta slayd bor").replace(/Sahifa raqamlarini/, "Slayd raqamlarini")); }
  } else idx = [n - 1];
  const targets = [...new Set(idx)].map((i) => order[i]).filter(Boolean);

  // ovoz
  let audio = null, audioExt = "mp3";
  if (o.sound === "custom" && o.music && o.music.length) { audio = o.music; audioExt = AUDIO_TYPES[o.musicExt] ? o.musicExt : "mp3"; }
  else if (o.sound !== "none" && fs.existsSync(path.join(DIR, id + ".mp3"))) audio = fs.readFileSync(path.join(DIR, id + ".mp3"));

  // media (bitta nusxa — barcha slaydlar unga murojaat qiladi)
  zip.file("ppt/media/char-1.gif", fs.readFileSync(path.join(DIR, id + ".gif")));
  if (audio) zip.file(`ppt/media/char-audio.${audioExt}`, audio);
  let ct = await read("[Content_Types].xml");
  if (!/Extension="gif"/i.test(ct)) ct = ct.replace("<Default ", `<Default Extension="gif" ContentType="image/gif"/><Default `);
  if (audio && !new RegExp(`Extension="${audioExt}"`, "i").test(ct)) ct = ct.replace("<Default ", `<Default Extension="${audioExt}" ContentType="${AUDIO_TYPES[audioExt]}"/><Default `);
  zip.file("[Content_Types].xml", ct);

  // o'lcham va joy
  const cw = Math.round(W * (SIZE[o.size] || SIZE.l)), chh = Math.round((cw * ch.h) / ch.w);
  const mx = Math.round(W * 0.02), my = Math.round(H * 0.03);
  const x = o.side === "left" ? mx : W - cw - mx, y = Math.max(0, H - chh - my);

  let withSound = 0;
  for (const slidePath of targets) {
    let xml = await read(slidePath);
    const relPath = slidePath.replace(/([^/]+)$/, "_rels/$1.rels");
    let rels = await read(relPath);
    if (!xml || !rels) continue;
    let nr = nextId(rels, /\bId="rId(\d+)"/g);
    const imgRid = `rId${nr++}`;
    let add = `<Relationship Id="${imgRid}" Type="${REL}/image" Target="../media/char-1.gif"/>`;
    let audRid, medRid;
    const canAudio = !!audio && !/<p:timing[\s>]/.test(xml); // slaydda boshqa animatsiya bo'lsa — ovoz qo'shilmaydi
    if (canAudio) {
      audRid = `rId${nr++}`; medRid = `rId${nr++}`;
      add += `<Relationship Id="${audRid}" Type="${REL}/audio" Target="../media/char-audio.${audioExt}"/><Relationship Id="${medRid}" Type="http://schemas.microsoft.com/office/2007/relationships/media" Target="../media/char-audio.${audioExt}"/>`;
    }
    zip.file(relPath, rels.replace("</Relationships>", add + "</Relationships>"));

    let sid = nextId(xml, /<p:cNvPr\b[^>]*\bid="(\d+)"/g);
    const picId = sid++;
    let shapes = `<p:pic><p:nvPicPr><p:cNvPr id="${picId}" name="Jonli personaj"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${imgRid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cw}" cy="${chh}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
    let audId = 0;
    if (canAudio) {
      audId = sid++;
      withSound++;
      // ovoz belgisi slayddan tashqarida (ko'rinmaydi)
      shapes += `<p:pic><p:nvPicPr><p:cNvPr id="${audId}" name="Personaj ovozi"><a:hlinkClick r:id="" action="ppaction://media"/></p:cNvPr><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr><a:audioFile r:link="${audRid}"/><p:extLst><p:ext uri="{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}"><p14:media xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" r:embed="${medRid}"/></p:ext></p:extLst></p:nvPr></p:nvPicPr><p:blipFill><a:blip r:embed="${imgRid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="-914400" y="-914400"/><a:ext cx="365760" cy="365760"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
    }
    xml = xml.replace("</p:spTree>", shapes + "</p:spTree>");
    if (canAudio) {
      // timing: oxirgi bola (sld-darajadagi extLst dan oldin yoki </p:sld> dan oldin); transition undan oldin turadi
      const tail = xml.lastIndexOf("</p:sld>");
      const ext = xml.lastIndexOf("<p:extLst>", tail);
      const after = xml.lastIndexOf("</p:cSld>");
      const at = ext > after ? ext : tail;
      xml = xml.slice(0, at) + timing(audId) + xml.slice(at);
    }
    zip.file(slidePath, xml);
  }
  const buffer = Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  return { buffer, slides: targets.length, withSound, total: n };
}

module.exports = { list, get, addCharacter, ALL, SIZE, AUDIO_TYPES };
