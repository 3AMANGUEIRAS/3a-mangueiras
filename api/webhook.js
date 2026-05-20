const INSTANCE_ID = "3F36A3EA4AEF835C07DD8E55E4F73592";
const TOKEN = "14521E5CC8C5FEAD2A5573CC";
const VENDEDOR = "5592992859678";
const FINANCEIRO = "559286229361";

const sessions = {};

async function sendMessage(phone, message) {
  const url = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${TOKEN}/send-text`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": TOKEN
    },
    body: JSON.stringify({ phone, message })
  });
  return response.json();
}

async function sendMenu(phone) {
  const menu = `Olá! Seja bem-vindo à *3A Mangueiras e Fixadores* 👋\n\nComo posso te ajudar?\n\n1️⃣ Mangueiras e fixadores\n2️⃣ Parafusos\n3️⃣ Elétrica\n4️⃣ Tintas\n5️⃣ Automotivo\n6️⃣ EPI\n7️⃣ Falar com vendedor\n8️⃣ Falar com o financeiro\n\nDigite o número da opção:`;
  await sendMessage(phone, menu);
  sessions[phone] = { step: "menu" };
}

const menuLabels = {
  "1": "Mangueiras e fixadores",
  "2": "Parafusos",
  "3": "Elétrica",
  "4": "Tintas",
  "5": "Automotivo",
  "6": "EPI",
  "7": "Falar com vendedor",
  "8": "Falar com o financeiro"
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).json({ ok: true });

  const body = req.body;
  const phone = body?.phone || body?.from;
  const text = (body?.text?.message || body?.message || "").trim();

  if (!phone || !text) return res.status(200).json({ ok: true });
  if (body?.fromMe) return res.status(200).json({ ok: true });

  const session = sessions[phone] || { step: "start" };

  if (session.step === "start" || session.step === "menu") {
    if (!menuLabels[text]) {
      await sendMenu(phone);
      return res.status(200).json({ ok: true });
    }
    const categoria = menuLabels[text];
    const isFinanceiro = text === "8";
    const destino = isFinanceiro ? FINANCEIRO : VENDEDOR;
    const destLabel = isFinanceiro ? "financeiro" : "vendedor";
    sessions[phone] = { step: "nome", categoria, destino, destLabel };
    await sendMessage(phone, `Ótimo! Você escolheu: *${categoria}*\n\nQual é o seu *nome*?`);

  } else if (session.step === "nome") {
    sessions[phone] = { ...session, step: "telefone", nome: text };
    await sendMessage(phone, `Prazer, *${text.split(" ")[0]}*! 😊\n\nAgora me informe seu *WhatsApp* com DDD:`);

  } else if (session.step === "telefone") {
    const { nome, categoria, destino, destLabel } = session;
    sessions[phone] = { step: "start" };
    await sendMessage(phone, `✅ Perfeito! Conectando com nosso *${destLabel}*...`);
    const msgDestino = `🔔 *Novo lead!*\n\n👤 Nome: ${nome}\n📱 WhatsApp: ${text}\n🏷️ Interesse: ${categoria}`;
    await sendMessage(destino, msgDestino);
    await sendMessage(phone, `Pronto! Nosso ${destLabel} entrará em contato em breve! 👍\n\nDigite *menu* para voltar ao início.`);
    sessions[phone] = { step: "start" };
  } else {
    await sendMenu(phone);
  }

  return res.status(200).json({ ok: true });
}
