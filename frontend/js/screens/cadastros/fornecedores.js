async function loadFornecedores(busca = '') {
  const tbody = document.getElementById('tbodyFornecedores');
  tbody.innerHTML = loadingRow(5);
  try {
    const q = busca ? `?busca=${encodeURIComponent(busca)}` : '';
    const rows = await api('GET', `/api/fornecedores${q}`);
    if (!rows.length) { tbody.innerHTML = emptyRow(5, '<i class="fa-solid fa-industry"></i>', 'Nenhum fornecedor cadastrado'); return; }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><strong>${r.razao_social}</strong></td>
        <td class="td-mono">${r.fantasia || '—'}</td>
        <td class="td-mono">${r.cnpj || '—'}</td>
        <td><span class="badge ${r.ativo ? 'badge-active' : 'badge-inactive'}">${r.ativo ? '● Ativo' : '○ Inativo'}</span></td>
        <td><div class="td-actions">
          <button class="btn btn-outline" style="padding:4px 10px;font-size:10px;" onclick="editFornecedor(${r.id})">EDITAR</button>
          <button class="btn ${r.ativo ? 'btn-danger' : 'btn-success'}" style="padding:4px 10px;font-size:10px;"
            onclick="toggleFornecedor(${r.id},${!r.ativo})">${r.ativo ? 'INATIVAR' : 'REATIVAR'}</button>
        </div></td>
      </tr>`).join('');
  } catch (e) { tbody.innerHTML = errorRow(5, e.message); }
}

function openModalFornecedor() {
  document.getElementById('fornecedorEditId').value    = '';
  document.getElementById('fornecedorRazao').value     = '';
  document.getElementById('fornecedorCnpj').value      = '';
  document.getElementById('fornecedorFantasia').value  = '';
  document.getElementById('modalFornecedorTitle').textContent = 'Novo Fornecedor';
  document.getElementById('modalFornecedor').classList.add('open');
}
async function editFornecedor(id) {
  const r = await api('GET', `/api/fornecedores/${id}`);
  document.getElementById('fornecedorEditId').value   = id;
  document.getElementById('fornecedorRazao').value    = r.razao_social;
  document.getElementById('fornecedorCnpj').value     = r.cnpj || '';
  document.getElementById('fornecedorFantasia').value = r.fantasia || '';
  document.getElementById('modalFornecedorTitle').textContent = 'Editar Fornecedor';
  document.getElementById('modalFornecedor').classList.add('open');
}
async function saveFornecedor() {
  const editId   = document.getElementById('fornecedorEditId').value;
  const razao    = document.getElementById('fornecedorRazao').value.trim();
  const cnpj     = document.getElementById('fornecedorCnpj').value.trim();
  const fantasia = document.getElementById('fornecedorFantasia').value.trim();
  if (!razao) return swalDark.fire({ icon: 'warning', title: 'Razão Social é obrigatória' });
  try {
    if (editId) await api('PUT',  `/api/fornecedores/${editId}`, { razao_social: razao, cnpj, fantasia });
    else        await api('POST', '/api/fornecedores',            { razao_social: razao, cnpj, fantasia });
    closeModal('modalFornecedor');
    swalDark.fire({ icon: 'success', title: 'Salvo!', timer: 1400, showConfirmButton: false });
    loadFornecedores();
  } catch (e) { swalDark.fire({ icon: 'error', title: 'Erro', text: e.message }); }
}
async function toggleFornecedor(id, ativo) {
  const conf = await swalDark.fire({ title: ativo ? 'Reativar?' : 'Inativar?', icon: 'question', showCancelButton: true, confirmButtonText: ativo ? 'REATIVAR' : 'INATIVAR', cancelButtonText: 'CANCELAR' });
  if (!conf.isConfirmed) return;
  await api('PATCH', `/api/fornecedores/${id}/status`, { ativo });
  loadFornecedores();
  swalDark.fire({ icon: 'success', timer: 1200, showConfirmButton: false });
}

document.getElementById('searchFornecedor').addEventListener('input', debounce(e => loadFornecedores(e.target.value), 350));
