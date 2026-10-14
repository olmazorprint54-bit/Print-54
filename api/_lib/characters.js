// api/_lib/characters.js
// ---------------------------------------------------------------
// «Jonli personaj»: tayyor PPTX ning birinchi va oxirgi slaydiga harakatlanuvchi
// personaj (shaffof GIF) qo'shiladi; slayd ochilganda ovozi o'zi boshlanadi
// (PowerPoint namoyish rejimida, F5). Hech qanday AI kerak emas.
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

const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const nextId = (xml, re) => Math.max(0, ...[...xml.matchAll(re)].map((m) => parseInt(m[1], 10))) + 1;

// PowerPoint o'zi yozadigan shablon: slayd ochilganda «oldingisi bilan» boshlanadi, takrorlanadi, slayd almashganda to'xtaydi
const timing = (spid) => `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst><p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst><p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="5" presetID="1" presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="withEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr><p:cTn id="6" dur="1" fill="hold"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr></p:cmd></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq><p:audio><p:cMediaNode vol="80000" showWhenStopped="0"><p:cTn id="7" repeatCount="indefinite" fill="hold" display="0"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:endCondLst><p:cond evt="onStopAudio" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:endCondLst></p:cTn><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cMediaNode></p:audio></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;

// buf — tayyor .pptx; {sound} — ovoz bilan; side: "right" | "left"
async function addCharacter(buf, id, { sound = true, side = "right" } = {}) {
  const ch = get(id);
  if (!ch) return buf;
  const zip = await JSZip.loadAsync(buf);
  const read = async (p) => { const f = zip.file(p); return f ? f.async("string") : null; };

  // slaydlar tartibi
  const pres = await read("ppt/presentation.xml");
  const presRels = await read("ppt/_rels/presentation.xml.rels");
  const sz = pres && pres.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
  if (!pres || !presRels || !sz) return buf;
  const W = parseInt(sz[1], 10), H = parseInt(sz[2], 10);
  const relMap = {};
  for (const m of presRels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id2 = (m[0].match(/\bId="([^"]+)"/) || [])[1], t = (m[0].match(/\bTarget="([^"]+)"/) || [])[1];
    if (id2 && t) relMap[id2] = t.startsWith("/") ? t.slice(1) : path.posix.normalize("ppt/" + t);
  }
  const order = [...pres.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)].map((m) => relMap[m[1]]).filter(Boolean);
  if (!order.length) return buf;
  const targets = [...new Set([order[0], order[order.length - 1]])];

  // media (bitta nusxa — ikkala slayd unga murojaat qiladi)
  zip.file("ppt/media/char-1.gif", fs.readFileSync(path.join(DIR, id + ".gif")));
  const hasAudio = sound && fs.existsSync(path.join(DIR, id + ".mp3"));
  if (hasAudio) zip.file("ppt/media/char-1.mp3", fs.readFileSync(path.join(DIR, id + ".mp3")));
  let ct = await read("[Content_Types].xml");
  if (!/Extension="gif"/i.test(ct)) ct = ct.replace("<Default ", `<Default Extension="gif" ContentType="image/gif"/><Default `);
  if (hasAudio && !/Extension="mp3"/i.test(ct)) ct = ct.replace("<Default ", `<Default Extension="mp3" ContentType="audio/mpeg"/><Default `);
  zip.file("[Content_Types].xml", ct);

  // o'lcham: slayd kengligining ~19%, burchakda
  const cw = Math.round(W * 0.19), chh = Math.round((cw * ch.h) / ch.w);
  const mx = Math.round(W * 0.025), my = Math.round(H * 0.035);
  const x = side === "left" ? mx : W - cw - mx, y = H - chh - my;

  for (const slidePath of targets) {
    let xml = await read(slidePath);
    const relPath = slidePath.replace(/([^/]+)$/, "_rels/$1.rels");
    let rels = await read(relPath);
    if (!xml || !rels) continue;
    const rid = (n) => `rId${n}`;
    let nr = nextId(rels, /\bId="rId(\d+)"/g);
    const imgRid = rid(nr++);
    let add = `<Relationship Id="${imgRid}" Type="${REL}/image" Target="../media/char-1.gif"/>`;
    let audRid, medRid;
    const canAudio = hasAudio && !/<p:timing[\s>]/.test(xml); // slaydda boshqa animatsiya bo'lsa — ovoz qo'shilmaydi
    if (canAudio) {
      audRid = rid(nr++); medRid = rid(nr++);
      add += `<Relationship Id="${audRid}" Type="${REL}/audio" Target="../media/char-1.mp3"/><Relationship Id="${medRid}" Type="http://schemas.microsoft.com/office/2007/relationships/media" Target="../media/char-1.mp3"/>`;
    }
    rels = rels.replace("</Relationships>", add + "</Relationships>");
    zip.file(relPath, rels);

    let sid = nextId(xml, /<p:cNvPr\b[^>]*\bid="(\d+)"/g);
    const picId = sid++;
    let shapes = `<p:pic><p:nvPicPr><p:cNvPr id="${picId}" name="Jonli personaj"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${imgRid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cw}" cy="${chh}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
    let audId = 0;
    if (canAudio) {
      audId = sid++;
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
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

module.exports = { list, get, addCharacter, ALL };
