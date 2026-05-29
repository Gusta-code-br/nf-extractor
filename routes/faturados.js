const express = require('express');
const router = express.Router();
const db = require('../db/index');

// GET /api/faturados?busca=xx&ativo=true
router.get('/', async (req, res) => {
  const { busca, ativo } = req.query;
  let conditions = [];
  let params = [];
  let i = 1;

  if (ativo !== undefined) { conditions.push(`ativo = $${i++}`); params.push(ativo === 'true'); }
  if (busca) {
    conditions.push(`(LOWER(nome_completo) LIKE $${i} OR cpf LIKE $${i})`);
    params.push(`%${busca.toLowerCase()}%`); i++;
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const { rows } = await db.query(
    `SELECT * FROM faturados ${where} ORDER BY nome_completo ASC`, params
  );
  res.json(rows);
});

// GET /api/faturados/:id
router.get('/:id', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM faturados WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
  res.json(rows[0]);
});

// GET /api/faturados/buscar/cpf?valor=xx
router.get('/buscar/cpf', async (req, res) => {
  const { valor } = req.query;
  if (!valor) return res.status(400).json({ error: 'valor é obrigatório' });
  const clean = valor.replace(/\D/g, '');
  const { rows } = await db.query(
    `SELECT * FROM faturados WHERE REGEXP_REPLACE(cpf, '[^0-9]', '', 'g') = $1`,
    [clean]
  );
  res.json(rows[0] || null);
});

// POST /api/faturados
router.post('/', async (req, res) => {
  const { nome_completo, cpf } = req.body;
  if (!nome_completo) return res.status(400).json({ error: 'nome_completo é obrigatório' });
  try {
    const { rows } = await db.query(
      `INSERT INTO faturados (nome_completo, cpf) VALUES ($1,$2) RETURNING *`,
      [nome_completo, cpf || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'CPF já cadastrado' });
    throw e;
  }
});

// PUT /api/faturados/:id
router.put('/:id', async (req, res) => {
  const { nome_completo, cpf } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE faturados SET nome_completo=$1, cpf=$2, atualizado_em=NOW()
       WHERE id=$3 RETURNING *`,
      [nome_completo, cpf || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'CPF já cadastrado' });
    throw e;
  }
});

// PATCH /api/faturados/:id/status
router.patch('/:id/status', async (req, res) => {
  const { ativo } = req.body;
  const { rows } = await db.query(
    `UPDATE faturados SET ativo=$1, atualizado_em=NOW() WHERE id=$2 RETURNING *`,
    [ativo, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
  res.json(rows[0]);
});

module.exports = router;
