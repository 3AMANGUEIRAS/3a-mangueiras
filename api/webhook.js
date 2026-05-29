import pg from 'pg';

const client = new pg.Client({
  connectionString: "postgresql://postgres:eGfCkadCCSDaLOGYwuccpdFmSQENnaCc@autorack.proxy.rlwy.net:49211/railway",
  ssl: { rejectUnauthorized: false }
});

let connected = false;
async function getDb() {
  if (!connected) {
    await client.connect();
    connected = true;
    await client.query(`CREATE TABLE IF NOT EXISTS sessions (phone TEXT PRIMARY KEY, data JSONB)`);
    await client.query(`CREATE TABLE IF NOT EXISTS msg_lock (phone TEXT PRIMARY KEY, ts BIGINT)`);
  }
  return client;
}

const ZAPI_INSTANCE = "3F3DA0B4353961835A5CB6659F1B412D";
const ZAPI_TOKEN = "45FE205CE5E7886DB0CE6981";
const ZAPI_CLIENT_TOKEN = "F75973b5f181e40af802dcac786fbdc4fS";
const VENDEDOR = "5592992859678";
const FINANCEIRO = "559286229361";
const NUMEROS_INTERNOS = [VENDEDOR, FINANCEIRO];

async function isLocked(phone) {
  try {
    const db = await getDb();
    const now = Date.now();
    const r = await db.query(`SELECT ts FROM msg_lock WHERE phone = $1`, [phone]);
    if (r.rows[0] && now - r.rows[0].ts < 3000) return true;
    await db.query(`INSERT INTO msg_lock (phone, ts) VALUES ($1, $2) ON CONFLICT (phone) DO UPDATE SET ts = $2`, [phone, now]);
    return false;
  } catch(e) {
    return false;
  }
}

async function getSession(phone) {
  try {
    const db = await getDb();
    const r = await db.query(`SELECT data FROM sessions WHERE phone = $1`, [phone]);
    return r.rows[0]?.data || { step: "start" };
  } catch(e) {
    return { step: "start" };
  }
}

async function setSession(phone, data) {
  const db = await getDb();
  await db.query(`
    INSERT INTO sessions (phone, data) VALUES ($1, $2)
    ON CONFLICT (phone) DO UPDATE SET data = $2
  `, [phone, JSON.stringify(data)]);
}

async function send(to, msg) {
  const toClean = to.replace(/[^0-9]/g, "");
  await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "client-token": ZAPI_CLIENT_TOKEN
    },
    body: JSON.stringify({ phone: toClean, message: msg })
  });
}

async function buscarCliente(phone) {
  try {
    const db = await getDb();
    const r = await db.query(
      `SELECT * FROM leads WHERE REGEXP_REPLACE(telefone,'[^0-9]','','g') = $1 ORDER BY id DESC LIMIT 1`,
      [phone]
    );
    return r.rows[0] || null;
  } catch(e) {
    return null;
  }
}

const menu = `Olá! 👋 Sou o *Mangueirinha*, assistente virtual da *3A Mangueiras e Fixadores*! 🔧\n\nEscolha uma opção:\n\n1️⃣ Mangueiras\n2️⃣ Fixadores\n3️⃣ Conexões\n4️⃣ Válvulas\n5️⃣ Ferramentas\n6️⃣ EPIs\n7️⃣ Outros produtos\n8️⃣ Financeiro\n9️⃣ Falar com vendedor`;

const menuRetorno = (nome) => `Olá de novo, *${nome}*! 👋\n\nO que deseja?\n\n1️⃣ Ver categorias de produtos\n2️⃣ Falar com vendedor\n3️⃣ Falar com financeiro`;

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

  if (NUMEROS_INTERNOS.some(n => phone.includes(n))) {
    return res.status(200).json({ ok: true });
  }

  // Bloqueia duplicatas por 3 segundos
  if (await isLocked(phone)) return res.status(200).json({ ok: true });

  const session = await getSession(phone);

  if (session.step === "start" || session.step === "menu") {
    const cliente = await buscarCliente(phone);
    if (cliente) {
      await send(phone, menuRetorno(cliente.nome));
      await setSession(phone, { step: "menu_retorno", nome: cliente.nome });
    } else {
      await send(phone, menu);
      await setSession(phone, { step: "aguardando_opcao" });
    }

  } else if (session.step === "menu_retorno") {
    const { nome } = session;
    if (text === "1") {
      await send(phone, `Escolha uma categoria:\n\n1️⃣ Mangueiras\n2️⃣ Fixadores\n3️⃣ Conexões\n4️⃣ Válvulas\n5️⃣ Ferramentas\n6️⃣ EPIs\n7️⃣ Outros produtos\n8️⃣ Financeiro\n9️⃣ Falar com vendedor`);
      await setSession(phone, { step: "aguardando_opcao", nome });
    } else if (text === "2") {
      await send(phone, `✅ Conectando com nosso *vendedor*! Ele entrará em contato em breve. 👍`);
      await send(VENDEDOR, `🔔 *Cliente quer falar com vendedor!*\n\n👤 Nome: ${nome}\n📱 WhatsApp: ${phone}`);
      await setSession(phone, { step: "finalizado", nome });
    } else if (text === "3") {
      await send(phone, `✅ Conectando com nosso *financeiro*! Ele entrará em contato em breve. 👍`);
      await send(FINANCEIRO, `🔔 *Cliente quer falar com financeiro!*\n\n👤 Nome: ${nome}\n📱 WhatsApp: ${phone}`);
      await setSession(phone, { step: "finalizado", nome });
    } else {
      await send(phone, menuRetorno(nome));
    }

  } else if (session.step === "aguardando_opcao") {
    const { nome } = session;
    const opcoes = { "1":"Mangueiras","2":"Fixadores","3":"Conexões","4":"Válvulas","5":"Ferramentas","6":"EPIs","7":"Outros produtos","8":"Financeiro" };
    const cat = opcoes[text];
    if (text === "9") {
      if (nome) {
        await send(phone, `✅ Conectando com nosso *vendedor*! Ele entrará em contato em breve. 👍`);
        await send(VENDEDOR, `🔔 *Cliente quer falar com vendedor!*\n\n👤 Nome: ${nome}\n📱 WhatsApp: ${phone}`);
        await setSession(phone, { step: "finalizado", nome });
      } else {
        await setSession(phone, { step: "nome_vendedor" });
        await send(phone, `Ótimo! Qual é o seu *nome completo*?`);
      }
    } else if (!cat) {
      await send(phone, `Por favor, escolha uma opção de 1 a 9. 😊\n\n${menu}`);
    } else {
      const isF = text === "8";
      await setSession(phone, { step: "nome", cat, dest: isF ? "financeiro" : "vendedor", destino: isF ? FINANCEIRO : VENDEDOR });
      await send(phone, `Você escolheu: *${cat}* ✅\n\nQual é o seu *nome completo*?`);
    }

  } else if (session.step === "nome_vendedor") {
    await setSession(phone, { step: "tel_vendedor", nome: textRaw });
    await send(phone, `Prazer, *${textRaw}*! 😊\n\nQual o seu *WhatsApp* com DDD?`);

  } else if (session.step === "tel_vendedor") {
    const { nome } = session;
    await setSession(phone, { step: "finalizado", nome });
    await send(phone, `✅ Cadastro realizado!\n\nNosso *vendedor* entrará em contato em breve! 👍`);
    await send(VENDEDOR, `🔔 *Novo lead!*\n\n👤 Nome: ${nome}\n📱 WhatsApp: ${textRaw}`);
    try {
      const db = await getDb();
      await db.query(
        `INSERT INTO leads (nome, telefone, interesse, status) VALUES ($1, $2, $3, 'Novo') ON CONFLICT DO NOTHING`,
        [nome, phone, "Falar com vendedor"]
      );
    } catch(e) {
      const db = await getDb();
      await db.query(
        `INSERT INTO leads (nome, telefone, status) VALUES ($1, $2, 'Novo') ON CONFLICT DO NOTHING`,
        [nome, phone]
      );
    }

  } else if (session.step === "nome") {
    await setSession(phone, { ...session, step: "tel", nome: textRaw });
    await send(phone, `Prazer, *${textRaw}*! 😊\n\nQual o seu *WhatsApp* com DDD?`);

  } else if (session.step === "tel") {
    const { nome, cat, destino, dest } = session;
    await setSession(phone, { step: "finalizado", nome });
    try {
      const db = await getDb();
      await db.query(
        `INSERT INTO leads (nome, telefone, interesse, status) VALUES ($1, $2, $3, 'Novo') ON CONFLICT DO NOTHING`,
        [nome, phone, cat]
      );
    } catch(e) {
      const db = await getDb();
      await db.query(
        `INSERT INTO leads (nome, telefone, status) VALUES ($1, $2, 'Novo') ON CONFLICT DO NOTHING`,
        [nome, phone]
      );
    }
    await send(phone, `✅ Cadastro realizado!\n\nNosso *${dest}* entrará em contato em breve! 👍`);
    await send(destino, `🔔 *Novo lead!*\n\n👤 Nome: ${nome}\n📱 WhatsApp: ${textRaw}\n🏷️ Interesse: ${cat}`);

  } else if (session.step === "finalizado") {
    const { nome } = session;
    await setSession(phone, { step: "menu_retorno", nome });
    await send(phone, menuRetorno(nome));
  }

  return res.status(200).json({ ok: true });
}
