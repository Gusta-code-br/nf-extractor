const express = require('express');
const router = express.Router();
const db = require('../db/index');

router.get('/', async (req, res) => {
  const { tipo, busca, ativo } = req.query;
  let conditions = [], params = [], i = 1;
  if (tipo)   { conditions.push(`tipo = $${i++}`); params.push(tipo); }
  if (ativo !== undefined) { conditions.push(`ativo = $${i++}`); params.push(ativo === 'true'); }
  if (busca)  { conditions.push(`LOWER(descricao) LIKE $${i++}`); params.push(`%${busca.toLowerCase()}%`); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const { rows } = await db.query(`SELECT * FROM classificacao ${where} ORDER BY tipo, descricao ASC`, params);
  res.json(rows);
});

router.get('/buscar', async (req, res) => {
  const { descricao, tipo } = req.query;
  if (!descricao) return res.status(400).json({ error: 'descricao é obrigatório' });
  const { rows } = await db.query(
    `SELECT * FROM classificacao WHERE LOWER(descricao)=LOWER($1) AND tipo=$2`,
    [descricao, tipo || 'DESPESA']
  );
  res.json(rows[0] || null);
});

router.post('/', async (req, res) => {
  const { tipo, descricao } = req.body;
  if (!tipo || !descricao) return res.status(400).json({ error: 'tipo e descricao são obrigatórios' });
  try {
    const { rows } = await db.query(
      `INSERT INTO classificacao (tipo, descricao) VALUES ($1,$2) RETURNING *`, [tipo, descricao]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Classificação já existe' });
    throw e;
  }
});

router.put('/:id', async (req, res) => {
  const { descricao } = req.body;
  const { rows } = await db.query(
    `UPDATE classificacao SET descricao=$1, atualizado_em=NOW() WHERE id=$2 RETURNING *`,
    [descricao, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
  res.json(rows[0]);
});

router.patch('/:id/status', async (req, res) => {
  const { ativo } = req.body;
  const { rows } = await db.query(
    `UPDATE classificacao SET ativo=$1, atualizado_em=NOW() WHERE id=$2 RETURNING *`,
    [ativo, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
  res.json(rows[0]);
});

module.exports = router;
