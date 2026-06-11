async function loadClassifs(tipo, tbodyId, busca = '') {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = loadingRow(3);
  try {
    const params = new URLSearchParams({ tipo });
    if (busca) params.set('busca', busca);
    const rows = await api('GET', `/api/classificacoes?${params}`);
    if (!rows.length) { tbody.innerHTML = emptyRow(3, tipo === 'DESPESA' ? '<i class="fa-solid fa-arrow-trend-down"></i>' : '<i class="fa-solid fa-arrow-trend-up"></i>', 'Nenhuma classificação'); return; }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><strong>${r.descricao}</strong></td>
        <td><span class="badge ${r.ativo ? 'badge-active' : 'badge-inactive'}">${r.ativo ? '● Ativo' : '○ Inativo'}</span></td>
        <td><div class="td-actions">
          <button class="btn btn-outline" style="padding:4px 10px;font-size:10px;" onclick="editClassif(${r.id},'${tipo}')">EDITAR</button>
          <button class="btn ${r.ativo ? 'btn-danger' : 'btn-success'}" style="padding:4px 10px;font-size:10px;"
            onclick="toggleClassif(${r.id},${!r.ativo},'${tbodyId}','${tipo}')">${r.ativo ? 'INATIVAR' : 'REATIVAR'}</button>
        </div></td>
      </tr>`).join('');
  } catch (e) { tbody.innerHTML = errorRow(3, e.message); }
}

function openModalClassif(tipo) {
  document.getElementById('classifTipo').value      = tipo;
  document.getElementById('classifEditId').value    = '';
  document.getElementById('classifDescricao').value = '';
  document.getElementById('modalClassifTitle').textContent = `Nova Classificação de ${tipo === 'DESPESA' ? 'Despesa' : 'Receita'}`;
  document.getElementById('modalClassif').classList.add('open');
}
async function editClassif(id, tipo) {
  const rows = await api('GET', `/api/classificacoes?tipo=${tipo}`);
  const r = rows.find(x => x.id === id);
  if (!r) return;
  document.getElementById('classifTipo').value      = tipo;
  document.getElementById('classifEditId').value    = id;
  document.getElementById('classifDescricao').value = r.descricao;
  document.getElementById('modalClassifTitle').textContent = 'Editar Classificação';
  document.getElementById('modalClassif').classList.add('open');
}
async function saveClassif() {
  const tipo      = document.getElementById('classifTipo').value;
  const editId    = document.getElementById('classifEditId').value;
  const descricao = document.getElementById('classifDescricao').value.trim();
  if (!descricao) return swalDark.fire({ icon: 'warning', title: 'Descrição é obrigatória' });
  try {
    if (editId) await api('PUT',  `/api/classificacoes/${editId}`, { descricao });
    else        await api('POST', '/api/classificacoes',            { tipo, descricao });
    closeModal('modalClassif');
    swalDark.fire({ icon: 'success', title: 'Salvo!', timer: 1400, showConfirmButton: false });
    if (tipo === 'DESPESA') loadClassifs('DESPESA', 'tbodyDespesas');
    else                    loadClassifs('RECEITA',  'tbodyReceitas');
  } catch (e) { swalDark.fire({ icon: 'error', title: 'Erro', text: e.message }); }
}
async function toggleClassif(id, ativo, tbodyId, tipo) {
  const conf = await swalDark.fire({ title: ativo ? 'Reativar?' : 'Inativar?', icon: 'question', showCancelButton: true, confirmButtonText: ativo ? 'REATIVAR' : 'INATIVAR', cancelButtonText: 'CANCELAR' });
  if (!conf.isConfirmed) return;
  await api('PATCH', `/api/classificacoes/${id}/status`, { ativo });
  loadClassifs(tipo, tbodyId);
  swalDark.fire({ icon: 'success', timer: 1200, showConfirmButton: false });
}

document.getElementById('searchDespesa').addEventListener('input', debounce(e => loadClassifs('DESPESA', 'tbodyDespesas', e.target.value), 350));
document.getElementById('searchReceita').addEventListener('input', debounce(e => loadClassifs('RECEITA', 'tbodyReceitas', e.target.value), 350));
