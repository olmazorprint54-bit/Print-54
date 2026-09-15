// api/telegram-webhook.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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

async function callTelegram(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

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
async function handleCallbackQuery(cq) {
  if (cq.data && cq.data.startsWith("done:")) {
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

/* ============ /start VA REFERAL KUZATISH ============ */
async function handleMessage(msg) {
  if (!msg.text || !msg.text.startsWith("/start")) return;

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
    caption: "Assalomu alaykum! Print 54 botiga xush kelibsiz 👋\n\nMini ilova orqali xizmatlarimiz narxini hisoblab, buyurtma berishingiz mumkin — pastdagi \"Hisoblash\" tugmasini bosing (rasmda ko'rsatilganidek).",
  });
}

module.exports = async (req, res) => {
  try {
    const update = req.body || {};

    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    } else if (update.message) {
      await handleMessage(update.message);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(200).json({ ok: true });
  }
};
