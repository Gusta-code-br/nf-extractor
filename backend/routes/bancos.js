const express = require('express');
const router = express.Router();
const db = require('../db/index');

router.get('/', async (req, res) => {
  try {
    const { busca } = req.query;
    const params = [];
    let where = '';
    if (busca) {
      where = 'WHERE LOWER(nome) LIKE $1 OR codigo LIKE $1';
      params.push(`%${busca.toLowerCase()}%`);
    }
    const { rows } = await db.query(
      `SELECT * FROM instituicao_bancaria ${where} ORDER BY nome ASC`, params
    );
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM instituicao_bancaria WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { nome, codigo, agencia, conta } = req.body;
    if (!nome?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
    const { rows } = await db.query(
      `INSERT INTO instituicao_bancaria (nome, codigo, agencia, conta) VALUES ($1,$2,$3,$4) RETURNING *`,
      [nome.trim(), codigo || null, agencia || null, conta || null]
    );
    res.status(201).json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { nome, codigo, agencia, conta } = req.body;
    if (!nome?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
    const { rows } = await db.query(
      `UPDATE instituicao_bancaria SET nome=$1, codigo=$2, agencia=$3, conta=$4 WHERE id=$5 RETURNING *`,
      [nome.trim(), codigo || null, agencia || null, conta || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { ativo } = req.body;
    const { rows } = await db.query(
      `UPDATE instituicao_bancaria SET ativo=$1 WHERE id=$2 RETURNING *`,
      [ativo, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
