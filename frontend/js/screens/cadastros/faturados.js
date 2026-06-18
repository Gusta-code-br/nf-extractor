async function loadFaturados(busca = '') {
  const tbody = document.getElementById('tbodyFaturados');
  tbody.innerHTML = loadingRow(4);
  try {
    const q = busca ? `?busca=${encodeURIComponent(busca)}` : '';
    const rows = await api('GET', `/api/faturados${q}`);
    if (!rows.length) { tbody.innerHTML = emptyRow(4, '<i class="fa-solid fa-user"></i>', 'Nenhum faturado cadastrado'); return; }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><strong>${r.nome_completo}</strong></td>
        <td class="td-mono">${r.cpf || '—'}</td>
        <td><span class="badge ${r.ativo ? 'badge-active' : 'badge-inactive'}">${r.ativo ? '● Ativo' : '○ Inativo'}</span></td>
        <td><div class="td-actions">
          <button class="btn btn-outline" style="padding:4px 10px;font-size:10px;" onclick="editFaturado(${r.id})">EDITAR</button>
          <button class="btn ${r.ativo ? 'btn-danger' : 'btn-success'}" style="padding:4px 10px;font-size:10px;"
            onclick="toggleFaturado(${r.id},${!r.ativo})">${r.ativo ? 'INATIVAR' : 'REATIVAR'}</button>
        </div></td>
      </tr>`).join('');
  } catch (e) { tbody.innerHTML = errorRow(4, e.message); }
}

function openModalFaturado() {
  document.getElementById('faturadoEditId').value = '';
  document.getElementById('faturadoNome').value   = '';
  document.getElementById('faturadoCpf').value    = '';
  document.getElementById('modalFaturadoTitle').textContent = 'Novo Faturado';
  document.getElementById('modalFaturado').classList.add('open');
}
async function editFaturado(id) {
  const r = await api('GET', `/api/faturados/${id}`);
  document.getElementById('faturadoEditId').value = id;
  document.getElementById('faturadoNome').value   = r.nome_completo;
  document.getElementById('faturadoCpf').value    = r.cpf || '';
  document.getElementById('modalFaturadoTitle').textContent = 'Editar Faturado';
  document.getElementById('modalFaturado').classList.add('open');
}
async function saveFaturado() {
  const editId = document.getElementById('faturadoEditId').value;
  const nome   = document.getElementById('faturadoNome').value.trim();
  const cpf    = document.getElementById('faturadoCpf').value.trim();
  if (!nome) return swalDark.fire({ icon: 'warning', title: 'Nome é obrigatório' });
  try {
    if (editId) await api('PUT',  `/api/faturados/${editId}`, { nome_completo: nome, cpf });
    else        await api('POST', '/api/faturados',            { nome_completo: nome, cpf });
    closeModal('modalFaturado');
    swalDark.fire({ icon: 'success', title: 'Salvo!', timer: 1400, showConfirmButton: false });
    loadFaturados();
  } catch (e) { swalDark.fire({ icon: 'error', title: 'Erro', text: e.message }); }
}
async function toggleFaturado(id, ativo) {
  const conf = await swalDark.fire({ title: ativo ? 'Reativar?' : 'Inativar?', icon: 'question', showCancelButton: true, confirmButtonText: ativo ? 'REATIVAR' : 'INATIVAR', cancelButtonText: 'CANCELAR' });
  if (!conf.isConfirmed) return;
  await api('PATCH', `/api/faturados/${id}/status`, { ativo });
  loadFaturados();
  swalDark.fire({ icon: 'success', timer: 1200, showConfirmButton: false });
}

document.getElementById('searchFaturado').addEventListener('input', debounce(e => loadFaturados(e.target.value), 350));
