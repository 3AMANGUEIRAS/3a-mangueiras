export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).json({ ok: true });

  const body = req.body;
  const phone = body?.data?.key?.remoteJid?.replace("@s.whatsapp.net","").replace("@c.us","");
  const text = (body?.data?.message?.conversation || body?.data?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
  const fromMe = body?.data?.key?.fromMe;

  if (!phone || !text || fromMe) return res.status(200).json({ ok: true });

  const API_URL = "https://evolution-api-production-5b0f.up.railway.app";
  const API_KEY = "c9ef0b4782f6a9c50a6c4d432d38b25c77fabeed2cfc7e73cebe4d52566825db";
  const INSTANCE = "3a-mangueiras";
  const VENDEDOR = "5592992859678";
  const FINANCEIRO = "559286229361";

  async function send(to, msg) {
    await fetch(`${API_URL}/message/sendText/${INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": API_KEY },
      body: JSON.stringify({ number: to, text: msg })
    });
  }

  const menu = `Como posso te ajudar?\n\n1️⃣ Mangueiras e fixadores\n2️⃣ Parafusos\n3️⃣ Elétrica\n4️⃣ Tintas\n5️⃣ Automotivo\n6️⃣ EPI\n7️⃣ Falar com vendedor\n8️⃣ Falar com o financeiro\n\nDigite o número:`;

  const labels = {"1":"Mangueiras e fixadores","2":"Parafusos","3":"Elétrica","4":"Tintas","5":"Automotivo","6":"EPI","7":"Falar com vendedor","8":"Falar com o financeiro"};

  global.sessions = global.sessions || {};
  global.clientes = global.clientes || {};

  const session = global.sessions[phone] || { step: "start" };
  const clienteExistente = global.clientes[phone];

  if (text === "menu") {
    await send(phone, `Olá de novo${clienteExistente ? `, *${clienteExistente.nome}*` : ""}! 😊\n\n${menu}`);
    global.sessions[phone] = { step: "menu" };
    return res.status(200).json({ ok: true });
  }

  if (session.step === "start") {
    if (clienteExistente) {
      await send(phone, `Olá de novo, *${clienteExistente.nome}*! 👋\n\n${menu}`);
      global.sessions[phone] = { step: "menu" };
    } else {
      await send(phone, `Olá! Bem-vindo à *3A Mangueiras e Fixadores* 👋\n\n${menu}`);
      global.sessions[phone] = { step: "menu" };
    }

  } else if (session.step === "menu") {
    if (!labels[text]) {
      await send(phone, `Por favor, digite apenas o *número* da opção desejada:\n\n${menu}`);
    } else {
      const cat = labels[text];
      const isF = text === "8";
      global.sessions[phone] = { step: "nome", cat, destino: isF ? FINANCEIRO : VENDEDOR, dest: isF ? "financeiro" : "vendedor" };

      if (clienteExistente) {
        await send(phone, `Você escolheu: *${cat}*\n\n${clienteExistente.nome}, vou te conectar com nosso *${isF ? "financeiro" : "vendedor"}* agora!`);
        global.sessions[phone] = { step: "start" };
        await send(phone, `✅ Encaminhado!\n\nNosso *${isF ? "financeiro" : "vendedor"}* entrará em contato em breve! 👍\n\nPara voltar ao menu digite *menu*.\n\nObrigado pelo contato com a *3A Mangueiras e Fixadores*! 🙏`);
        await send(isF ? FINANCEIRO : VENDEDOR, `🔔 *Novo contato!*\n\n👤 Nome: ${clienteExistente.nome}\n📱 WhatsApp: ${clienteExistente.tel}\n🏷️ Interesse: ${cat}`);
      } else {
        await send(phone, `Você escolheu: *${cat}*\n\nQual é o seu *nome*?`);
      }
    }

  } else if (session.step === "nome") {
    global.sessions[phone] = { ...session, step: "tel", nome: text };
    await send(phone, `Prazer, *${text}*! 😊\n\nSeu *WhatsApp* com DDD:`);

  } else if (session.step === "tel") {
    const { nome, cat, destino, dest } = session;
    global.clientes[phone] = { nome, tel: text };
    global.sessions[phone] = { step: "start" };

    await send(phone, `✅ *Cadastro realizado com sucesso!*\n\nNosso *${dest}* entrará em contato em breve! 👍\n\nPara voltar ao menu a qualquer momento, digite *menu*.\n\nObrigado pelo contato com a *3A Mangueiras e Fixadores*! 🙏`);
    await send(destino, `🔔 *Novo lead!*\n\n👤 Nome: ${nome}\n📱 WhatsApp: ${text}\n🏷️ Interesse: ${cat}`);
  }

  return res.status(200).json({ ok: true });
}
