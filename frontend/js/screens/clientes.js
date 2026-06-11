async function loadClientes(busca = '') {
  const tbody = document.getElementById('tbodyClientes');
  tbody.innerHTML = loadingRow(5);
  try {
    const q = busca ? `?busca=${encodeURIComponent(busca)}` : '';
    const rows = await api('GET', `/api/clientes${q}`);
    if (!rows.length) { tbody.innerHTML = emptyRow(5, '<i class="fa-solid fa-users"></i>', 'Nenhum cliente cadastrado'); return; }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><strong>${r.razao_social}</strong></td>
        <td class="td-mono">${r.fantasia || '—'}</td>
        <td class="td-mono">${r.cnpj || '—'}</td>
        <td><span class="badge ${r.ativo ? 'badge-active' : 'badge-inactive'}">${r.ativo ? '● Ativo' : '○ Inativo'}</span></td>
        <td><div class="td-actions">
          <button class="btn btn-outline" style="padding:4px 10px;font-size:10px;" onclick="editCliente(${r.id})">EDITAR</button>
          <button class="btn ${r.ativo ? 'btn-danger' : 'btn-success'}" style="padding:4px 10px;font-size:10px;"
            onclick="toggleCliente(${r.id},${!r.ativo})">${r.ativo ? 'INATIVAR' : 'REATIVAR'}</button>
        </div></td>
      </tr>`).join('');
  } catch (e) { tbody.innerHTML = errorRow(5, e.message); }
}

function openModalCliente() {
  document.getElementById('clienteEditId').value    = '';
  document.getElementById('clienteRazao').value     = '';
  document.getElementById('clienteCnpj').value      = '';
  document.getElementById('clienteFantasia').value  = '';
  document.getElementById('modalClienteTitle').textContent = 'Novo Cliente';
  document.getElementById('modalCliente').classList.add('open');
}
async function editCliente(id) {
  const r = await api('GET', `/api/clientes/${id}`);
  document.getElementById('clienteEditId').value    = id;
  document.getElementById('clienteRazao').value     = r.razao_social;
  document.getElementById('clienteCnpj').value      = r.cnpj || '';
  document.getElementById('clienteFantasia').value  = r.fantasia || '';
  document.getElementById('modalClienteTitle').textContent = 'Editar Cliente';
  document.getElementById('modalCliente').classList.add('open');
}
async function saveCliente() {
  const editId   = document.getElementById('clienteEditId').value;
  const razao    = document.getElementById('clienteRazao').value.trim();
  const cnpj     = document.getElementById('clienteCnpj').value.trim();
  const fantasia = document.getElementById('clienteFantasia').value.trim();
  if (!razao) return swalDark.fire({ icon: 'warning', title: 'Razão Social é obrigatória' });
  try {
    if (editId) await api('PUT',  `/api/clientes/${editId}`, { razao_social: razao, cnpj, fantasia });
    else        await api('POST', '/api/clientes',            { razao_social: razao, cnpj, fantasia });
    closeModal('modalCliente');
    swalDark.fire({ icon: 'success', title: 'Salvo!', timer: 1400, showConfirmButton: false });
    loadClientes();
  } catch (e) { swalDark.fire({ icon: 'error', title: 'Erro', text: e.message }); }
}
async function toggleCliente(id, ativo) {
  const conf = await swalDark.fire({ title: ativo ? 'Reativar?' : 'Inativar?', icon: 'question', showCancelButton: true, confirmButtonText: ativo ? 'REATIVAR' : 'INATIVAR', cancelButtonText: 'CANCELAR' });
  if (!conf.isConfirmed) return;
  await api('PATCH', `/api/clientes/${id}/status`, { ativo });
  loadClientes();
  swalDark.fire({ icon: 'success', timer: 1200, showConfirmButton: false });
}

document.getElementById('searchCliente').addEventListener('input', debounce(e => loadClientes(e.target.value), 350));
