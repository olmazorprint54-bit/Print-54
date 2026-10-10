// api/telegram-webhook.js
// ---------------------------------------------------------------
// Barcha botlarning Telegram xabarlari shu yerga keladi:
//   Print 54 (asosiy)   -> /api/telegram-webhook
//   qo'shimcha botlar   -> /api/telegram-webhook?b=<kalit>
// Har bir so'rov haqiqatan Telegram'dan kelganini maxfiy kalit
// (X-Telegram-Bot-Api-Secret-Token) bilan tekshiramiz. Qo'shimcha
// botlarni ulash: env'ga TELEGRAM_BOT_TOKEN_<KALIT> qo'shib, Print 54
// botida egasi /ulash yuboradi. BOT_MODE=ai bo'lgan alohida loyihada
// asosiy bot ham faqat AI bot (chop etishsiz, referalsiz) bo'ladi.
// ---------------------------------------------------------------
const crypto = require("crypto");
const { MAIN, AI_MODE, botKey, orderBot, telegram, sendFile, webhookSecret } = require("./_lib/bots");
const { connectBots, appUrl } = require("./_lib/setup");
const { waitUntil } = require("@vercel/functions");
const { orderIdOf } = require("./_lib/pay");
const { internalKey } = require("./_lib/internal-key");
const { registerReferral, REF_STEP } = require("./_lib/referral");
const SRC = require("./_lib/sources");
const CHAT = require("./_lib/chat");
const { token: botToken } = require("./_lib/bots");
const PR = require("../public/ai/prices");

const supabase = require("./_lib/db");

const SERVICE_LABELS = { paper: "Qog'oz chop etish", book: "Kitob chiqarish", binding: "Pereplyot" };
const LOCATION_URL = "https://maps.google.com/maps?q=41.349872,69.214325&ll=41.349872,69.214325&z=16";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function orderText(o) {
  const label = SERVICE_LABELS[o.service] || o.service;
  const lines = [`🧾 <b>Yangi buyurtma</b> — ${escapeHtml(label)}`];

  if (o.service === "paper") {
    lines.push(`Rang: ${o.color === "bw" ? "Oq-qora" : "Rangli"}`);
    lines.push(`Tur: ${o.side === "single" ? "Bir tomonlama" : "Ikki tomonlama"}`);
    lines.push(`Miqdor: ${o.qty} varaq`);
  } else if (o.service === "book") {
    lines.push(`Format: ${escapeHtml(String(o.format).toUpperCase())}`);
    lines.push(`Rang: ${o.color === "bw" ? "Oq-qora" : "Rangli"}`);
    lines.push(`Sahifalar: ${o.qty} bet`);
  } else if (o.service === "binding") {
    lines.push(`Format: ${escapeHtml(String(o.format).toUpperCase())}`);
    lines.push(`Miqdor: ${o.qty} dona`);
  }

  lines.push(`💰 Jami: ${Number(o.total).toLocaleString("ru-RU")} so'm`);

  const name = escapeHtml(o.telegram_name || "");
  lines.push("");
  lines.push(`👤 Mijoz: ${name}${o.telegram_username ? " (@" + escapeHtml(o.telegram_username) + ")" : ""}`);

  return lines.join("\n");
}

// bot ko'rsatilmasa — Print 54 boti
function callTelegram(method, payload, bot = MAIN) {
  return telegram(bot, method, payload);
}

const isOwner = (from) => from && String(from.id) === String(process.env.OWNER_CHAT_ID);

/* ============ XARID BONUSI (har bir bajarilgan buyurtma uchun) ============ */
async function grantPurchaseBonus(order) {
  if (!order.telegram_user_id) return 0;

  const total = Number(order.total) || 0;
  if (total <= 0) return 0; // to'liq bepul buyurtmaga bonus berilmaydi

  const bonusPages = total > 6000 ? 2 : 1;

  const { data: userRow } = await supabase
    .from("users")
    .select("free_pages")
    .eq("telegram_user_id", order.telegram_user_id)
    .single();

  const newBalance = (userRow ? userRow.free_pages || 0 : 0) + bonusPages;

  await supabase
    .from("users")
    .update({ free_pages: newBalance })
    .eq("telegram_user_id", order.telegram_user_id);

  return bonusPages;
}

/* ============ BUYURTMA TAYYOR TUGMASI ============ */
async function handleCallbackQuery(cq, bot) {
  if (cq.data && cq.data.startsWith("aisend:")) {
    await handleAiSend(cq, bot);
    return;
  }
  if (cq.data === "noop" || isAiBot(bot)) {
    await callTelegram("answerCallbackQuery", { callback_query_id: cq.id }, bot);
    return;
  }
  if (cq.data && cq.data.startsWith("done:")) {
    if (!isOwner(cq.from)) {
      await callTelegram("answerCallbackQuery", { callback_query_id: cq.id, text: "Bu tugma faqat do'kon egasi uchun.", show_alert: true });
      return;
    }
    const orderId = cq.data.split(":")[1];

    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (!error && order && order.status !== "completed") {
      await supabase.from("orders").update({ status: "completed" }).eq("id", orderId);

      const newText = `${orderText(order)}\n\n✅ <b>Buyurtma tayyor</b>`;
      await callTelegram("editMessageText", {
        chat_id: cq.message.chat.id,
        message_id: cq.message.message_id,
        text: newText,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [] },
      });

      if (order.telegram_user_id) {
        const bonusPages = await grantPurchaseBonus(order);
        const label = SERVICE_LABELS[order.service] || order.service;
        const bonusLine = bonusPages > 0
          ? `\n\n🎁 Ushbu buyurtma uchun ${bonusPages} ta bepul list hisobingizga qo'shildi!`
          : "";

        await callTelegram("sendMessage", {
          chat_id: order.telegram_user_id,
          text: `🎉 <b>Buyurtmangiz tayyor!</b>\n\n${label} — ${Number(order.total).toLocaleString("ru-RU")} so'm\n\nDo'konimizdan olib ketishingiz mumkin.${bonusLine}`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: "📍 Manzilni ko'rish", url: LOCATION_URL }]],
          },
        });
      }
    }

    await callTelegram("answerCallbackQuery", {
      callback_query_id: cq.id,
      text: "Bajarildi deb belgilandi ✅",
    });
  }
}

/* ============ REFERAL MUKOFOTLARI ============ */
async function grantReferralReward(referrerId) {
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_user_id", referrerId)
    .single();

  if (!user) return;

  const count = user.referral_count;
  const currentPages = user.free_pages || 0;

  function expectedFreePages(c) {
    if (c < 3) return 0;
    if (c < 5) return 15;
    return 20 + (c - 5) * 3;
  }

  const expected = expectedFreePages(count);
  const addPages = expected - currentPages;

  if (addPages <= 0) return; // yangi bonus yo'q

  let message;
  if (count >= 5) {
    message = !user.reward_5_given
      ? `🎉 Ajoyib! ${count} ta do'stni taklif qildingiz — endi jami ${expected} ta list bepul chiqarishingiz mumkin!\n\nBundan keyingi har bir yangi referal uchun +3 tadan qo'shiladi.`
      : `🎁 Yana bir do'stingiz qo'shildi! Endi jami ${expected} ta list bepul chiqarishingiz mumkin.`;
  } else if (count >= 3) {
    message = `🎉 Tabriklaymiz! ${count} ta do'stni taklif qildingiz — sizga ${expected} ta list bepul chiqarish imkoniyati berildi!\n\nYana ${5 - count} ta referal qo'shsangiz, jami 20 ta bo'ladi.`;
  }

  const updates = { free_pages: expected };
  if (count >= 3) updates.reward_3_given = true;
  if (count >= 5) updates.reward_5_given = true;

  await supabase
    .from("users")
    .update(updates)
    .eq("telegram_user_id", referrerId);

  if (message) {
    await callTelegram("sendMessage", { chat_id: referrerId, text: message });
  }
}

/* ============ OMMAVIY XABAR (faqat do'kon egasi uchun) ============ */
async function handleBroadcast(msg) {
  const ownerId = process.env.OWNER_CHAT_ID;
  if (String(msg.from.id) !== String(ownerId)) return; // faqat egasi ishlata oladi

  const text = msg.text.slice("/elon".length).trim();
  if (!text) {
    await callTelegram("sendMessage", {
      chat_id: msg.chat.id,
      text: "Xabar matnini shu tarzda yozing:\n/elon Ertaga aksiya! 1 list — 200 so'm!",
    });
    return;
  }

  const { data: users, error } = await supabase.from("users").select("telegram_user_id");
  if (error || !users || users.length === 0) {
    await callTelegram("sendMessage", { chat_id: msg.chat.id, text: "Foydalanuvchilar ro'yxatini olishda xatolik yoki ro'yxat bo'sh." });
    return;
  }

  await callTelegram("sendMessage", {
    chat_id: msg.chat.id,
    text: `📤 Yuborish boshlandi... (${users.length} ta foydalanuvchi)`,
  });

  let sent = 0;
  let failed = 0;

  for (const u of users) {
    try {
      const res = await callTelegram("sendMessage", {
        chat_id: u.telegram_user_id,
        text,
      });
      if (res.ok) sent++; else failed++;
    } catch (e) {
      failed++;
    }
    // Telegram limitidan xavfsiz turish uchun har xabar orasida kichik pauza
    await new Promise((r) => setTimeout(r, 40));
  }

  await callTelegram("sendMessage", {
    chat_id: msg.chat.id,
    text: `✅ Yakunlandi!\n\nYuborildi: ${sent} ta\nXato (bloklagan/o'chirilgan va h.k.): ${failed} ta`,
  });
}

/* ============ AI BUYURTMA: EGA TAYYOR FAYLNI YUBORADI ============ */
// Ega buyurtma xabariga javob (reply) qilib fayl yuborsa — fayl
// buyurtmaga biriktiriladi va mijozga bot orqali yuboriladi.
const AI_LABELS = {
  presentation: "Taqdimot",
  essay: "Mustaqil ish",
  referat: "Referat",
  article: "Maqola",
  lesson: "Dars ishlanma",
  test: "Test",
  questions: "Savollar",
  crossword: "Krossvord",
  resume: "Resume / CV",
  obyektivka: "Obyektivka",
};

// Tayyor AI faylini mijozga yetkazadi va buyurtmani "bajarildi" qiladi.
// viaBot — ega faylni qaysi botga yuborgan bo'lsa (file_id o'sha botniki).
// Mijozga fayl buyurtma berilgan bot orqali boradi. true — yetib bordi.
async function deliverAiFile(order, doc, ownerChatId, viaBot) {
  const bot = orderBot(order);
  await supabase
    .from("orders")
    .update({ status: "completed", file_id: doc.file_id, file_name: doc.file_name || null, details: { ...order.details, fileBot: viaBot } })
    .eq("id", order.id);

  const topic = order.details && order.details.topic ? `\n«${escapeHtml(order.details.topic)}»` : "";
  let delivered = false;
  if (order.telegram_user_id) {
    const sent = await sendFile(viaBot, bot, order.telegram_user_id, doc.file_id, doc.file_name, {
      caption: `🎉 <b>Buyurtmangiz tayyor!</b>\n${AI_LABELS[order.service]}${topic}\n\nFaylni istalgan vaqtda "Buyurtmalarim" bo'limidan ham qayta olishingiz mumkin.`,
      parse_mode: "HTML",
    });
    delivered = !!sent.ok;
    if (!sent.ok) console.error("Faylni mijozga yuborib bo'lmadi:", sent.description);
    // fayl boshqa botdan ko'chirilgan bo'lsa — endi buyurtma botining file_id'sini saqlaymiz
    if (sent.ok && viaBot !== bot && sent.result.document) {
      await supabase
        .from("orders")
        .update({ file_id: sent.result.document.file_id, details: { ...order.details, fileBot: bot } })
        .eq("id", order.id);
    }
  }

  if (order.details && order.details.text) {
    await callTelegram("editMessageText", {
      chat_id: ownerChatId,
      message_id: order.telegram_message_id,
      text: `${order.details.text}\n\n✅ <b>Fayl yuborildi</b>`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }, viaBot);
  }
  return delivered;
}

// Avtomatik tayyorlangan faylning "✅ Mijozga yuborish" tugmasi
async function handleAiSend(cq, bot) {
  const answer = (text) => callTelegram("answerCallbackQuery", { callback_query_id: cq.id, text, show_alert: true }, bot);
  if (!isOwner(cq.from)) return answer("Bu tugma faqat do'kon egasi uchun.");
  const doc = cq.message && cq.message.document;
  const orderId = parseInt(cq.data.split(":")[1], 10);
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
  if (!order || !doc) return answer("Buyurtma topilmadi.");
  if (order.status === "cancelled") return answer(`#${order.id} buyurtma mijoz tomonidan bekor qilingan.`);
  if (order.status === "completed") return answer(`#${order.id} allaqachon yuborilgan.`);

  const delivered = await deliverAiFile(order, doc, cq.message.chat.id, bot);
  await callTelegram("editMessageReplyMarkup", {
    chat_id: cq.message.chat.id,
    message_id: cq.message.message_id,
    reply_markup: { inline_keyboard: [[{ text: delivered ? "✅ Mijozga yuborildi" : "⚠️ Saqlandi (mijozga yetmadi)", callback_data: "noop" }]] },
  }, bot);
  return answer(delivered
    ? `✅ #${order.id} — fayl mijozga yuborildi.`
    : `⚠️ #${order.id} — fayl saqlandi, lekin mijozga yuborib bo'lmadi. U "Buyurtmalarim"dan olishi mumkin.`);
}

// Egaga buyurtma xabari qaysi bot orqali borgan (eski buyurtmalarda — buyurtma boti)
const ownerBotOf = (o) => botKey((o.details && o.details.ownerBot) || orderBot(o));

async function handleOwnerFile(msg, bot) {
  const reply = (text) =>
    callTelegram("sendMessage", { chat_id: msg.chat.id, text, reply_to_message_id: msg.message_id }, bot);

  // message_id har bir bot chatida alohida sanaladi — shu botdagi xabarni tanlaymiz
  const { data: rows } = await supabase
    .from("orders")
    .select("*")
    .eq("telegram_message_id", msg.reply_to_message.message_id);
  const order = (rows || []).find((o) => ownerBotOf(o) === bot);

  if (!order || !AI_LABELS[order.service]) {
    await reply("⚠️ Bu xabar AI buyurtmaga tegishli emas. Faylni buyurtma xabariga javob qilib yuboring.");
    return;
  }
  if (order.status === "cancelled") {
    await reply(`⚠️ #${order.id} buyurtma mijoz tomonidan bekor qilingan, fayl yuborilmadi.`);
    return;
  }

  const delivered = await deliverAiFile(order, msg.document, msg.chat.id, bot);

  await reply(
    delivered
      ? `✅ #${order.id} — fayl mijozga yuborildi.`
      : `⚠️ #${order.id} — fayl saqlandi, lekin mijozga yuborib bo'lmadi (botni bloklagan bo'lishi mumkin). U "Buyurtmalarim"dan olishi mumkin.`
  );
}

async function forwardCustomerMedia(msg, bot) {
  const ownerId = process.env.OWNER_CHAT_ID;
  const u = msg.from;
  const name = escapeHtml([u.first_name, u.last_name].filter(Boolean).join(" ") || "Mijoz");
  await callTelegram("sendMessage", {
    chat_id: ownerId,
    text: `📷 <b>Mijoz fayl yubordi</b>\n👤 <a href="tg://user?id=${parseInt(u.id, 10)}">${name}</a>${u.username ? " (@" + escapeHtml(u.username) + ")" : ""}`,
    parse_mode: "HTML",
  }, bot);
  await callTelegram("copyMessage", { chat_id: ownerId, from_chat_id: msg.chat.id, message_id: msg.message_id }, bot);
  await callTelegram("sendMessage", {
    chat_id: msg.chat.id,
    text: isAiBot(bot) ? "✅ Qabul qilindi! Faylingiz yuborildi." : "✅ Qabul qilindi! Faylingiz Print 54 ga yuborildi.",
    reply_to_message_id: msg.message_id,
  }, bot);
}

const appButtonFor = (bot, host) => ({ inline_keyboard: [[{ text: "✨ Ilovani ochish", web_app: { url: appUrl(host, bot) } }]] });

/* ============ MANBALAR (botga yuborilgan adabiyotlar) ============ */
async function saveChatSource(msg, bot) {
  const reply = (text) => callTelegram("sendMessage", { chat_id: msg.chat.id, text, parse_mode: "HTML", reply_to_message_id: msg.message_id }, bot);
  const doc = msg.document;
  const photo = msg.photo && msg.photo[msg.photo.length - 1]; // eng kattasi
  const name = doc ? doc.file_name || "manba" : `Rasm ${new Date().toLocaleDateString("ru-RU")}.jpg`;
  if (doc && !SRC.kindOf(name)) return reply("Bu turdagi faylni manba sifatida qabul qila olmayman. PDF, Word (.docx) yoki TXT yuboring.");
  const size = (doc || photo).file_size || 0;
  if (size > SRC.MAX_BYTES) return reply("Fayl 20 MB dan katta — kichikroq qismini yuboring (masalan, kerakli boblarni).");
  try {
    const f = await callTelegram("getFile", { file_id: (doc || photo).file_id }, bot);
    if (!f.ok) throw new Error(f.description);
    const res = await fetch(`https://api.telegram.org/file/bot${botToken(bot)}/${f.result.file_path}`);
    if (!res.ok) throw new Error("download " + res.status);
    const s = await SRC.saveWhole(msg.from.id, name, Buffer.from(await res.arrayBuffer()), doc ? doc.mime_type : "image/jpeg");
    await reply(`✅ Manba saqlandi: <b>${escapeHtml(s.name)}</b> (~${s.pages} bet)\n\nEndi ilovada buyurtma bering — «📎 Manbalar» bo'limida shu fayl tanlangan bo'ladi. AI ishni shu manba asosida yozadi${PR.TRIAL ? "" : ` (+${PR.SOURCE_FEE.toLocaleString("ru-RU")} so'm)`}.`);
  } catch (e) {
    console.error("Manbani saqlab bo'lmadi:", e);
    await reply(e.user ? e.message : "Faylni saqlab bo'lmadi, birozdan so'ng qayta yuboring.");
  }
}

/* ============ AI BOTLAR (qo'shimcha yoki BOT_MODE=ai) ============ */
// Chop etishsiz bot: Print 54 salomi, referal va "Buyurtma tayyor" yo'q
const isAiBot = (bot) => bot !== MAIN || AI_MODE;

// AI botdagi /start — ilovani ochish tugmasi bilan salomlashish
async function welcomeExtra(msg, bot, host) {
  const name = msg.from.first_name ? `, ${escapeHtml(msg.from.first_name)}` : "";
  await callTelegram("sendMessage", {
    chat_id: msg.chat.id,
    text: `Assalomu alaykum${name}! 👋\n\nBu yerda taqdimot, mustaqil ish, referat, test, resume va obyektivkani bir necha daqiqada tayyorlashingiz mumkin. Resume va obyektivka — <b>tekin</b>.\n\n💬 Savolingizni shu yerga yozing yoki masala rasmini yuboring — AI tushuntirib beradi (kuniga ${CHAT.FREE()} ta bepul). Yangi mavzu: /yangi${AI_MODE ? `\n\n🎁 Do'stlaringizni taklif qiling: har ${REF_STEP} ta do'st uchun 1 ta bepul AI buyurtma — havola «Profil» bo'limida.` : ""}\n\nBoshlash uchun pastdagi tugmani bosing 👇`,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "✨ Ilovani ochish", web_app: { url: appUrl(host, bot) } }]] },
  }, bot);
}

// Egasi /ulash yuboradi: env'dagi botlar shu serverga ulanadi
// (webhook + "Ilova" tugmasi) va natija xabar qilinadi
async function setupBots(msg, host) {
  const list = await connectBots(host);
  if (!list.length) {
    await callTelegram("sendMessage", {
      chat_id: msg.chat.id,
      text: "Qo'shimcha bot topilmadi.\n\nVercel → Settings → Environment Variables bo'limiga bot tokenini TELEGRAM_BOT_TOKEN_AI kabi nom bilan qo'shing, qayta deploy qiling va /ulash ni yana yuboring.",
    });
    return;
  }
  const lines = ["🔌 <b>Botlarni ulash</b>", ""];
  for (const b of list) {
    const at = b.username ? "@" + escapeHtml(b.username) : "<b>" + escapeHtml(b.bot) + "</b>";
    if (!b.ok) {
      lines.push(`❌ ${at} — ${escapeHtml(b.error)}`);
      continue;
    }
    lines.push(`✅ ${at} — ulandi (kalit: <code>${escapeHtml(b.bot)}</code>)`);
    if (!b.ownerStarted) lines.push(`   ⚠️ ${at} ga kirib /start bosing — aks holda buyurtmalar shu botga keladi`);
  }
  await callTelegram("sendMessage", { chat_id: msg.chat.id, text: lines.join("\n"), parse_mode: "HTML" });
}

/* ============ /start VA REFERAL KUZATISH ============ */
async function handleMessage(msg, bot, host) {
  if (!msg.from) return;
  if (msg.document && msg.reply_to_message && isOwner(msg.from)) {
    await handleOwnerFile(msg, bot);
    return;
  }

  // Mijoz rasm yoki fayl yuborsa (masalan, resume uchun rasmi) — egaga yetkazamiz
  // AI botda mijoz yuborgan PDF/Word/TXT/rasm — manba (adabiyot) bo'lib saqlanadi
  if ((msg.photo || msg.document) && isAiBot(bot) && !(isOwner(msg.from) && msg.reply_to_message)) {
    const isImage = msg.photo || /^image\//.test((msg.document && msg.document.mime_type) || "");
    if (isImage) waitUntil(CHAT.reply(msg, bot, { isOwner: isOwner(msg.from), appButton: appButtonFor(bot, host) }).catch((e) => console.error(e)));
    else await saveChatSource(msg, bot);
    return;
  }
  if ((msg.photo || msg.document) && !isOwner(msg.from)) {
    await forwardCustomerMedia(msg, bot);
    return;
  }

  if (!msg.text) return;

  // AI botda oddiy xabar — AI suhbat (javob fonda tayyorlanadi, Telegram kutib qolmaydi)
  if (isAiBot(bot) && !msg.text.startsWith("/") && !(isOwner(msg.from) && msg.reply_to_message)) {
    waitUntil(CHAT.reply(msg, bot, { isOwner: isOwner(msg.from), appButton: appButtonFor(bot, host) }).catch((e) => console.error(e)));
    return;
  }
  if (isAiBot(bot) && /^\/(yangi|new)\b/.test(msg.text)) {
    await CHAT.reset(msg, bot);
    return;
  }

  if (msg.text.startsWith("/ulash") && isOwner(msg.from) && bot === MAIN) {
    await setupBots(msg, host);
    return;
  }

  // Qo'shimcha botlarda faqat salomlashish (referal, e'lon — Print 54 niki)
  if (bot !== MAIN) {
    if (msg.text.startsWith("/start")) await welcomeExtra(msg, bot, host);
    return;
  }

  if (msg.text.startsWith("/elon")) {
    await handleBroadcast(msg);
    return;
  }

  // Alohida AI loyiha: salomlashish + foydalanuvchini e'lonlar uchun eslab qolish
  if (AI_MODE) {
    if (!msg.text.startsWith("/start")) return;
    // referal faqat haqiqiy yangi foydalanuvchi uchun (avval bazada bo'lmagan)
    const { data: known } = await supabase.from("users").select("telegram_user_id").eq("telegram_user_id", msg.from.id).single();
    await supabase.from("users").upsert(
      { telegram_user_id: msg.from.id, username: msg.from.username || null, first_name: msg.from.first_name || null, last_seen: new Date().toISOString() },
      { onConflict: "telegram_user_id" }
    );
    await registerReferral(bot, msg.from, msg.text, !known).catch((e) => console.error(e));
    await welcomeExtra(msg, bot, host);
    return;
  }

  if (!msg.text.startsWith("/start")) return;

  const parts = msg.text.split(" ");
  const referrerId = parts.length > 1 ? parseInt(parts[1], 10) : null;
  const newUserId = msg.from.id;

  // Avval shu foydalanuvchi bazada bor-yo'qligini (ya'ni haqiqatan
  // yangimi yoki avvaldan mijozmi) tekshiramiz
  const { data: existingUser } = await supabase
    .from("users")
    .select("telegram_user_id")
    .eq("telegram_user_id", newUserId)
    .single();

  const isNewUser = !existingUser;

  // Foydalanuvchini users jadvaliga yozib/yangilab qo'yamiz
  await supabase.from("users").upsert(
    {
      telegram_user_id: newUserId,
      username: msg.from.username || null,
      first_name: msg.from.first_name || null,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "telegram_user_id" }
  );

  // Referal FAQAT haqiqiy yangi foydalanuvchi uchun hisoblanadi —
  // avvaldan mijoz bo'lgan odam referal havolasi orqali qayta kirsa,
  // hisobga olinmaydi
  if (isNewUser && referrerId && referrerId !== newUserId) {
    const { error: insertError } = await supabase
      .from("referrals")
      .insert({ referrer_id: referrerId, referred_id: newUserId });

    // insertError bo'lmasa — bu haqiqatan yangi referal (avval qo'shilmagan)
    if (!insertError) {
      const { data: referrer } = await supabase
        .from("users")
        .select("referral_count")
        .eq("telegram_user_id", referrerId)
        .single();

      const newCount = (referrer ? referrer.referral_count : 0) + 1;

      await supabase
        .from("users")
        .update({ referral_count: newCount })
        .eq("telegram_user_id", referrerId);

      // Har bir yangi referalda darhol xabar beramiz (do'stning ismi bilan)
      const referredName = msg.from.first_name || (msg.from.username ? "@" + msg.from.username : "Yangi foydalanuvchi");
      await callTelegram("sendMessage", {
        chat_id: referrerId,
        text: `🎉 ${referredName} sizning referal havolangiz orqali muvaffaqiyatli qo'shildi!\n\nHozirda sizda ${newCount} ta referal bor.`,
      });

      await grantReferralReward(referrerId);
    }
  }

  await callTelegram("sendPhoto", {
    chat_id: msg.chat.id,
    photo: "https://raw.githubusercontent.com/olmazorprint54-bit/Print-54/main/public/assets/start-guide.png",
    caption: "Assalomu alaykum! Print 54 botiga xush kelibsiz 👋\n\nIlova orqali xizmatlarimiz narxini hisoblab, buyurtma berishingiz mumkin — pastdagi \"HISOBLASH\" tugmasini bosing.\n\n⚠️ Hozirda bot test rejimida ishlamoqda va yetkazib berish xizmati hozircha mavjud emas — kamchiliklar bo'lsa, uzr so'raymiz.\n\n🎁 Ko'proq buyurtmalar berish orqali tekinga chop etish imkoniyatingizni oshirib borishingiz mumkin! \n\n🎁  Shuningdek, do'stlaringizni taklif qilib ham qo'shimcha bepul varaqlar qo'lga kiritishingiz mumkin — batafsili \"Buyurtmalarim\" bo'limida.",
  });
}

/* ============ TO'LOV (Click / Payme) ============ */
// To'lovdan oldingi tekshiruv: buyurtma bor, to'lanmagan, summa va mijoz to'g'ri
async function handlePreCheckout(q, bot) {
  const answer = (ok, error) => callTelegram("answerPreCheckoutQuery", { pre_checkout_query_id: q.id, ok, ...(ok ? {} : { error_message: error }) }, bot);
  const id = orderIdOf(q.invoice_payload);
  const { data: order } = id ? await supabase.from("orders").select("*").eq("id", id).single() : { data: null };
  if (!order || orderBot(order) !== bot || !order.details || !order.details.awaitingPayment || order.status !== "active") return answer(false, "Buyurtma topilmadi yoki allaqachon to'langan. Ilovadan qaytadan buyurtma bering.");
  if (String(order.telegram_user_id) !== String(q.from.id)) return answer(false, "Bu buyurtma boshqa foydalanuvchiga tegishli.");
  if (q.currency !== "UZS" || Number(q.total_amount) !== Math.round(Number(order.total) * 100)) return answer(false, "Summa mos kelmadi. Ilovadan qaytadan buyurtma bering.");
  return answer(true);
}

// To'lov o'tdi: buyurtma "to'langan", AI ishga tushadi
async function handlePaid(msg, bot, req) {
  const p = msg.successful_payment;
  const id = orderIdOf(p.invoice_payload);
  const { data: order } = id ? await supabase.from("orders").select("*").eq("id", id).single() : { data: null };
  if (!order) { console.error("To'lov keldi, buyurtma topilmadi:", p.invoice_payload); return; }
  if (!order.details.awaitingPayment) return; // takroriy xabar
  const details = { ...order.details, awaitingPayment: false, payment: { amount: p.total_amount / 100, currency: p.currency, telegram: p.telegram_payment_charge_id, provider: p.provider_payment_charge_id, at: new Date().toISOString() } };
  await supabase.from("orders").update({ details }).eq("id", order.id);
  await callTelegram("sendMessage", { chat_id: msg.chat.id, text: `✅ To'lov qabul qilindi! «${(order.details.topic || AI_LABELS[order.service] || "").slice(0, 100)}» tayyorlanmoqda — bir necha daqiqada fayl shu yerga keladi.` }, bot);
  const proto = req.headers["x-forwarded-proto"] || "https";
  waitUntil(fetch(`${proto}://${req.headers.host}/api/resume-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-key": internalKey(order.id) },
    body: JSON.stringify({ orderId: order.id }),
  }).then((r) => { if (!r.ok) console.error("resume-pdf xatosi:", r.status); }).catch((e) => console.error(e)));
}

/* ============ SO'ROV TELEGRAM'DAN KELGANINI TEKSHIRISH ============ */
function sameSecret(got, expected) {
  const a = Buffer.from(String(got || ""));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Webhook maxfiy kalitsiz o'rnatilgan bo'lsa (masalan, Print 54 ning eski
// sozlamasi) — kalitni o'zimiz qo'shamiz. Telegram rad etilgan xabarni
// birozdan so'ng kalit bilan qayta yuboradi, shuning uchun xabar yo'qolmaydi.
const healedAt = {};
async function healWebhook(bot) {
  if (Date.now() - (healedAt[bot] || 0) < 60 * 1000) return;
  healedAt[bot] = Date.now();
  const info = await callTelegram("getWebhookInfo", {}, bot);
  const url = info.ok && info.result.url;
  if (!url) return;
  const u = new URL(url);
  // faqat shu serverning shu botga tegishli manzili bo'lsa
  if (u.pathname !== "/api/telegram-webhook" || botKey(u.searchParams.get("b")) !== bot) return;
  const out = await callTelegram("setWebhook", {
    url,
    secret_token: webhookSecret(bot),
    // to'lov uchun pre_checkout_query ham kelishi shart
    ...(info.result.allowed_updates && info.result.allowed_updates.length ? { allowed_updates: [...new Set([...info.result.allowed_updates, "pre_checkout_query"])] } : {}),
    ...(info.result.max_connections ? { max_connections: info.result.max_connections } : {}),
  }, bot);
  console.log("Webhook maxfiy kaliti o'rnatildi:", bot, out.ok);
}

const setupPage = require("./_lib/setup-page");

module.exports = async (req, res) => {
  // /api/setup (vercel.json) — botni ulash sahifasi; Telegram faqat POST yuboradi
  if (req.method === "GET") return setupPage(req, res);
  try {
    const raw = req.query && req.query.b;
    const bot = botKey(raw);
    // noma'lum bot (tokeni yo'q) — e'tiborsiz
    if (raw && raw !== MAIN && bot === MAIN) {
      res.status(200).json({ ok: true });
      return;
    }
    if (!sameSecret(req.headers["x-telegram-bot-api-secret-token"], webhookSecret(bot))) {
      await healWebhook(bot).catch((e) => console.error(e));
      res.status(401).json({ ok: false });
      return;
    }

    const update = req.body || {};
    const host = req.headers["x-forwarded-host"] || req.headers.host;

    if (update.pre_checkout_query) {
      await handlePreCheckout(update.pre_checkout_query, bot);
    } else if (update.message && update.message.successful_payment) {
      await handlePaid(update.message, bot, req);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, bot);
    } else if (update.message) {
      await handleMessage(update.message, bot, host);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(200).json({ ok: true });
  }
};
