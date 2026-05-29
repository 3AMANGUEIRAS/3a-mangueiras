import pg from 'pg';

let db;
function getDb() {
  if (!db) {
    db = new pg.Pool({
      connectionString: "postgresql://postgres:eGfCkadCCSDaLOGYwuccpdFmSQENnaCc@autorack.proxy.rlwy.net:49211/railway",
      ssl: { rejectUnauthorized: false },
      max: 3
    });
  }
  return db;
}

export default async function handler(req, res) {
  const db = getDb();
  await db.query(`DELETE FROM sessions`);
  await db.query(`DELETE FROM leads WHERE nome ILIKE 'anna' OR telefone LIKE '%92984379847%' OR telefone LIKE '%92985094849%'`);
  return res.status(200).json({ ok: true, message: "Dados de teste removidos!" });
}
