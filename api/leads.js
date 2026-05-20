import pg from 'pg';

const db = new pg.Pool({
  connectionString: "postgresql://postgres:eGfCkadCCSDaLOGYwuccpdFmSQENnaCc@autorack.proxy.rlwy.net:49211/railway",
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "GET") {
    try {
      const result = await db.query("SELECT * FROM leads ORDER BY criado_em DESC");
      return res.status(200).json(result.rows);
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "PATCH") {
    const { id, status } = req.body;
    try {
      await db.query("UPDATE leads SET status = $1 WHERE id = $2", [status, id]);
      return res.status(200).json({ ok: true });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(200).json({ ok: true });
}
