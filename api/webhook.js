import pg from 'pg';

const db = new pg.Pool({
  connectionString: "postgresql://postgres:eGfCkadCCSDaLOGYwuccpdFmSQENnaCc@autorack.proxy.rlwy.net:49211/railway",
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).json({ ok: true });

  const body = req.body;
  const phone = body?.data?.key?.remoteJid?.replace("@s.whatsapp.net","").replace("@c.us","");
  const textRaw = (body?.data?.message?.conversation || body?.data?.message?.extendedTextMessage?.text || "").trim();
  const text = textRaw.toLowerCase();
  const fromMe = body?.data?.key?.fromMe;

  if (!phone || !textRaw || fromMe) return res.status(200).json({ ok: true });

  // ignora mensagens antigas (mais de 30 segundos)
  const msgTimestamp = body?.data?.messageTimestamp;
  if (msgTimestamp) {
    const agora = Math.floor(Date.now() / 1000);
    if (agora - msgTimestamp > 30) return res.status(200).json({ ok: true });
  }

  const API_URL = "https://evolution-api-production-5b0f.up.railway.app";
  const API_KEY = "c9ef0b4782f6a9c50a6c4d432d38b25c77fabeed2cfc7e73cebe4d52566825db";
  const INSTANCE = "3a-mangueiras";
  const VENDEDOR = "5592992859678";
  const FINANCEIRO = "559286229361";

  // ignora números internos
  const phoneNorm = phone.replace(/\D/g, '').replace(/^55/, '');
  const numerosInternos = [VENDEDOR, FINANCEIRO].map(n => n.replace(/\D/g, '').replace(/^55/, ''));
  if (numerosInternos.includes(phoneNorm)) return res.status(200).json({ ok: true });

  async function send(to, msg) {
    await fetch(`${API_URL}/message/sendText/${INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": API_KEY },
      body: JSON.stringify({ number: to, text: msg })
    });
  }

  const menu = `Como posso te ajudar?\n\n1️⃣ Mangueiras e fixadores\n2️⃣ Parafusos\n3️⃣ Elétrica\n4️⃣ Tintas\n5️⃣ Automotivo\n6️⃣ EPI\n7️⃣ Falar com vendedor\n8️⃣ Falar com o financeiro\n\nDigite o número:`;
  const origemMenu = `Por onde você nos encontrou?\n\n1️⃣ Google\n2️⃣ Facebook\n3️⃣ Instagram\n4️⃣ Site\n5️⃣ Indicação\n\nDigite o número:`;
  const origemLabels = {"1":"Google","2":"Facebook","3":"Instagram","4":"Site","5":"Indicação"};
  const labels = {"1":"Mangueiras e fixadores","2":"Parafusos","3":"Elétrica","4":"Tintas","5":"Automotivo","6":"EPI","7":"Falar com vendedor","8":"Falar com o financeiro"};

  async function getSession() {
    try {
      const r = await db.query(`SELECT * FROM sessions WHERE phone = $1`, [phone]);
      if (r.rows[0]) {
        const { step } = r.rows[0];
        const data = r.rows[0].data || {};
        return { ...data, step };
      }
      return { step: "start" };
    } catch(e) {
      console.error("Erro getSession:", e.message);
      return { step: "start" };
    }
  }

  async function setSession(step, data = {}) {
    try {
      await db.query(
        `INSERT INTO sessions (phone, step, data, atualizado_em) VALUES ($1, $2, $3, NOW())
         ON CONFLICT (phone) DO UPDATE SET step = $2, data = $3, atualizado_em = NOW()`,
        [phone, step, JSON.stringify(data)]
      );
    } catch(e) {
      console.error("Erro setSession:", e.message);
    }
  }

  async function buscarCliente() {
    try {
      const phoneDigits = phone.replace(/\D/g, "");
      const phoneSem55 = phoneDigits.replace(/^55/, "");
      const phoneCom55 = "55" + phoneSem55;
      const r = await db.query(
        `SELECT * FROM leads WHERE 
          REGEXP_REPLACE(telefone, '[^0-9]', '', 'g') = $1 OR
          REGEXP_REPLACE(telefone, '[^0-9]', '', 'g') = $2 OR
          REGEXP_REPLACE(telefone, '[^0-9]', '', 'g') = $3
        ORDER BY criado_em DESC LIMIT 1`,
        [phoneDigits, phoneSem55, phoneCom55]
      );
      return r.rows[0] || null;
    } catch(e) {
      console.error("Erro buscarCliente:", e.message);
      return null;
    }
  }

  const session = await getSession();

  if (text === "menu") {
    const cliente = await buscarCliente();
    await send(phone, `Olá de novo${cliente ? `, *${cliente.nome}*` : ""}! Sou o *Mangueirinha* 😊\n\n${menu}`);
    await setSession("menu");
    return res.status(200).json({ ok: true });
  }

  if (session.step === "start") {
    const cliente = await buscarCliente();
    if (cliente) {
      await setSession("menu");
      await send(phone, `Olá de novo, *${cliente.nome}*! 👋\nSou o *Mangueirinha*, assistente virtual da 3A Mangueiras!\n\n${menu}`);
    } else {
      await setSession("menu");
      await send(phone, `Olá! Bem-vindo à *3A Mangueiras e Fixadores* 👋\nSou o *Mangueirinha*, assistente virtual da loja! 🤖\n\n${menu}`);
    }

  } else if (session.step === "finalizado") {
    const cliente = await buscarCliente();
    await setSession("menu");
    if (cliente) {
      await send(phone, `Olá de novo, *${cliente.nome}*! 👋\nSou o *Mangueirinha*, assistente virtual da 3A Mangueiras!\n\n${menu}`);
    } else {
      await send(phone, `Olá! Como posso te ajudar? 😊\n\n${menu}`);
    }

  } else if (session.step === "menu") {
    if (!labels[text]) {
      const cliente = await buscarCliente();
      if (cliente) {
        await send(phone, `Olá de novo, *${cliente.nome}*! 👋\nSou o *Mangueirinha*, assistente virtual da 3A Mangueiras!\n\n${menu}`);
      } else {
        await send(phone, `Por favor, digite apenas o *número* da opção desejada:\n\n${menu}`);
      }
    } else {
      const cat = labels[text];
      const isF = text === "8";
      const dest = isF ? "financeiro" : "vendedor";
      const destino = isF ? FINANCEIRO : VENDEDOR;

      const cliente = await buscarCliente();
      if (cliente) {
        await setSession("finalizado");
        await send(phone, `Você escolheu: *${cat}*\n\nVou te conectar com nosso *${dest}* agora! ⏳`);
        await send(destino, `🔔 *Novo contato!*\n\n👤 Nome: ${cliente.nome}\n📱 WhatsApp: ${cliente.telefone}\n🏷️ Interesse: ${cat}`);
        await send(phone, `✅ *Pronto!*\n\nNosso *${dest}* entrará em contato em breve! 👍\n\nPara voltar ao menu digite *menu*.\n\nObrigado pelo contato com a *3A Mangueiras e Fixadores*! 🙏`);
      } else {
        await setSession("nome", { cat, destino, dest });
        await send(phone, `Você escolheu: *${cat}*\n\nQual é o seu *nome completo*?`);
      }
    }

  } else if (session.step === "nome") {
    await setSession("origem", { ...session, nome: textRaw });
    await send(phone, `Prazer, *${textRaw}*! 😊\n\n${origemMenu}`);

  } else if (session.step === "origem") {
    if (!origemLabels[text]) {
      await send(phone, `Por favor, digite apenas o *número* da opção desejada:\n\n${origemMenu}`);
    } else {
      const origem = origemLabels[text];
      const { nome, cat, destino, dest } = session;
      const telNorm = phone.replace(/\D/g, '').replace(/^55/, '');
      await setSession("finalizado");

      try {
        await db.query(
          `INSERT INTO leads (nome, telefone, interesse, origem, data, hora) VALUES ($1, $2, $3, $4, $5, $6)`,
          [nome, telNorm, cat, origem, new Date().toLocaleDateString("pt-BR"), new Date().toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"})]
        );
      } catch(e) { console.error("Erro ao salvar lead:", e.message); }

      await send(phone, `✅ *Cadastro realizado com sucesso!*\n\nNosso *${dest}* entrará em contato em breve! 👍\n\nPara voltar ao menu a qualquer momento, digite *menu*.\n\nObrigado pelo contato com a *3A Mangueiras e Fixadores*! 🙏`);
      await send(destino, `🔔 *Novo lead!*\n\n👤 Nome: ${nome}\n📱 WhatsApp: ${telNorm}\n🏷️ Interesse: ${cat}\n📣 Origem: ${origem}`);
    }
  }

  return res.status(200).json({ ok: true });
}
