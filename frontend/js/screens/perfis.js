async function loadPerfis() {
  const tbody = document.getElementById('tbodyPerfis');
  tbody.innerHTML = loadingRow(4);
  try {
    const rows = await api('GET', '/api/perfis');
    if (!rows.length) { tbody.innerHTML = emptyRow(4, '<i class="fa-solid fa-shield-halved"></i>', 'Nenhum perfil cadastrado'); return; }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><strong>${r.nome}</strong>${r.admin ? ' <span class="badge badge-active" style="margin-left:6px;">ADMIN</span>' : ''}</td>
        <td style="color:var(--text2);font-size:12px;">${r.descricao || '—'}</td>
        <td><span class="badge ${r.ativo ? 'badge-active' : 'badge-inactive'}">${r.ativo ? '● Ativo' : '○ Inativo'}</span></td>
        <td><div class="td-actions">
          <button class="btn btn-outline" style="padding:4px 10px;font-size:10px;" onclick="editPerfil(${r.id})">EDITAR</button>
          <button class="btn ${r.ativo ? 'btn-danger' : 'btn-success'}" style="padding:4px 10px;font-size:10px;"
            onclick="togglePerfil(${r.id},${!r.ativo})">${r.ativo ? 'INATIVAR' : 'REATIVAR'}</button>
        </div></td>
      </tr>`).join('');
  } catch (e) { tbody.innerHTML = errorRow(4, e.message); }
}

function openModalPerfil() {
  document.getElementById('perfilEditId').value    = '';
  document.getElementById('perfilNome').value      = '';
  document.getElementById('perfilDescricao').value = '';
  document.getElementById('perfilAdmin').checked   = false;
  document.getElementById('modalPerfilTitle').textContent = 'Novo Perfil';
  document.getElementById('modalPerfil').classList.add('open');
}

async function editPerfil(id) {
  const r = await api('GET', `/api/perfis/${id}`);
  document.getElementById('perfilEditId').value    = id;
  document.getElementById('perfilNome').value      = r.nome;
  document.getElementById('perfilDescricao').value = r.descricao || '';
  document.getElementById('perfilAdmin').checked   = r.admin;
  document.getElementById('modalPerfilTitle').textContent = 'Editar Perfil';
  document.getElementById('modalPerfil').classList.add('open');
}

async function savePerfil() {
  const editId    = document.getElementById('perfilEditId').value;
  const nome      = document.getElementById('perfilNome').value.trim();
  const descricao = document.getElementById('perfilDescricao').value.trim();
  const admin     = document.getElementById('perfilAdmin').checked;
  if (!nome) return swalDark.fire({ icon: 'warning', title: 'Nome é obrigatório' });
  try {
    if (editId) await api('PUT',  `/api/perfis/${editId}`, { nome, descricao, admin });
    else        await api('POST', '/api/perfis',            { nome, descricao, admin });
    closeModal('modalPerfil');
    swalDark.fire({ icon: 'success', title: 'Salvo!', timer: 1400, showConfirmButton: false });
    loadPerfis();
  } catch (e) { swalDark.fire({ icon: 'error', title: 'Erro', text: e.message }); }
}

async function togglePerfil(id, ativo) {
  const conf = await swalDark.fire({ title: ativo ? 'Reativar perfil?' : 'Inativar perfil?', icon: 'question', showCancelButton: true, confirmButtonText: ativo ? 'REATIVAR' : 'INATIVAR', cancelButtonText: 'CANCELAR' });
  if (!conf.isConfirmed) return;
  await api('PATCH', `/api/perfis/${id}/status`, { ativo });
  loadPerfis();
  swalDark.fire({ icon: 'success', timer: 1200, showConfirmButton: false });
}
