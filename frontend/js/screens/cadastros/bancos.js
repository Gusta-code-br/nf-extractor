async function loadBancos(busca = '') {
  const tbody = document.getElementById('tbodyBancos');
  tbody.innerHTML = loadingRow(6);
  try {
    const q = busca ? `?busca=${encodeURIComponent(busca)}` : '';
    const rows = await api('GET', `/api/bancos${q}`);
    if (!rows.length) { tbody.innerHTML = emptyRow(6, '<i class="fa-solid fa-building-columns"></i>', 'Nenhum banco cadastrado'); return; }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><strong>${r.nome}</strong></td>
        <td class="td-mono">${r.codigo || '—'}</td>
        <td class="td-mono">${r.agencia || '—'}</td>
        <td class="td-mono">${r.conta || '—'}</td>
        <td><span class="badge ${r.ativo ? 'badge-active' : 'badge-inactive'}">${r.ativo ? '● Ativo' : '○ Inativo'}</span></td>
        <td><div class="td-actions">
          <button class="btn btn-outline" style="padding:4px 10px;font-size:10px;" onclick="editBanco(${r.id})">EDITAR</button>
          <button class="btn ${r.ativo ? 'btn-danger' : 'btn-success'}" style="padding:4px 10px;font-size:10px;"
            onclick="toggleBanco(${r.id},${!r.ativo})">${r.ativo ? 'INATIVAR' : 'REATIVAR'}</button>
        </div></td>
      </tr>`).join('');
  } catch (e) { tbody.innerHTML = errorRow(6, e.message); }
}

function openModalBanco() {
  document.getElementById('bancoEditId').value  = '';
  document.getElementById('bancoNome').value    = '';
  document.getElementById('bancoCodigo').value  = '';
  document.getElementById('bancoAgencia').value = '';
  document.getElementById('bancoConta').value   = '';
  document.getElementById('modalBancoTitle').textContent = 'Nova Instituição Bancária';
  document.getElementById('modalBanco').classList.add('open');
}
async function editBanco(id) {
  const r = await api('GET', `/api/bancos/${id}`);
  document.getElementById('bancoEditId').value  = id;
  document.getElementById('bancoNome').value    = r.nome;
  document.getElementById('bancoCodigo').value  = r.codigo || '';
  document.getElementById('bancoAgencia').value = r.agencia || '';
  document.getElementById('bancoConta').value   = r.conta || '';
  document.getElementById('modalBancoTitle').textContent = 'Editar Instituição Bancária';
  document.getElementById('modalBanco').classList.add('open');
}
async function saveBanco() {
  const editId  = document.getElementById('bancoEditId').value;
  const nome    = document.getElementById('bancoNome').value.trim();
  const codigo  = document.getElementById('bancoCodigo').value.trim();
  const agencia = document.getElementById('bancoAgencia').value.trim();
  const conta   = document.getElementById('bancoConta').value.trim();
  if (!nome) return swalDark.fire({ icon: 'warning', title: 'Nome é obrigatório' });
  try {
    if (editId) await api('PUT',  `/api/bancos/${editId}`, { nome, codigo, agencia, conta });
    else        await api('POST', '/api/bancos',            { nome, codigo, agencia, conta });
    closeModal('modalBanco');
    swalDark.fire({ icon: 'success', title: 'Salvo!', timer: 1400, showConfirmButton: false });
    loadBancos();
  } catch (e) { swalDark.fire({ icon: 'error', title: 'Erro', text: e.message }); }
}
async function toggleBanco(id, ativo) {
  const conf = await swalDark.fire({ title: ativo ? 'Reativar?' : 'Inativar?', icon: 'question', showCancelButton: true, confirmButtonText: ativo ? 'REATIVAR' : 'INATIVAR', cancelButtonText: 'CANCELAR' });
  if (!conf.isConfirmed) return;
  await api('PATCH', `/api/bancos/${id}/status`, { ativo });
  loadBancos();
  swalDark.fire({ icon: 'success', timer: 1200, showConfirmButton: false });
}

async function loadBancosSelect(selectId) {
  const sel = document.getElementById(selectId);
  try {
    const rows = await api('GET', '/api/bancos');
    sel.innerHTML = '<option value="">— Sem banco —</option>' +
      rows.filter(b => b.ativo).map(b => `<option value="${b.id}">${b.nome}${b.agencia ? ' — Ag. ' + b.agencia : ''}</option>`).join('');
  } catch { sel.innerHTML = '<option value="">Erro ao carregar</option>'; }
}

document.getElementById('searchBanco').addEventListener('input', debounce(e => loadBancos(e.target.value), 350));
