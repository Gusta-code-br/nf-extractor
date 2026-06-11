const express = require('express');
const router = express.Router();
const db = require('../db/index');

// Apenas admins acessam
router.use((req, res, next) => {
  if (!req.user?.admin) return res.status(403).json({ error: 'Acesso restrito ao Administrador' });
  next();
});

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM perfil ORDER BY nome ASC');
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM perfil WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { nome, descricao, admin } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
  try {
    const { rows } = await db.query(
      `INSERT INTO perfil (nome, descricao, admin) VALUES ($1,$2,$3) RETURNING *`,
      [nome.trim(), descricao || null, !!admin]
    );
    res.status(201).json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const { nome, descricao, admin } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
  try {
    const { rows } = await db.query(
      `UPDATE perfil SET nome=$1, descricao=$2, admin=$3 WHERE id=$4 RETURNING *`,
      [nome.trim(), descricao || null, !!admin, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE perfil SET ativo=$1 WHERE id=$2 RETURNING *`,
      [req.body.ativo, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
