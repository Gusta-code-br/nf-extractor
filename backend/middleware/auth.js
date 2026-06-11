const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'gestorpro_secret_2026';

module.exports = function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autenticado — faça login' });
  }
  try {
    req.user = jwt.verify(auth.split(' ')[1], SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Sessão expirada — faça login novamente' });
  }
};
