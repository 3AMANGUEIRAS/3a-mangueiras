import pg from 'pg';

const db = new pg.Pool({
  connectionString: "postgresql://postgres:eGfCkadCCSDaLOGYwuccpdFmSQENnaCc@autorack.proxy.rlwy.net:49211/railway",
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).json({ ok: true });

  const body = req.body;

  const phone = (body?.phone || body?.from || "").replace(/[^0-9]/g, "");
  const textRaw = (body?.text?.message || body?.message || body?.body || "").trim();
  const text = textRaw.toLowerCase();
  const fromMe = body?.fromMe || false;

  if (!phone || !textRaw || fromMe) return res.status(200).json({ ok: true });

  const msgTimestamp = body?.momment || body?.timestamp;
  if (msgTimestamp) {
    const agora = Math.floor(Date.now() / 1000);
    const ts = msgTimestamp > 1e12 ? Math.floor(msgTimestamp / 1000) : msgTimestamp;
    if (agora - ts > 30) return res.status(200).json({ ok: true });
  }

  const ZAPI_INSTANCE = "3F3DA0B4353961835A5CB6659F1B412D";
  const ZAPI_TOKEN = "45FE205CE5E7886DB0CE6981";
  const VENDEDOR = "5592992859678";
  const FINANCEIRO = "559286229361";
  const NUMEROS_INTERNOS = [VENDEDOR, FINANCEIRO];

  if (NUMEROS_INTERNOS.some(n => phone.includes(n))) {
    return res.status(200).json({ ok: true });
  }

  async function send(to, msg) {
    const toClean = to.replace(/[^0-9]/g, "");
    await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: toClean, message: msg })
    });
  }

  async function buscarCliente() {
    const r = await db.query(
      `SELECT * FROM leads WHERE REGEXP_REPLACE(telefone,'[^0-9]','','g') = $1 ORDER BY id DESC LIMIT 1`,
      [phone]
    );
    return r.rows[0] || null;
  }

  const menu = `Olá! 👋 Sou o *Mangueirinha*, assistente virtual da *3A Mangueiras e Fixadores*! 🔧\n\nEscolha uma categoria:\n\n1️⃣ Mangueiras\n2️⃣ Fixadores\n3️⃣ Conexões\n4️⃣ Válvulas\n5️⃣ Ferramentas\n6️⃣ EPIs\n7️⃣ Outros produtos\n8️⃣ Financeiro`;

  if (!global.sessions) global.sessions = {};
  let session = global.sessions[phone] || { step: "start" };

  if (session.step === "start" || session.step === "menu") {
    const cliente = await buscarCliente();
    if (cliente) {
      await send(phone, `Olá de novo, *${cliente.nome}*! 👋\n\n${menu}`);
    } else {
      await send(phone, menu);
    }
    global.sessions[phone] = { step: "aguardando_opcao" };

  } else if (session.step === "aguardando_opcao") {
    const opcoes = { "1":"Mangueiras","2":"Fixadores","3":"Conexões","4":"Válvulas","5":"Ferramentas","6":"EPIs","7":"Outros produtos","8":"Financeiro" };
    const cat = opcoes[text];
    if (!cat) {
      await send(phone, `Por favor, escolha uma opção de 1 a 8. 😊\n\n${menu}`);
    } else {
      const isF = text === "8";
      global.sessions[phone] = { ...session, step: "nome", cat, dest: isF ? "financeiro" : "vendedor", destino: isF ? FINANCEIRO : VENDEDOR };
      await send(phone, `Você escolheu: *${cat}* ✅\n\nQual é o seu *nome completo*?`);
    }

  } else if (session.step === "nome") {
    global.sessions[phone] = { ...session, step: "tel", nome: textRaw };
    await send(phone, `Prazer, *${textRaw}*! 😊\n\nQual o seu *WhatsApp* com DDD?`);

  } else if (session.step === "tel") {
    const { nome, cat, destino, dest } = session;
    global.sessions[phone] = { step: "finalizado" };

    await db.query(
      `INSERT INTO leads (nome, telefone, categoria, status) VALUES ($1, $2, $3, 'Novo') ON CONFLICT DO NOTHING`,
      [nome, phone, cat]
    );

    await send(phone, `✅ Cadastro realizado!\n\nNosso *${dest}* entrará em contato em breve! 👍`);
    await send(destino, `🔔 *Novo lead!*\n\n👤 Nome: ${nome}\n📱 WhatsApp: ${textRaw}\n🏷️ Interesse: ${cat}`);

  } else if (session.step === "finalizado") {
    global.sessions[phone] = { step: "aguardando_opcao" };
    const cliente = await buscarCliente();
    await send(phone, `Olá de novo, *${cliente?.nome || ""}*! 👋\n\n${menu}`);
  }

  return res.status(200).json({ ok: true });
}
