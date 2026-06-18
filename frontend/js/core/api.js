async function api(method, url, body) {
  const token = localStorage.getItem('gp_token');
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  };
  if (body) opts.body = JSON.stringify(body);
  let res;
  try { res = await fetch((window.API_BASE || '') + url, opts); }
  catch { throw new Error('Servidor não encontrado — verifique a conexão'); }
  if (res.status === 401) {
    localStorage.removeItem('gp_token');
    localStorage.removeItem('gp_user');
    window.location.href = '/login.html';
    return;
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new Error(`Erro ${res.status}: servidor retornou resposta inválida — reinicie o servidor`);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
