// Devoriy gazeta shablonlari: bitta tik varaq, sahifa birligi 1122x1587 px (PDF'da scale 2 bilan A1 bo'ladi).
// Hamma shablon bir xil ma'lumot oladi, shuning uchun AI bitta tuzilmani to'ldiradi:
// { name, line, meta, banner, main{title,text[],photo,cap}, side{...}, a{...}, b{...}, facts{title,items[]}, poem{title,lines[]}, quiz{title,items[]} }
// Matn uzunligi har xil bo'lganda ham varaq to'lib turadi: rasm bo'sh joyni egallaydi, FIT skripti esa shrift o'lchamini guruh bo'yicha tanlaydi.
const FONTS = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;800;900&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@500;700;900&family=Oswald:wght@500;700&family=Caveat:wght@600;700&family=Nunito:wght@600;800&display=swap";
// O'zbekcha o' va g' uchun tipografik belgi (hamma shriftda bor)
const up = (s) => String(s).replace(/([oOgG])'/g, "$1‘").replace(/'/g, "’");
const esc = (s) => up(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const ps = (arr) => [].concat(arr).map((p) => `<p>${esc(p)}</p>`).join("");
const lis = (arr) => arr.map((x) => `<li>${esc(x)}</li>`).join("");
const lines = (arr) => arr.map((x) => `<div>${esc(x)}</div>`).join("");
const img = (s, c = "ph") => (s.photo ? `<div class="${c}"><img src="${s.photo}" alt=""></div>` : "");
const cap = (s) => (s.cap ? `<div class="cap">${esc(s.cap)}</div>` : "");
const body = (s, g = "small") => `<div class="tx" data-fit="${g}">${ps(s.text)}</div>`;
const list = (items, tag = "ul") => `<${tag} data-fit="list">${lis(items)}</${tag}>`;
const verse = (l) => `<div class="vs" data-fit="poem">${lines(l)}</div>`;
const title = (tag, text, maxh) => `<${tag} data-title data-maxh="${maxh}">${esc(text)}</${tag}>`;

const BASE = `*{margin:0;padding:0;box-sizing:border-box}html,body{width:1122px;height:1587px;background:#fff}
.page{position:relative;width:1122px;height:1587px;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.c,.fx{display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden}
.ph{flex:1 1 0;min-height:120px;overflow:hidden;position:relative}.ph img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover}
.cap,h2,h3,.lab{flex:none}.tx,.vs,ul,ol{flex:none}
ul,ol{padding-left:1.25em}li{margin-bottom:.45em}.tx p{margin-bottom:.5em}.tx p:last-child{margin-bottom:0}
[data-fit]{font-size:16px}[data-fit] p,[data-fit] li,[data-fit]>div{font-size:inherit!important}`;

// Shrift o'lchamini tanlash: bir guruh (main/small/list/poem) bir xil o'lchamda, kartadan chiqmaydi, rasm min-height'dan kichraymaydi
const FIT = `<script>(function(){
var R={main:[24,11.5],small:[21,11.5],list:[20,11.5],poem:[23,12]};
function card(e){var a=e.parentElement;while(a&&!a.classList.contains('page')){if(getComputedStyle(a).overflow==='hidden')return a;a=a.parentElement}return a}
function ok(e){var c=card(e);if(c.scrollHeight>c.clientHeight+1)return false;var p=c.querySelectorAll('.ph');for(var i=0;i<p.length;i++){if(p[i].classList.contains('rd'))continue;if(p[i].clientHeight<(+p[i].getAttribute('data-min')||118))return false}return true}
function bake(){if(!document.querySelector('.tx2'))return;[].slice.call(document.images).forEach(function(i){try{var w=Math.min(i.naturalWidth,1500),h=Math.round(i.naturalHeight*w/i.naturalWidth),c=document.createElement('canvas');c.width=w;c.height=h;var x=c.getContext('2d');x.filter='sepia(.55) contrast(1.05)';x.drawImage(i,0,0,w,h);i.src=c.toDataURL('image/jpeg',.82);i.setAttribute('data-baked','1')}catch(e){}})}
function run(){bake();
Object.keys(R).forEach(function(g){var els=[].slice.call(document.querySelectorAll('[data-fit="'+g+'"]'));if(!els.length)return;
for(var s=R[g][0];s>=R[g][1];s-=.5){els.forEach(function(e){e.style.fontSize=s+'px'});if(els.every(ok))break}});
document.querySelectorAll('[data-title]').forEach(function(e){var mh=+e.getAttribute('data-maxh'),s=parseFloat(getComputedStyle(e).fontSize);while(s>18&&(e.offsetHeight>mh||e.scrollWidth>e.clientWidth+1)){s-=1;e.style.fontSize=s+'px'}});
Object.keys(R).forEach(function(g){var els=[].slice.call(document.querySelectorAll('[data-fit="'+g+'"]'));if(!els.length)return;
for(var s=parseFloat(els[0].style.fontSize);s>=R[g][1];s-=.5){els.forEach(function(e){e.style.fontSize=s+'px'});if(els.every(ok))break}});
document.documentElement.setAttribute('data-fitted','1')}
(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(function(){var im=[].slice.call(document.images);return Promise.all(im.map(function(i){return i.complete?0:new Promise(function(r){i.onload=i.onerror=r})}))}).then(run);
})()</script>`;

// 1. Milliy naqsh: atlas chiziqlari, moviy va tilla
function milliy(d) {
  const atlas = "repeating-linear-gradient(90deg,#0f4c81 0 34px,#e9b949 34px 44px,#c8324a 44px 78px,#fff6dd 78px 88px,#1a9c94 88px 122px,#e9b949 122px 132px)";
  const css = `.page{background:#fbf5e6;font-family:Merriweather,serif;color:#23303f}
  .band{position:absolute;left:0;right:0;height:28px;background:${atlas}}.band.t{top:0}.band.b{bottom:0}
  .mast{position:absolute;left:44px;right:44px;top:44px;height:190px;background:#0f4c81;border-radius:0 0 90px 90px;color:#fff;text-align:center;padding:14px 60px 0;border:4px solid #e9b949;border-top:0}
  .mast h1{font:900 74px/1.15 'Playfair Display',serif}.mast .l{font:italic 400 21px Merriweather;color:#ffe29a}.mast .m{font-size:17px;margin-top:5px;color:#dbe7f5}
  .ban{position:absolute;left:130px;right:130px;top:244px;height:50px;background:#c8324a;color:#fff;text-align:center;font:700 19px/50px Merriweather;border-radius:25px;overflow:hidden;white-space:nowrap}
  .g{position:absolute;left:40px;right:40px;top:308px;bottom:44px;display:grid;grid-template-columns:minmax(0,1.75fr) minmax(0,1.15fr);grid-template-rows:minmax(0,1.12fr) minmax(0,1fr);gap:16px}
  .c{background:#fffdf7;border:2px solid #d9b65a;border-radius:14px;padding:16px}
  h2{font:800 34px/1.14 'Playfair Display',serif;color:#0f4c81;margin-bottom:9px}h3{font:800 26px/1.14 'Playfair Display',serif;color:#b1283f;margin-bottom:6px}
  .tx p{line-height:1.46}.ph{border-radius:10px;border:3px solid #e9b949}.cap{font:italic 400 13px Merriweather;color:#6a6252;text-align:center;margin:5px 0 7px}
  .low{display:grid;grid-template-columns:1fr 1fr;gap:16px;min-height:0}.right{display:grid;grid-template-rows:minmax(0,1.15fr) minmax(0,1fr) minmax(0,.8fr);gap:12px;min-height:0}
  .lab{margin:-16px -16px 10px;padding:7px;text-align:center;font:700 19px Merriweather;color:#fff}.f .lab{background:#1a9c94}.po .lab{background:#c8324a}.q .lab{background:#0f4c81}
  li{line-height:1.34}.vs div{font-style:italic;line-height:1.5;text-align:center}`;
  const html = `<div class="band t"></div><div class="mast">${title("h1", d.name, 86)}<div class="l">${esc(d.line)}</div><div class="m">${esc(d.meta)}</div></div><div class="ban" data-title data-maxh="50">${esc(d.banner)}</div>
  <div class="g"><div class="c">${title("h2", d.main.title, 80)}${img(d.main)}${cap(d.main)}${body(d.main, "main")}</div>
  <div class="c">${img(d.side)}${cap(d.side)}<h3>${esc(d.side.title)}</h3>${body(d.side)}</div>
  <div class="low"><div class="c">${img(d.a)}${cap(d.a)}<h3>${esc(d.a.title)}</h3>${body(d.a)}</div><div class="c">${img(d.b)}${cap(d.b)}<h3>${esc(d.b.title)}</h3>${body(d.b)}</div></div>
  <div class="right"><div class="c f"><div class="lab">${esc(d.facts.title)}</div>${list(d.facts.items)}</div><div class="c po"><div class="lab">${esc(d.poem.title)}</div>${verse(d.poem.lines)}</div><div class="c q"><div class="lab">${esc(d.quiz.title)}</div>${list(d.quiz.items, "ol")}</div></div></div><div class="band b"></div>`;
  return [css, html];
}

// 2. Eski gazeta: klassik ustunlar, sepiya rasm, qora chiziqlar
function eski(d) {
  const css = `.page{background:#f3ecdc;font-family:Merriweather,serif;color:#1d1a16;padding:30px 44px;display:flex;flex-direction:column}
  .top{display:flex;justify-content:space-between;border-bottom:1px solid #1d1a16;padding-bottom:6px;font-size:15px;flex:none}
  h1{font:900 100px/1.16 'Playfair Display',serif;text-align:center;flex:none}.rule{border-top:5px double #1d1a16;border-bottom:1px solid #1d1a16;height:9px;flex:none}
  .ban{text-align:center;font:italic 400 19px Merriweather;padding:8px 0;border-bottom:3px solid #1d1a16;flex:none}
  .g{flex:1;min-height:0;display:grid;grid-template-columns:262px 1fr 262px;margin-top:12px;grid-template-rows:minmax(0,1fr)}.col{padding:0 15px;border-right:1px solid #8a8272}.col:last-child{border-right:0;padding-right:0}.col:first-child{padding-left:0}
  h2{font:900 50px/1.08 'Playfair Display',serif;text-align:center;margin-bottom:9px}h3{font:800 25px/1.12 'Playfair Display',serif;margin-bottom:5px;border-top:3px solid #1d1a16;padding-top:6px}
  .tx p{line-height:1.42}.ph img{filter:sepia(.55) contrast(1.05)}.ph img[data-baked]{filter:none}.cap{font:italic 400 12.5px Merriweather;color:#4d463a;margin:4px 0 7px;text-align:center}
  .tx2{column-count:2;column-gap:20px;column-rule:1px solid #8a8272}.stk{display:grid;grid-template-rows:minmax(0,1fr) minmax(0,1fr);gap:12px;min-height:0}
  .foot{flex:none;display:grid;grid-template-columns:1fr 1fr 1fr;border-top:5px double #1d1a16;margin-top:10px;height:258px}.foot>div{padding:9px 15px;border-right:1px solid #8a8272}.foot>div:last-child{border:0}
  .lab{font:700 21px Oswald;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px}li{line-height:1.33}.vs div{font-style:italic;line-height:1.5;text-align:center}`;
  const html = `<div class="top"><span>${esc(d.meta)}</span><span>${esc(d.line)}</span></div>${title("h1", d.name, 120)}<div class="rule"></div><div class="ban" data-title data-maxh="70">${esc(d.banner)}</div>
  <div class="g"><div class="fx col">${img(d.a)}${cap(d.a)}<h3>${esc(d.a.title)}</h3>${body(d.a)}</div>
  <div class="fx col">${title("h2", d.main.title, 118)}${img(d.main)}${cap(d.main)}<div class="tx tx2" data-fit="main">${ps(d.main.text)}</div></div>
  <div class="col stk"><div class="fx">${img(d.side)}${cap(d.side)}<h3>${esc(d.side.title)}</h3>${body(d.side)}</div><div class="fx">${img(d.b)}${cap(d.b)}<h3>${esc(d.b.title)}</h3>${body(d.b)}</div></div></div>
  <div class="foot"><div class="fx"><div class="lab">${esc(d.facts.title)}</div>${list(d.facts.items)}</div><div class="fx"><div class="lab" style="text-align:center">${esc(d.poem.title)}</div>${verse(d.poem.lines)}</div><div class="fx"><div class="lab">${esc(d.quiz.title)}</div>${list(d.quiz.items, "ol")}</div></div>`;
  return [css, html];
}

// 3. Yashil tabiat: yumaloq kartalar, barg shakllari
function tabiat(d) {
  const leaf = (x, y, s, r, c) => `<div style="position:absolute;left:${x}px;top:${y}px;width:${s}px;height:${s}px;background:${c};border-radius:0 80% 0 80%;transform:rotate(${r}deg)"></div>`;
  const css = `.page{background:linear-gradient(#e7f4dc,#f5fbef);font-family:Nunito,sans-serif;color:#22402a}
  .mast{position:absolute;left:0;right:0;top:0;height:266px;background:#2f7d3b;border-radius:0 0 50% 50%/0 0 70px 70px;color:#fff;text-align:center;padding:26px 150px 0;overflow:hidden}
  h1{position:relative;font:900 82px/1.15 'Playfair Display',serif}.l{position:relative;font:800 25px Nunito;color:#d8f5b8}.m{position:relative;font:600 18px Nunito;margin-top:4px}
  .ban{position:absolute;left:150px;right:150px;top:240px;height:54px;background:#f6c343;color:#22402a;border-radius:27px;text-align:center;font:800 20px/54px Nunito;box-shadow:0 5px 14px rgba(0,0,0,.2);overflow:hidden;white-space:nowrap}
  .g{position:absolute;left:34px;right:34px;top:312px;bottom:30px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));grid-template-rows:minmax(0,1.25fr) minmax(0,1fr);gap:16px}
  .c{background:#fff;border-radius:26px;padding:17px;box-shadow:0 5px 16px rgba(47,125,59,.17)}.main{grid-column:span 4}.right{grid-column:span 2;display:grid;grid-template-rows:minmax(0,1.1fr) minmax(0,1fr);gap:16px;min-height:0}.low{grid-column:span 2}.last{display:grid;grid-template-rows:minmax(0,.85fr) minmax(0,1fr);gap:16px;min-height:0;grid-column:span 2}
  h2{font:900 37px/1.1 Nunito;color:#2f7d3b;margin-bottom:9px}h3{font:800 25px/1.14 Nunito;color:#2f7d3b;margin-bottom:5px}.tx p{line-height:1.44}.ph{border-radius:18px}.cap{font:600 13px Nunito;color:#5e7a63;text-align:center;margin:4px 0 6px}
  .lab{align-self:flex-start;padding:5px 18px;border-radius:18px;color:#fff;font:800 19px Nunito;margin-bottom:9px}li{line-height:1.33}.poem{background:#2f7d3b;color:#fff;align-items:center;justify-content:center}.poem .lab{background:#f6c343;color:#22402a;align-self:center}.vs{text-align:center;width:100%}.vs div{line-height:1.45}`;
  const html = `<div class="mast">${leaf(40, 40, 110, 20, "#3f9a4c")}${leaf(980, 30, 120, 70, "#3f9a4c")}${leaf(150, 150, 60, 50, "#58b163")}${leaf(900, 160, 66, 10, "#58b163")}${title("h1", d.name, 96)}<div class="l">${esc(d.line)}</div><div class="m">${esc(d.meta)}</div></div><div class="ban" data-title data-maxh="54">${esc(d.banner)}</div>
  <div class="g"><div class="c main">${title("h2", d.main.title, 84)}${img(d.main)}${cap(d.main)}${body(d.main, "main")}</div>
  <div class="right"><div class="c">${img(d.side)}${cap(d.side)}<h3>${esc(d.side.title)}</h3>${body(d.side)}</div><div class="c"><div class="lab" style="background:#1f8fb3">${esc(d.facts.title)}</div>${list(d.facts.items)}</div></div>
  <div class="c low">${img(d.a)}${cap(d.a)}<h3>${esc(d.a.title)}</h3>${body(d.a)}</div><div class="c low">${img(d.b)}${cap(d.b)}<h3>${esc(d.b.title)}</h3>${body(d.b)}</div>
  <div class="last"><div class="c poem"><div class="lab">${esc(d.poem.title)}</div>${verse(d.poem.lines)}</div><div class="c"><div class="lab" style="background:#e0733a">${esc(d.quiz.title)}</div>${list(d.quiz.items, "ol")}</div></div></div>`;
  return [css, html];
}

// 4. Zamonaviy jurnal: to'la rasmli muqova, qora va to'q sariq
function jurnal(d) {
  const css = `.page{background:#14161f;font-family:Montserrat,sans-serif;color:#fff}
  .hero{position:absolute;left:0;top:0;width:1122px;height:600px;clip-path:polygon(0 0,100% 0,100% 90%,0 100%)}.hero .ph{position:absolute;inset:0;min-height:0}.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(rgba(10,12,20,.25),rgba(10,12,20,.82))}
  .mast{position:absolute;left:44px;top:26px;right:44px;z-index:2}h1{font:700 104px/1.14 Oswald;text-transform:uppercase}.l{display:inline-block;background:#ff8a1f;color:#14161f;font:700 22px Montserrat;padding:5px 15px;margin-top:4px}.m{font:500 18px Montserrat;margin-top:9px}
  .mt{position:absolute;left:44px;width:740px;top:380px;z-index:2}h2{font:900 44px/1.1 Montserrat}.mt .cap{font:500 14px Montserrat;color:#d7d9e2;margin-top:6px}
  .ban{position:absolute;right:0;top:238px;width:310px;background:#ff8a1f;color:#14161f;font:700 21px/1.28 Montserrat;padding:15px 20px 15px 34px;z-index:2;clip-path:polygon(7% 0,100% 0,100% 100%,0 100%)}
  .g{position:absolute;left:34px;right:34px;top:590px;bottom:30px;display:grid;grid-template-columns:1.25fr 1fr 1fr;grid-template-rows:minmax(0,1.08fr) minmax(0,1fr);gap:15px}
  .c{background:#20232f;padding:17px;border-top:6px solid #ff8a1f}.c.w{background:#fff;color:#191b24;border-top-color:#2ec4b6}h3{font:900 25px/1.12 Montserrat;margin:9px 0 6px}.tx p{line-height:1.44;font-weight:500}.lab{font:700 25px Oswald;text-transform:uppercase;color:#ff8a1f;margin-bottom:7px}.w .lab{color:#14161f}li{line-height:1.34;font-weight:500}.vs div{font-weight:700;line-height:1.4;color:#2ec4b6}`;
  const html = `<div class="hero">${img(d.main)}</div><div class="mast">${title("h1", d.name, 124)}<div class="l">${esc(d.line)}</div><div class="m">${esc(d.meta)}</div></div><div class="ban" data-title data-maxh="170">${esc(d.banner)}</div><div class="mt">${title("h2", d.main.title, 100)}<div class="cap">${esc(d.main.cap)}</div></div>
  <div class="g"><div class="c w">${body(d.main, "main")}</div><div class="c">${img(d.side)}<h3>${esc(d.side.title)}</h3>${body(d.side)}</div><div class="c">${img(d.a)}<h3>${esc(d.a.title)}</h3>${body(d.a)}</div>
  <div class="c">${img(d.b)}<h3>${esc(d.b.title)}</h3>${body(d.b)}</div><div class="c w"><div class="lab">${esc(d.facts.title)}</div>${list(d.facts.items)}</div><div class="c"><div class="lab">${esc(d.poem.title)}</div>${verse(d.poem.lines)}<div style="height:12px;flex:none"></div><div class="lab">${esc(d.quiz.title)}</div>${list(d.quiz.items, "ol")}</div></div>`;
  return [css, html];
}

// 5. Daftar varag'i: katak qog'oz, yopishtirilgan rasmlar, qo'lyozma sarlavhalar
function daftar(d) {
  const css = `.page{background-color:#fdfcf6;background-image:linear-gradient(#cfe0f1 1px,transparent 1px),linear-gradient(90deg,#cfe0f1 1px,transparent 1px);background-size:26px 26px;font-family:Nunito,sans-serif;color:#26313f}
  .mg{position:absolute;left:62px;top:0;bottom:0;width:3px;background:#ef7f88}.hd{position:absolute;left:84px;right:350px;top:16px;height:210px}h1{font:700 112px/1.1 Caveat;color:#2a5ea8}.l{font:700 34px/1.1 Caveat;color:#d8485a}.m{font:600 18px Nunito;color:#5a6470;margin-top:3px}
  .ban{position:absolute;right:34px;top:34px;width:290px;background:#ffe36e;padding:15px 16px;font:700 26px/1.12 Caveat;transform:rotate(2.5deg);box-shadow:3px 5px 10px rgba(0,0,0,.2)}
  .pol{background:#fff;padding:9px 9px 5px;box-shadow:2px 5px 12px rgba(0,0,0,.22);position:relative;flex:1 1 0;min-height:0;display:flex;flex-direction:column;margin-top:10px}.tp{position:absolute;left:50%;top:-11px;width:96px;height:24px;margin-left:-48px;background:rgba(255,216,110,.85);transform:rotate(-2deg);z-index:2}.cap{font:700 19px Caveat;text-align:center;color:#3a4552;padding-top:2px}
  .g{position:absolute;left:84px;right:30px;top:232px;bottom:22px;display:grid;grid-template-columns:1.72fr 1fr;grid-template-rows:minmax(0,1.34fr) minmax(0,1fr);gap:20px}
  .fx{padding:0 8px 4px 8px;overflow:hidden}h2{font:700 54px/1.02 Caveat;color:#d8485a}h3{font:700 36px/1 Caveat;color:#2a5ea8;margin:8px 0 2px}.tx{margin-top:8px}.tx p{font-weight:600;line-height:1.42}.low{display:grid;grid-template-columns:1fr 1fr;gap:12px;min-height:0}.right{display:grid;grid-template-rows:minmax(0,1.1fr) minmax(0,.7fr) minmax(0,1fr);gap:13px;min-height:0;padding:4px}
  .st{padding:11px 15px;box-shadow:2px 4px 9px rgba(0,0,0,.17)}.st .lab{font:700 31px/1 Caveat;margin-bottom:5px}.y{background:#fff3a6;transform:rotate(-.7deg)}.pk{background:#ffd3de;transform:rotate(.7deg)}.gr{background:#cdf1dc}li{font-weight:600;line-height:1.3}.vs{font-family:Caveat;font-weight:700;text-align:center}.vs div{line-height:1.12}`;
  const pol = (s) => `<div class="pol"><i class="tp"></i>${img(s)}${cap(s)}</div>`;
  const html = `<div class="mg"></div><div class="hd">${title("h1", d.name, 126)}<div class="l">${esc(d.line)}</div><div class="m">${esc(d.meta)}</div></div><div class="ban" data-title data-maxh="150">${esc(d.banner)}</div>
  <div class="g"><div class="fx">${title("h2", d.main.title, 112)}${pol(d.main)}${body(d.main, "main")}</div><div class="fx">${pol(d.side)}<h3>${esc(d.side.title)}</h3>${body(d.side)}</div>
  <div class="low"><div class="fx">${pol(d.a)}<h3>${esc(d.a.title)}</h3>${body(d.a)}</div><div class="fx">${pol(d.b)}<h3>${esc(d.b.title)}</h3>${body(d.b)}</div></div>
  <div class="right"><div class="c st y"><div class="lab">${esc(d.facts.title)}</div>${list(d.facts.items)}</div><div class="c st pk"><div class="lab">${esc(d.poem.title)}</div>${verse(d.poem.lines)}</div><div class="c st gr"><div class="lab">${esc(d.quiz.title)}</div>${list(d.quiz.items, "ol")}</div></div></div>`;
  return [css, html];
}

// 6. Bayram: qizil va tilla, doira rasmlar, tantanali sarlavha
function bayram(d) {
  const dots = Array.from({ length: 60 }, (_, i) => { const x = (i * 197) % 1122, y = (i * 83) % 310, c = ["#ffd166", "#fff", "#ff9f6e"][i % 3], s = 5 + (i % 4) * 3; return `<b style="position:absolute;left:${x}px;top:${y}px;width:${s}px;height:${s}px;border-radius:${i % 2 ? "50%" : "2px"};background:${c};opacity:.45"></b>`; }).join("");
  const css = `.page{background:#fff7ec;font-family:Merriweather,serif;color:#3b1414}
  .mast{position:absolute;left:0;right:0;top:0;height:316px;background:radial-gradient(circle at 50% 35%,#d7263d,#8c1023);color:#fff;text-align:center;padding:24px 60px 0;overflow:hidden;border-bottom:8px solid #e8b13a}
  h1{position:relative;font:900 90px/1.16 'Playfair Display',serif;color:#ffe08a}.l{position:relative;font:700 25px Montserrat}.m{position:relative;font:500 18px Montserrat;margin-top:5px;color:#ffdcdc}.ban{position:relative;margin-top:12px;font:italic 400 21px Merriweather}
  .g{position:absolute;left:34px;right:34px;top:332px;bottom:26px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:minmax(0,1.02fr) minmax(0,1fr);gap:15px}.c{background:#fff;border:2px solid #e8b13a;padding:15px;border-radius:6px}.main{grid-column:span 2;display:grid;grid-template-columns:320px minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);column-gap:16px;overflow:hidden}
  h2{grid-column:span 2;font:900 40px/1.1 'Playfair Display',serif;color:#a5142a;text-align:center;border-bottom:3px double #e8b13a;padding-bottom:7px;margin-bottom:9px}h3{font:800 25px/1.14 'Playfair Display',serif;color:#a5142a;margin:4px 0 5px;text-align:center}.tx p{line-height:1.44}
  .ph.rd{flex:none;width:286px;height:286px;margin:0 auto;border-radius:50%;border:7px solid #e8b13a}.small{align-items:stretch}.small .ph.rd{width:190px;height:190px;border-width:5px}.big .ph.rd{width:262px;height:262px}.cap{font:italic 400 13px Merriweather;text-align:center;color:#74605a;margin:6px 0}
  .lab{background:#a5142a;color:#ffe08a;margin:-15px -15px 9px;padding:6px;text-align:center;font:700 21px 'Playfair Display',serif}li{line-height:1.33}.poem{background:#a5142a;color:#fff;text-align:center}.poem .lab{background:#e8b13a;color:#3b1414}.vs div{font-style:italic;line-height:1.45}.last{display:grid;grid-template-rows:minmax(0,1.15fr) minmax(0,.85fr);gap:12px;min-height:0}.pb{margin:auto -15px -15px;padding:8px 12px 12px;flex:none}.plab{color:#ffe08a;font:700 21px 'Playfair Display',serif;margin-bottom:4px}`;
  const html = `<div class="mast">${dots}${title("h1", d.name, 108)}<div class="l">${esc(d.line)}</div><div class="m">${esc(d.meta)}</div><div class="ban">${esc(d.banner)}</div></div>
  <div class="g"><div class="c main">${title("h2", d.main.title, 94)}<div class="fx">${img(d.main, "ph rd")}${cap(d.main)}</div>${body(d.main, "main")}</div>
  <div class="c small">${img(d.side, "ph rd")}${cap(d.side)}<h3>${esc(d.side.title)}</h3>${body(d.side)}<div class="poem pb"><div class="plab">${esc(d.poem.title)}</div>${verse(d.poem.lines)}</div></div>
  <div class="c small big">${img(d.a, "ph rd")}${cap(d.a)}<h3>${esc(d.a.title)}</h3>${body(d.a)}</div><div class="c small big">${img(d.b, "ph rd")}${cap(d.b)}<h3>${esc(d.b.title)}</h3>${body(d.b)}</div>
  <div class="last"><div class="c"><div class="lab">${esc(d.facts.title)}</div>${list(d.facts.items)}</div><div class="c"><div class="lab">${esc(d.quiz.title)}</div>${list(d.quiz.items, "ol")}</div></div></div>`;
  return [css, html];
}

const TEMPLATES = { milliy, eski, tabiat, jurnal, daftar, bayram };
function html(id, data) {
  const [css, content] = TEMPLATES[id](data);
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS}"><style>${BASE}${css}@page{margin:0}</style></head><body><div class="page">${content}</div>${FIT}</body></html>`;
}
const IDS = Object.keys(TEMPLATES).map((k) => "gz-" + k);
const htmlById = (id, data) => html(String(id).replace(/^gz-/, ""), data);
module.exports = { TEMPLATES, IDS, html: htmlById };
