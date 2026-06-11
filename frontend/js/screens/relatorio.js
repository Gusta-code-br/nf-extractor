async function loadRelatorio(tipo) {
  const de     = document.getElementById(tipo === 'apagar' ? 'relApagarDe'     : 'relReceberDe').value;
  const ate    = document.getElementById(tipo === 'apagar' ? 'relApagarAte'    : 'relReceberAte').value;
  const status = document.getElementById(tipo === 'apagar' ? 'relApagarStatus' : 'relReceberStatus').value;
  const tbodyId  = tipo === 'apagar' ? 'tbodyRelApagar'  : 'tbodyRelAreceber';
  const totaisId = tipo === 'apagar' ? 'relApagarTotais' : 'relReceberTotais';
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = loadingRow(7);
  try {
    const params = new URLSearchParams({ tipo_lancamento: tipo === 'apagar' ? 1 : 0 });
    if (de)     params.set('de', de);
    if (ate)    params.set('ate', ate);
    if (status) params.set('status', status);
    const rows = await api('GET', `/api/relatorios/parcelas?${params}`);
    if (!rows.length) {
      tbody.innerHTML = emptyRow(7, '<i class="fa-solid fa-file"></i>', 'Nenhum registro encontrado');
      document.getElementById(totaisId).innerHTML = '';
      return;
    }
    let totalValor = 0, totalExtra = 0, totalPago = 0;
    tbody.innerHTML = rows.map(p => {
      const isPago = p.status === 'PAGO';
      const extra  = Number(p.juros || 0) + Number(p.multa || 0) + Number(p.mora || 0);
      totalValor += Number(p.valor);
      totalExtra += extra;
      totalPago  += isPago ? Number(p.valor_pago || p.valor) : 0;
      const venc = p.data_vencimento ? new Date(p.data_vencimento).toLocaleDateString('pt-BR') : '—';
      const pgto = p.data_pagamento  ? new Date(p.data_pagamento).toLocaleDateString('pt-BR')  : '—';
      return `<tr>
        <td class="td-mono">${p.numero_documento || '—'}</td>
        <td><strong>${p.entidade_nome || '—'}</strong></td>
        <td class="td-mono">${p.identificacao}</td>
        <td class="td-mono">${venc}</td>
        <td class="td-mono" style="text-align:right;">R$ ${Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        <td class="td-mono" style="text-align:right;color:${extra > 0 ? 'var(--danger)' : 'var(--muted)'};">${extra > 0 ? 'R$ ' + extra.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</td>
        <td style="text-align:right;"><span class="badge ${isPago ? 'badge-pago' : 'badge-pendente'}">${isPago ? 'PAGO ' + pgto : 'PENDENTE'}</span></td>
      </tr>`;
    }).join('');
    document.getElementById(totaisId).innerHTML = `
      <div class="totais-bar">
        <div class="totais-item"><span>Total parcelas: </span><strong>R$ ${totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
        <div class="totais-item"><span>Encargos: </span><strong style="color:${totalExtra > 0 ? 'var(--danger)' : 'var(--muted)'};">R$ ${totalExtra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
        <div class="totais-item"><span>Total pago: </span><strong style="color:var(--accent);">R$ ${totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
        <div class="totais-item" style="margin-left:auto;"><span>${rows.length} registro${rows.length !== 1 ? 's' : ''}</span></div>
      </div>`;
  } catch (e) { tbody.innerHTML = errorRow(7, e.message); }
}

function printRelatorio() { window.print(); }
