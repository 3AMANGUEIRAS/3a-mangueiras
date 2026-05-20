export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).json({ ok: true });

  const body = req.body;
  
  const phone = body?.phone || body?.from || body?.sender || body?.chatId?.replace("@c.us","");
  const text = (body?.text?.message || body?.text || body?.message || body?.body || "").trim().toLowerCase();

  if (!phone || !text) return res.status(200).json({ ok: true });
  if (body?.fromMe || body?.isGroup) return res.status(200).json({ ok: true });

  const INSTANCE_ID = "3F36A3EA4AEF835C07DD8E55E4F73592";
  const TOKEN = "14521E5CC8C5FEAD2A5573CC";
  const VENDEDOR = "5592992859678";
  const FINANCEIRO = "559286229361";

  async function send(to, msg) {
    await fetch(`https://api.z-api.io/instances/${INSTANCE_ID}/token/${TOKEN}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": TOKEN },
      body: JSON.stringify({ phone: to, message: msg })
    });
  }

  const menu = `Olá! Bem-vindo à *3A Mangueiras e Fixadores* 👋\n\nComo posso te ajudar?\n\n1️⃣ Mangueiras e fixadores\n2️⃣ Parafusos\n3️⃣ Elétrica\n4️⃣ Tintas\n5️⃣ Automotivo\n6️⃣ EPI\n7️⃣ Falar com vendedor\n8️⃣ Falar com o financeiro\n\nDigite o número:`;

  const labels = {"1":"Mangueiras e fixadores","2":"Parafusos","3":"Elétrica","4":"Tintas","5":"Automotivo","6":"EPI","7":"Falar com vendedor","8":"Falar com o financeiro"};

  global.sessions = global.sessions || {};
  const session = global.sessions[phone] || { step: "start" };

  if (session.step === "start" || session.step === "menu" || !labels[text] && session.step === "menu") {
    if (!labels[text]) {
      await send(phone, menu);
      global.sessions[phone] = { step: "menu" };
    } else {
      const cat = labels[text];
      const isF = text === "8";
      global.sessions[phone] = { step: "nome", cat, destino: isF ? FINANCEIRO : VENDEDOR, dest: isF ? "financeiro" : "vendedor" };
      await send(phone, `Você escolheu: *${cat}*\n\nQual é o seu *nome*?`);
    }
  } else if (session.step === "nome") {
    global.sessions[phone] = { ...session, step: "tel", nome: text };
    await send(phone, `Prazer, *${text}*! 😊\n\nSeu *WhatsApp* com DDD:`);
  } else if (session.step === "tel") {
    const { nome, cat, destino, dest } = session;
    global.sessions[phone] = { step: "start" };
    await send(phone, `✅ Cadastro realizado!\n\nNosso *${dest}* entrará em contato em breve! 👍`);
    await send(destino, `🔔 *Novo lead!*\n\n👤 Nome: ${nome}\n📱 WhatsApp: ${text}\n🏷️ Interesse: ${cat}`);
  } else {
    await send(phone, menu);
    global.sessions[phone] = { step: "menu" };
  }

  return res.status(200).json({ ok: true });
}
