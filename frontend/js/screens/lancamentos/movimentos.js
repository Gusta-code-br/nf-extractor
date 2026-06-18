async function loadMovimentos(tipo, tbodyId, busca = '') {
  const tbody = document.getElementById(tbodyId);
  const cols = tipo === 1 ? 8 : 5;
  tbody.innerHTML = loadingRow(cols);
  try {
    const params = new URLSearchParams({ tipo_lancamento: tipo });
    if (busca) params.set('busca', busca);
    const rows = await api('GET', `/api/movimentos?${params}`);
    if (!rows.length) { tbody.innerHTML = emptyRow(cols, tipo === 1 ? '<i class="fa-solid fa-money-bill-wave"></i>' : '<i class="fa-solid fa-coins"></i>', 'Nenhum lançamento'); return; }
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const html = [];
    rows.forEach(r => {
      const parc = (r.parcelas || []).sort((a, b) => (a.numero_parcela || 0) - (b.numero_parcela || 0));
      const pend = parc.filter(p => p.status === 'PENDENTE').length;

      let vencCell = '';
      if (tipo === 1) {
        const pendentes = parc
          .filter(p => p.status === 'PENDENTE' && p.data_vencimento)
          .sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
        if (pendentes.length) {
          const proxData = new Date(pendentes[0].data_vencimento); proxData.setHours(0, 0, 0, 0);
          const diff = (proxData - hoje) / 86400000;
          const cor = diff < 0 ? 'var(--danger)' : diff <= 7 ? 'var(--warning)' : 'var(--text2)';
          const label = diff < 0 ? `<i class="fa-solid fa-triangle-exclamation" style="font-size:10px;"></i> ` : '';
          vencCell = `<td class="td-mono" style="color:${cor};">${label}${proxData.toLocaleDateString('pt-BR')}</td>`;
        } else {
          vencCell = `<td class="td-mono" style="color:var(--muted);">—</td>`;
        }
      }

      if (tipo === 1) window['_parc_' + r.id] = parc;

      html.push(`<tr id="mov-row-${r.id}">
        <td class="td-mono">${r.numero_documento || '—'}</td>
        <td><strong>${tipo === 1 ? (r.fornecedor_nome || '—') : (r.cliente_nome || '—')}</strong></td>
        ${tipo === 1 ? `<td style="font-size:12px;color:var(--text2);">${r.faturado_nome || '—'}</td>` : ''}
        <td class="td-mono" style="color:var(--accent);">R$ ${Number(r.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        <td class="td-mono">${r.data_emissao ? new Date(r.data_emissao).toLocaleDateString('pt-BR') : '—'}</td>
        ${tipo === 1 ? vencCell : ''}
        <td><span class="badge ${pend > 0 ? 'badge-pendente' : 'badge-pago'}">${pend > 0 ? `${pend}/${parc.length} PEND.` : `${parc.length}/${parc.length} PAGO`}</span></td>
        ${tipo === 1 ? `<td style="text-align:center;"><button class="btn-toggle" id="toggle-${r.id}" onclick="toggleParcelas(${r.id})" title="Ver parcelas"><i class="fa-solid fa-chevron-down"></i></button></td>` : ''}
      </tr>`);
    });
    tbody.innerHTML = html.join('');
  } catch (e) { tbody.innerHTML = errorRow(cols, e.message); }
}

function toggleParcelas(movId) {
  const mainRow  = document.getElementById('mov-row-' + movId);
  const expandRow = document.getElementById('expand-row-' + movId);
  const toggleBtn = document.getElementById('toggle-' + movId);
  if (expandRow) { expandRow.remove(); toggleBtn.classList.remove('expanded'); return; }
  toggleBtn.classList.add('expanded');
  const parcelas = window['_parc_' + movId] || [];
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const parcRowsHtml = parcelas.map(p => {
    const isPago = p.status === 'PAGO';
    const venc = p.data_vencimento ? (() => { const d = new Date(p.data_vencimento); d.setHours(0, 0, 0, 0); return d; })() : null;
    const diff = venc ? (venc - hoje) / 86400000 : null;
    const cor = isPago ? 'var(--muted)' : (diff < 0 ? 'var(--danger)' : diff <= 7 ? 'var(--warning)' : 'var(--text2)');
    const valorPago = p.valor_pago ? Number(p.valor_pago) : Number(p.valor || 0);
    const encargos = Number(p.juros || 0) + Number(p.multa || 0) + Number(p.mora || 0);
    return `<tr>
      <td style="padding:8px 12px;font-family:var(--mono);font-size:12px;">${p.identificacao || p.numero_parcela}</td>
      <td style="padding:8px 12px;font-family:var(--mono);font-size:12px;color:${cor};">${venc ? venc.toLocaleDateString('pt-BR') : '—'}</td>
      <td style="padding:8px 12px;font-family:var(--mono);font-size:12px;">R$ ${Number(p.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      <td style="padding:8px 12px;font-family:var(--mono);font-size:12px;color:${encargos > 0 ? 'var(--danger)' : 'var(--muted)'};">${encargos > 0 ? 'R$ ' + encargos.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</td>
      <td style="padding:8px 12px;"><span class="badge ${isPago ? 'badge-pago' : 'badge-pendente'}">${isPago ? 'PAGO' : 'PENDENTE'}</span></td>
      <td style="padding:8px 12px;">
        ${isPago
          ? `<span style="font-family:var(--mono);font-size:11px;color:var(--muted);">${p.data_pagamento ? new Date(p.data_pagamento).toLocaleDateString('pt-BR') : '—'} · R$ ${valorPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>`
          : `<button class="btn btn-success" style="padding:4px 12px;font-size:10px;" onclick="openQuitar(${p.id},'${p.identificacao}',${p.valor},'${p.data_vencimento}')"><i class="fa-solid fa-circle-check"></i> QUITAR</button>`
        }
      </td>
    </tr>`;
  }).join('');
  const expandTr = document.createElement('tr');
  expandTr.id = 'expand-row-' + movId;
  expandTr.className = 'parcels-row';
  expandTr.innerHTML = `<td colspan="8"><div class="parcels-inner">
    <div class="parcels-title"><i class="fa-solid fa-credit-card"></i> PARCELAS DO LANÇAMENTO</div>
    <table><thead><tr>
      <th style="padding:6px 12px;">Parcela</th><th style="padding:6px 12px;">Vencimento</th>
      <th style="padding:6px 12px;">Valor</th><th style="padding:6px 12px;">Encargos</th>
      <th style="padding:6px 12px;">Status</th><th style="padding:6px 12px;">Pagamento</th>
    </tr></thead><tbody>${parcRowsHtml}</tbody></table>
  </div></td>`;
  mainRow.insertAdjacentElement('afterend', expandTr);
}

async function openQuitar(parcelaId, identificacao, valor, vencimento) {
  _quitarId         = parcelaId;
  _quitarVencimento = vencimento ? vencimento.split('T')[0] : null;
  document.getElementById('_quitarParcelaId').value     = parcelaId;
  document.getElementById('_quitarValorOriginal').value  = valor;
  document.getElementById('quitarParcelaInfo').textContent = `Parcela ${identificacao} — R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  document.getElementById('quitarVencimento').textContent  = vencimento ? new Date(vencimento).toLocaleDateString('pt-BR') : '—';
  document.getElementById('quitarValorOriginalDisplay').textContent = 'R$ ' + Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  document.getElementById('quitarData').value       = new Date().toISOString().split('T')[0];
  document.getElementById('quitarTaxaJuros').value  = '1';
  document.getElementById('quitarJuros').value      = '0';
  document.getElementById('quitarMulta').value      = '0';
  document.getElementById('quitarMora').value       = '0';
  document.getElementById('quitarDiasAtraso').textContent = '';
  await loadBancosSelect('quitarBanco');
  calcJurosAuto();
  document.getElementById('modalQuitar').classList.add('open');
}

function calcJurosAuto() {
  const vo         = parseFloat(document.getElementById('_quitarValorOriginal').value) || 0;
  const taxaMensal = parseFloat(document.getElementById('quitarTaxaJuros').value) || 0;
  const dataPgto   = document.getElementById('quitarData').value;
  const diasEl     = document.getElementById('quitarDiasAtraso');

  if (!_quitarVencimento || !dataPgto || taxaMensal === 0) {
    diasEl.textContent = '';
    calcTotalQuitar();
    return;
  }

  const venc = new Date(_quitarVencimento + 'T00:00:00');
  const pgto = new Date(dataPgto + 'T00:00:00');
  const dias = Math.floor((pgto - venc) / 86400000);

  if (dias <= 0) {
    diasEl.textContent = dias === 0 ? '(no prazo)' : `(${Math.abs(dias)} dias antes do venc.)`;
    diasEl.style.color = 'var(--accent)';
    document.getElementById('quitarJuros').value = '0.00';
    calcTotalQuitar();
    return;
  }

  diasEl.textContent = `${dias} dia${dias !== 1 ? 's' : ''} de atraso`;
  diasEl.style.color = 'var(--danger)';
  const jurosCalc = vo * (taxaMensal / 100) * (dias / 30);
  document.getElementById('quitarJuros').value = jurosCalc.toFixed(2);
  calcTotalQuitar();
}

function calcTotalQuitar() {
  const vo    = parseFloat(document.getElementById('_quitarValorOriginal').value) || 0;
  const juros = parseFloat(document.getElementById('quitarJuros').value) || 0;
  const multa = parseFloat(document.getElementById('quitarMulta').value) || 0;
  const mora  = parseFloat(document.getElementById('quitarMora').value)  || 0;
  const total = vo + juros + multa + mora;
  const el = document.getElementById('quitarTotal');
  el.textContent = 'R$ ' + total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  el.style.color = (juros + multa + mora) > 0 ? 'var(--danger)' : 'var(--accent)';
}

async function confirmarQuitar() {
  if (!_quitarId) return;
  const data    = document.getElementById('quitarData').value;
  const juros   = parseFloat(document.getElementById('quitarJuros').value) || 0;
  const multa   = parseFloat(document.getElementById('quitarMulta').value) || 0;
  const mora    = parseFloat(document.getElementById('quitarMora').value)  || 0;
  const bancoId = document.getElementById('quitarBanco').value || null;
  if (!data) return swalDark.fire({ icon: 'warning', title: 'Informe a data de pagamento' });
  try {
    await api('PATCH', `/api/movimentos/parcela/${_quitarId}/pagar`, {
      data_pagamento: data, juros, multa, mora,
      instituicao_id: bancoId ? parseInt(bancoId) : null
    });
    closeModal('modalQuitar');
    swalDark.fire({ icon: 'success', title: 'Parcela quitada com sucesso!', timer: 1600, showConfirmButton: false });
    loadMovimentos(1, 'tbodyApagar');
    loadDashboard();
  } catch (e) { swalDark.fire({ icon: 'error', title: 'Erro', text: e.message }); }
}

document.getElementById('searchApagar').addEventListener('input',   debounce(e => loadMovimentos(1, 'tbodyApagar',   e.target.value), 350));
document.getElementById('searchAreceber').addEventListener('input', debounce(e => loadMovimentos(0, 'tbodyAreceber', e.target.value), 350));
