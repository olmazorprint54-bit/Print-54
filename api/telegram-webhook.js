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
        const label = SERVICE_LABELS[order.service] || order.service;
        await callTelegram("sendMessage", {
          chat_id: order.telegram_user_id,
          text: `🎉 <b>Buyurtmangiz tayyor!</b>\n\n${label} — ${Number(order.total).toLocaleString("ru-RU")} so'm\n\nDo'konimizdan olib ketishingiz mumkin.`,
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

async function grantReferralReward(referrerId) {
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_user_id", referrerId)
    .single();

  if (!user) return;

  const count = user.referral_count;
  let addPages = 0;
  let message = null;

  if (count === 3 && !user.reward_3_given) {
    addPages = 15;
    await supabase.from("users").update({ reward_3_given: true }).eq("telegram_user_id", referrerId);
    message = `🎉 Tabriklaymiz! Sizda 3 ta referal bor va bizdan 15 ta list tekinga chiqarishingiz mumkin.\n\nYana 2 ta yangi referal qo'shsangiz, jami 20 taga yetadi!`;
  } else if (count === 5 && !user.reward_5_given) {
    addPages = 5;
    await supabase.from("users").update({ reward_5_given: true }).eq("telegram_user_id", referrerId);
    message = `🎉 Ajoyib! 5 ta referalga yetdingiz — endi jami 20 ta list tekinga chiqarishingiz mumkin.\n\nBundan keyingi har bir yangi referal uchun +3 tadan qo'shiladi!`;
  } else if (count > 5) {
    addPages = 3;
    message = `🎉 Yana bir do'stingiz qo'shildi! Endi jami ${user.free_pages + addPages} ta list tekinga chiqarishingiz mumkin.`;
  }

  if (addPages > 0) {
    await supabase
      .from("users")
      .update({ free_pages: user.free_pages + addPages })
      .eq("telegram_user_id", referrerId);
  }

  if (message) {
    await callTelegram("sendMessage", { chat_id: referrerId, text: message });
  }
}

async function handleMessage(msg) {
  if (!msg.text || !msg.text.startsWith("/start")) return;

  const parts = msg.text.split(" ");
  const referrerId = parts.length > 1 ? parseInt(parts[1], 10) : null;
  const newUserId = msg.from.id;

  await supabase.from("users").upsert(
    {
      telegram_user_id: newUserId,
      username: msg.from.username || null,
      first_name: msg.from.first_name || null,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "telegram_user_id" }
  );

  if (referrerId && referrerId !== newUserId) {
    const { error: insertError } = await supabase
      .from("referrals")
      .insert({ referrer_id: referrerId, referred_id: newUserId });

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

      await grantReferralReward(referrerId);
    }
  }

  await callTelegram("sendMessage", {
    chat_id: msg.chat.id,
    text: "Assalomu alaykum! Print 54 botiga xush kelibsiz 👋\n\nMini ilova orqali xizmatlarimiz narxini hisoblab, buyurtma berishingiz mumkin — pastdagi Hisoblash tugmasini bosing.",
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
