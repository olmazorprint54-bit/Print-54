/* ================================================================
   O'ZBEK LOTIN -> KIRILL (qoidalar asosida, AI'siz)
   Brauzerda: window.uzCyr(matn); serverda: require(".../translit.js")
   Kirillda yozilgan matn o'zgarmaydi.
   ================================================================ */
(function (root) {
  var APOS = "['’ʼ‘`ʻ]";
  var MAP = {
    a: "а", b: "б", d: "д", f: "ф", g: "г", h: "ҳ", i: "и", j: "ж", k: "к", l: "л", m: "м", n: "н", o: "о",
    p: "п", q: "қ", r: "р", s: "с", t: "т", u: "у", v: "в", x: "х", y: "й", z: "з", c: "с", w: "в",
  };
  var VOWEL = /[aeiouаеёиоуэюяўAEIOUАЕЁИОУЭЮЯЎ]/;

  function caseLike(src, out) {
    if (src === src.toUpperCase() && src !== src.toLowerCase()) {
      // "SH" -> "Ш", "Sh" -> "Ш" (bosh harf), "sh" -> "ш"
      return out.toUpperCase();
    }
    if (src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase()) return out[0].toUpperCase() + out.slice(1);
    return out;
  }

  function uzCyr(text) {
    var s = String(text == null ? "" : text);
    var out = "";
    var i = 0;
    while (i < s.length) {
      var rest = s.slice(i);
      var prev = out.slice(-1);
      var m;
      // o' g' (har xil apostroflar bilan)
      if ((m = rest.match(new RegExp("^([oO])" + APOS)))) { out += caseLike(m[1], "ў"); i += 2; continue; }
      if ((m = rest.match(new RegExp("^([gG])" + APOS)))) { out += caseLike(m[1], "ғ"); i += 2; continue; }
      // ikki harfli tovushlar
      if ((m = rest.match(/^(sh|Sh|SH|sH)/))) { out += caseLike(m[1], "ш"); i += 2; continue; }
      if ((m = rest.match(/^(ch|Ch|CH|cH)/))) { out += caseLike(m[1], "ч"); i += 2; continue; }
      if ((m = rest.match(/^(yo|Yo|YO)(?![’'ʼ‘`ʻ])/))) { out += caseLike(m[1], "ё"); i += 2; continue; }
      if ((m = rest.match(/^(yu|Yu|YU)/))) { out += caseLike(m[1], "ю"); i += 2; continue; }
      if ((m = rest.match(/^(ya|Ya|YA)/))) { out += caseLike(m[1], "я"); i += 2; continue; }
      if ((m = rest.match(/^(ye|Ye|YE)/))) { out += caseLike(m[1], "е"); i += 2; continue; }
      var ch = s[i];
      var low = ch.toLowerCase();
      // tutuq belgisi -> ъ (unli yoki undoshdan keyin)
      if (new RegExp("^" + APOS + "$").test(ch) && /[A-Za-zА-Яа-яЎўҚқҒғҲҳ]/.test(prev)) {
        // katta harfli so'z ichida — Ъ
        var next = s[i + 1] || "";
        out += prev === prev.toUpperCase() && next && next === next.toUpperCase() && next !== next.toLowerCase() ? "Ъ" : "ъ";
        i++;
        continue;
      }
      if (low === "e") {
        // so'z boshida yoki unlidan keyin — э
        var start = !/[A-Za-zА-Яа-яЎўҚқҒғҲҳЁё]/.test(prev);
        out += caseLike(ch, start || VOWEL.test(prev) ? "э" : "е");
        i++;
        continue;
      }
      if (MAP[low]) { out += caseLike(ch, MAP[low]); i++; continue; }
      out += ch;
      i++;
    }
    return out;
  }

  if (typeof module !== "undefined" && module.exports) module.exports = uzCyr;
  else root.uzCyr = uzCyr;
})(this);
