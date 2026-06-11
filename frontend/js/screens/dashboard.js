async function loadDashboard() {
  const content = document.getElementById('dashboardContent');
  content.innerHTML = '<div class="empty"><div class="empty-icon"><i class="fa-solid fa-rotate fa-spin"></i></div><div class="empty-text">Carregando…</div></div>';
  try {
    const d = await api('GET', '/api/dashboard');
    const fmt  = n => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const fmtK = n => { if (n >= 1e6) return 'R$ ' + (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return 'R$ ' + (n / 1e3).toFixed(1) + 'k'; return 'R$ ' + fmt(n); };

    const alertEl = document.getElementById('alertVencidas');
    if (d.vencidas.qtd > 0) {
      document.getElementById('alertVencidasText').textContent =
        `${d.vencidas.qtd} parcela${d.vencidas.qtd > 1 ? 's' : ''} vencida${d.vencidas.qtd > 1 ? 's' : ''} — R$ ${fmt(d.vencidas.total)} em aberto`;
      alertEl.classList.remove('hidden');
    } else {
      alertEl.classList.add('hidden');
    }

    content.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-icon"><i class="fa-solid fa-money-bill-wave"></i></div>
          <div class="kpi-label">A Pagar — Pendente</div>
          <div class="kpi-value">${fmtK(d.apagar.total)}</div>
          <div class="kpi-sub">${d.apagar.qtd} parcela${d.apagar.qtd !== 1 ? 's' : ''} em aberto</div>
        </div>
        <div class="kpi-card kpi-success">
          <div class="kpi-icon"><i class="fa-solid fa-coins"></i></div>
          <div class="kpi-label">A Receber — Pendente</div>
          <div class="kpi-value green">${fmtK(d.areceber.total)}</div>
          <div class="kpi-sub">${d.areceber.qtd} parcela${d.areceber.qtd !== 1 ? 's' : ''} a receber</div>
        </div>
        <div class="kpi-card kpi-danger">
          <div class="kpi-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <div class="kpi-label">Parcelas Vencidas</div>
          <div class="kpi-value red">${d.vencidas.qtd}</div>
          <div class="kpi-sub">${d.vencidas.total > 0 ? 'R$ ' + fmt(d.vencidas.total) : 'Nenhuma vencida'}</div>
        </div>
        <div class="kpi-card kpi-info">
          <div class="kpi-icon"><i class="fa-solid fa-circle-check"></i></div>
          <div class="kpi-label">Pagas este Mês</div>
          <div class="kpi-value blue">${fmtK(d.pagas_mes.total)}</div>
          <div class="kpi-sub">${d.pagas_mes.qtd} parcela${d.pagas_mes.qtd !== 1 ? 's' : ''} quitadas</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-clock-rotate-left"></i> Últimos Lançamentos</span>
          <span style="font-family:var(--mono);font-size:10px;color:var(--muted);">${d.total_movimentos} total no sistema</span>
        </div>
        <div class="card-body" style="padding:0;">
          <div class="table-wrap"><table>
            <thead><tr><th>Doc.</th><th>Entidade</th><th>Tipo</th><th>Valor</th><th>Emissão</th></tr></thead>
            <tbody>
              ${d.ultimas.length ? d.ultimas.map(u => `<tr>
                <td class="td-mono">${u.numero_documento || '—'}</td>
                <td><strong>${u.entidade_nome || '—'}</strong></td>
                <td><span class="badge ${u.tipo_lancamento === 1 ? 'badge-pendente' : 'badge-active'}">${u.tipo_lancamento === 1 ? 'A PAGAR' : 'A RECEBER'}</span></td>
                <td class="td-mono" style="color:var(--accent);">R$ ${fmt(u.valor_total)}</td>
                <td class="td-mono">${u.data_emissao ? new Date(u.data_emissao).toLocaleDateString('pt-BR') : '—'}</td>
              </tr>`).join('') : '<tr><td colspan="5"><div class="empty"><div class="empty-icon"><i class="fa-solid fa-inbox"></i></div><div class="empty-text">Nenhum lançamento registrado</div></div></td></tr>'}
            </tbody>
          </table></div>
        </div>
      </div>`;
  } catch (e) {
    content.innerHTML = `<div class="empty"><div class="empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><div class="empty-text">${e.message}</div></div>`;
  }
}
