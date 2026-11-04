// Qo'shimcha tillar (o'zbek/rus/ingliz'dan tashqari): AI shu tilda yozadi; hujjat yorliqlari
// (Kirish, Mundarija ...) uchun alohida tarjima yo'q — inglizcha yorliqlar ishlatiladi (fallback)
const EXTRA = {
  kk: ["Kazakh", "kk-KZ"], ky: ["Kyrgyz", "ky-KG"], tg: ["Tajik", "tg-TJ"], tk: ["Turkmen", "tk-TM"],
  tr: ["Turkish", "tr-TR"], az: ["Azerbaijani", "az-Latn-AZ"], fr: ["French", "fr-FR"], es: ["Spanish", "es-ES"],
  de: ["German", "de-DE"], it: ["Italian", "it-IT"], pt: ["Portuguese", "pt-PT"], ar: ["Arabic", "ar-SA"],
  fa: ["Persian", "fa-IR"], zh: ["Chinese (Simplified)", "zh-CN"], ja: ["Japanese", "ja-JP"], ko: ["Korean", "ko-KR"],
  hi: ["Hindi", "hi-IN"], uk: ["Ukrainian", "uk-UA"],
};
const EXTRA_NAMES = Object.fromEntries(Object.entries(EXTRA).map(([k, v]) => [k, v[0]]));
const EXTRA_TAGS = Object.fromEntries(Object.entries(EXTRA).map(([k, v]) => [k, v[1]]));
// lug'atga qo'shimcha tillar uchun inglizcha (yoki berilgan) yozuvni qo'shadi
function withFallback(dict, from = "en") {
  for (const k of Object.keys(EXTRA)) if (!(k in dict)) dict[k] = dict[from];
  return dict;
}
module.exports = { EXTRA_NAMES, EXTRA_TAGS, withFallback };
