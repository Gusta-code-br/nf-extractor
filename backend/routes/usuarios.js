const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/index');

// Apenas admins acessam
router.use((req, res, next) => {
  if (!req.user?.admin) return res.status(403).json({ error: 'Acesso restrito ao Administrador' });
  next();
});

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT u.id, u.nome, u.email, u.ativo, u.criado_em,
             u.perfil_id, p.nome AS perfil_nome, p.admin AS perfil_admin
      FROM usuario u
      JOIN perfil p ON p.id = u.perfil_id
      ORDER BY u.nome ASC
    `);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT u.id, u.nome, u.email, u.ativo, u.criado_em,
             u.perfil_id, p.nome AS perfil_nome
      FROM usuario u JOIN perfil p ON p.id = u.perfil_id
      WHERE u.id=$1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { nome, email, senha, perfil_id } = req.body;
  if (!nome?.trim() || !email?.trim() || !senha || !perfil_id) {
    return res.status(400).json({ error: 'Nome, e-mail, senha e perfil são obrigatórios' });
  }
  try {
    const hash = await bcrypt.hash(senha, 10);
    const { rows } = await db.query(
      `INSERT INTO usuario (nome, email, senha_hash, perfil_id) VALUES ($1,$2,$3,$4)
       RETURNING id, nome, email, ativo, criado_em, perfil_id`,
      [nome.trim(), email.trim().toLowerCase(), hash, perfil_id]
    );
    res.status(201).json(rows[0]);
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: 'E-mail já cadastrado' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  const { nome, email, senha, perfil_id } = req.body;
  if (!nome?.trim() || !email?.trim() || !perfil_id) {
    return res.status(400).json({ error: 'Nome, e-mail e perfil são obrigatórios' });
  }
  try {
    let query, params;
    if (senha) {
      const hash = await bcrypt.hash(senha, 10);
      query = `UPDATE usuario SET nome=$1, email=$2, senha_hash=$3, perfil_id=$4 WHERE id=$5
               RETURNING id, nome, email, ativo, criado_em, perfil_id`;
      params = [nome.trim(), email.trim().toLowerCase(), hash, perfil_id, req.params.id];
    } else {
      query = `UPDATE usuario SET nome=$1, email=$2, perfil_id=$3 WHERE id=$4
               RETURNING id, nome, email, ativo, criado_em, perfil_id`;
      params = [nome.trim(), email.trim().toLowerCase(), perfil_id, req.params.id];
    }
    const { rows } = await db.query(query, params);
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: 'E-mail já cadastrado' });
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE usuario SET ativo=$1 WHERE id=$2 RETURNING id, nome, email, ativo, perfil_id`,
      [req.body.ativo, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
