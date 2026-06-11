// Backend sempre na porta 3000 em desenvolvimento.
// ANTES DE SUBIR NA VERCEL: troque pela URL real do Railway.
window.API_BASE = (() => {
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3000';
  // Cole aqui a URL do Railway, ex: 'https://gestorpro-api.up.railway.app'
  return 'https://COLE-SUA-URL-RAILWAY-AQUI.railway.app';
})();
