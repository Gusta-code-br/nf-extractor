async function loadUsuarios() {
  const tbody = document.getElementById('tbodyUsuarios');
  tbody.innerHTML = loadingRow(5);
  try {
    const rows = await api('GET', '/api/usuarios');
    if (!rows.length) { tbody.innerHTML = emptyRow(5, '<i class="fa-solid fa-users"></i>', 'Nenhum usuário cadastrado'); return; }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><strong>${r.nome}</strong></td>
        <td class="td-mono">${r.email}</td>
        <td><span class="badge ${r.perfil_admin ? 'badge-active' : 'badge-inactive'}" style="${r.perfil_admin ? '' : 'background:rgba(74,157,212,.1);border-color:rgba(74,157,212,.25);color:var(--info);'}">${r.perfil_nome}</span></td>
        <td><span class="badge ${r.ativo ? 'badge-active' : 'badge-inactive'}">${r.ativo ? '● Ativo' : '○ Inativo'}</span></td>
        <td><div class="td-actions">
          <button class="btn btn-outline" style="padding:4px 10px;font-size:10px;" onclick="editUsuario(${r.id})">EDITAR</button>
          <button class="btn ${r.ativo ? 'btn-danger' : 'btn-success'}" style="padding:4px 10px;font-size:10px;"
            onclick="toggleUsuario(${r.id},${!r.ativo})">${r.ativo ? 'INATIVAR' : 'REATIVAR'}</button>
        </div></td>
      </tr>`).join('');
  } catch (e) { tbody.innerHTML = errorRow(5, e.message); }
}

async function openModalUsuario() {
  document.getElementById('usuarioEditId').value  = '';
  document.getElementById('usuarioNome').value    = '';
  document.getElementById('usuarioEmail').value   = '';
  document.getElementById('usuarioSenha').value   = '';
  document.getElementById('usuarioSenhaLabel').textContent = 'Senha *';
  document.getElementById('modalUsuarioTitle').textContent = 'Novo Usuário';
  await loadPerfisSelect('usuarioPerfil');
  document.getElementById('modalUsuario').classList.add('open');
}

async function editUsuario(id) {
  const r = await api('GET', `/api/usuarios/${id}`);
  document.getElementById('usuarioEditId').value  = id;
  document.getElementById('usuarioNome').value    = r.nome;
  document.getElementById('usuarioEmail').value   = r.email;
  document.getElementById('usuarioSenha').value   = '';
  document.getElementById('usuarioSenhaLabel').textContent = 'Nova Senha (deixe em branco para manter)';
  document.getElementById('modalUsuarioTitle').textContent = 'Editar Usuário';
  await loadPerfisSelect('usuarioPerfil');
  document.getElementById('usuarioPerfil').value = r.perfil_id;
  document.getElementById('modalUsuario').classList.add('open');
}

async function saveUsuario() {
  const editId   = document.getElementById('usuarioEditId').value;
  const nome     = document.getElementById('usuarioNome').value.trim();
  const email    = document.getElementById('usuarioEmail').value.trim();
  const senha    = document.getElementById('usuarioSenha').value;
  const perfilId = document.getElementById('usuarioPerfil').value;

  if (!nome || !email || !perfilId) return swalDark.fire({ icon: 'warning', title: 'Nome, e-mail e perfil são obrigatórios' });
  if (!editId && !senha) return swalDark.fire({ icon: 'warning', title: 'Senha é obrigatória para novo usuário' });

  try {
    const body = { nome, email, perfil_id: parseInt(perfilId) };
    if (senha) body.senha = senha;

    if (editId) await api('PUT',  `/api/usuarios/${editId}`, body);
    else        await api('POST', '/api/usuarios',            body);

    closeModal('modalUsuario');
    swalDark.fire({ icon: 'success', title: 'Salvo!', timer: 1400, showConfirmButton: false });
    loadUsuarios();
  } catch (e) { swalDark.fire({ icon: 'error', title: 'Erro', text: e.message }); }
}

async function toggleUsuario(id, ativo) {
  const conf = await swalDark.fire({ title: ativo ? 'Reativar usuário?' : 'Inativar usuário?', icon: 'question', showCancelButton: true, confirmButtonText: ativo ? 'REATIVAR' : 'INATIVAR', cancelButtonText: 'CANCELAR' });
  if (!conf.isConfirmed) return;
  await api('PATCH', `/api/usuarios/${id}/status`, { ativo });
  loadUsuarios();
  swalDark.fire({ icon: 'success', timer: 1200, showConfirmButton: false });
}

async function loadPerfisSelect(selectId) {
  const sel = document.getElementById(selectId);
  try {
    const rows = await api('GET', '/api/perfis');
    sel.innerHTML = '<option value="">— Selecione um perfil —</option>' +
      rows.filter(p => p.ativo).map(p => `<option value="${p.id}">${p.nome}${p.admin ? ' (Admin)' : ''}</option>`).join('');
  } catch { sel.innerHTML = '<option value="">Erro ao carregar perfis</option>'; }
}
