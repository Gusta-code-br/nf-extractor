const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/index');

const SECRET = process.env.JWT_SECRET || 'gestorpro_secret_2026';
const EXPIRES = '12h';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
  try {
    const { rows } = await db.query(
      `SELECT u.*, p.nome AS perfil_nome, p.admin AS perfil_admin
       FROM usuario u
       JOIN perfil p ON p.id = u.perfil_id
       WHERE LOWER(u.email) = LOWER($1) AND u.ativo = true`,
      [email.trim()]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'E-mail ou senha incorretos' });

    const ok = await bcrypt.compare(senha, user.senha_hash);
    if (!ok) return res.status(401).json({ error: 'E-mail ou senha incorretos' });

    const payload = {
      id:          user.id,
      nome:        user.nome,
      email:       user.email,
      perfil_id:   user.perfil_id,
      perfil_nome: user.perfil_nome,
      admin:       user.perfil_admin,
    };
    const token = jwt.sign(payload, SECRET, { expiresIn: EXPIRES });
    res.json({ token, user: payload });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth'), (req, res) => {
  res.json(req.user);
});

module.exports = router;
