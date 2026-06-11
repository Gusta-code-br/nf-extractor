const express = require('express');
const router = express.Router();
const db = require('../db/index');

// GET /api/clientes?busca=xx&ativo=true
router.get('/', async (req, res) => {
  const { busca, ativo } = req.query;
  let conditions = [];
  let params = [];
  let i = 1;

  if (ativo !== undefined) { conditions.push(`ativo = $${i++}`); params.push(ativo === 'true'); }
  if (busca) {
    conditions.push(`(LOWER(razao_social) LIKE $${i} OR LOWER(fantasia) LIKE $${i} OR cnpj LIKE $${i})`);
    params.push(`%${busca.toLowerCase()}%`); i++;
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const { rows } = await db.query(
    `SELECT * FROM clientes ${where} ORDER BY razao_social ASC`, params
  );
  res.json(rows);
});

// GET /api/clientes/:id
router.get('/:id', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM clientes WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
  res.json(rows[0]);
});

// GET /api/clientes/buscar/cnpj?valor=xx
router.get('/buscar/cnpj', async (req, res) => {
  const { valor } = req.query;
  if (!valor) return res.status(400).json({ error: 'valor é obrigatório' });
  const clean = valor.replace(/\D/g, '');
  const { rows } = await db.query(
    `SELECT * FROM clientes WHERE REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g') = $1`,
    [clean]
  );
  res.json(rows[0] || null);
});

// POST /api/clientes
router.post('/', async (req, res) => {
  const { razao_social, cnpj, fantasia } = req.body;
  if (!razao_social) return res.status(400).json({ error: 'razao_social é obrigatório' });
  try {
    const { rows } = await db.query(
      `INSERT INTO clientes (razao_social, cnpj, fantasia) VALUES ($1,$2,$3) RETURNING *`,
      [razao_social, cnpj || null, fantasia || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'CNPJ já cadastrado' });
    throw e;
  }
});

// PUT /api/clientes/:id
router.put('/:id', async (req, res) => {
  const { razao_social, cnpj, fantasia } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE clientes SET razao_social=$1, cnpj=$2, fantasia=$3, atualizado_em=NOW()
       WHERE id=$4 RETURNING *`,
      [razao_social, cnpj || null, fantasia || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'CNPJ já cadastrado' });
    throw e;
  }
});

// PATCH /api/clientes/:id/status
router.patch('/:id/status', async (req, res) => {
  const { ativo } = req.body;
  const { rows } = await db.query(
    `UPDATE clientes SET ativo=$1, atualizado_em=NOW() WHERE id=$2 RETURNING *`,
    [ativo, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
  res.json(rows[0]);
});

module.exports = router;
