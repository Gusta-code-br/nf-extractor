const express = require('express');
const router = express.Router();
const db = require('../db/index');

// GET /api/pessoas?tipo=CLIENTE-FORNECEDOR&busca=nome&ativo=true
router.get('/', async (req, res) => {
  const { tipo, busca, ativo } = req.query;
  let conditions = [];
  let params = [];
  let i = 1;

  if (tipo) { conditions.push(`tipo = $${i++}`); params.push(tipo); }
  if (ativo !== undefined) { conditions.push(`ativo = $${i++}`); params.push(ativo === 'true'); }
  if (busca) {
    conditions.push(`(LOWER(razao_social) LIKE $${i} OR cpf_cnpj LIKE $${i})`);
    params.push(`%${busca.toLowerCase()}%`); i++;
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const { rows } = await db.query(
    `SELECT * FROM pessoas ${where} ORDER BY razao_social ASC`, params
  );
  res.json(rows);
});

// GET /api/pessoas/:id
router.get('/:id', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM pessoas WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
  res.json(rows[0]);
});

// POST /api/pessoas
router.post('/', async (req, res) => {
  const { tipo, razao_social, cpf_cnpj, fantasia } = req.body;
  if (!tipo || !razao_social) return res.status(400).json({ error: 'tipo e razao_social são obrigatórios' });
  const { rows } = await db.query(
    `INSERT INTO pessoas (tipo, razao_social, cpf_cnpj, fantasia)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [tipo, razao_social, cpf_cnpj || null, fantasia || null]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/pessoas/:id
router.put('/:id', async (req, res) => {
  const { razao_social, cpf_cnpj, fantasia } = req.body;
  const { rows } = await db.query(
    `UPDATE pessoas SET razao_social=$1, cpf_cnpj=$2, fantasia=$3, atualizado_em=NOW()
     WHERE id=$4 RETURNING *`,
    [razao_social, cpf_cnpj || null, fantasia || null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
  res.json(rows[0]);
});

// PATCH /api/pessoas/:id/status  { ativo: true|false }
router.patch('/:id/status', async (req, res) => {
  const { ativo } = req.body;
  const { rows } = await db.query(
    `UPDATE pessoas SET ativo=$1, atualizado_em=NOW() WHERE id=$2 RETURNING *`,
    [ativo, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
  res.json(rows[0]);
});

// GET /api/pessoas/buscar/cpf-cnpj?valor=xx
router.get('/buscar/cpf-cnpj', async (req, res) => {
  const { valor } = req.query;
  if (!valor) return res.status(400).json({ error: 'valor é obrigatório' });
  const clean = valor.replace(/\D/g, '');
  const { rows } = await db.query(
    `SELECT * FROM pessoas WHERE REGEXP_REPLACE(cpf_cnpj, '[^0-9]', '', 'g') = $1`,
    [clean]
  );
  res.json(rows[0] || null);
});

module.exports = router;
