import pg from 'pg';

const db = new pg.Pool({
  connectionString: "postgresql://postgres:eGfCkadCCSDaLOGYwuccpdFmSQENnaCc@autorack.proxy.rlwy.net:49211/railway",
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  await db.query(`DELETE FROM sessions`);
  return res.status(200).json({ ok: true, message: "Sessões limpas!" });
}
