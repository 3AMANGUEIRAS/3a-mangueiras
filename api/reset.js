import pg from 'pg';

const client = new pg.Client({
  connectionString: "postgresql://postgres:eGfCkadCCSDaLOGYwuccpdFmSQENnaCc@autorack.proxy.rlwy.net:49211/railway",
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  await client.connect();
  await client.query(`DELETE FROM sessions`);
  await client.query(`DELETE FROM leads WHERE nome ILIKE 'anna' OR nome ILIKE 'oi' OR telefone LIKE '%92984379847%' OR telefone LIKE '%92985094849%'`);
  await client.end();
  return res.status(200).json({ ok: true, message: "Dados de teste removidos!" });
}
