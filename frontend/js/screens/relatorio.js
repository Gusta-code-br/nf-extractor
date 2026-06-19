let _relFiltrosInit = false;
const _relatorioData = {
  apagar:   { rows: [], totais: null, filtros: '' },
  areceber: { rows: [], totais: null, filtros: '' },
};

async function initRelatorioFiltros() {
  if (_relFiltrosInit) return;
  _relFiltrosInit = true;
  try {
    const fornecedores = await api('GET', '/api/fornecedores?ativo=true');
    document.getElementById('relApagarFornecedor').innerHTML =
      '<option value="">Todos</option>' +
      fornecedores.map(f => `<option value="${f.id}">${f.fantasia || f.razao_social}</option>`).join('');
  } catch { /* mantém só "Todos" se falhar */ }
  try {
    const classifs = await api('GET', '/api/classificacoes?tipo=DESPESA&ativo=true');
    document.getElementById('relApagarClassificacao').innerHTML =
      '<option value="">Todos</option>' +
      classifs.map(c => `<option value="${c.id}">${c.descricao}</option>`).join('');
  } catch { /* mantém só "Todos" se falhar */ }
}

async function loadRelatorio(tipo) {
  if (tipo === 'apagar') await initRelatorioFiltros();

  const de     = document.getElementById(tipo === 'apagar' ? 'relApagarDe'     : 'relReceberDe').value;
  const ate    = document.getElementById(tipo === 'apagar' ? 'relApagarAte'    : 'relReceberAte').value;
  const status = document.getElementById(tipo === 'apagar' ? 'relApagarStatus' : 'relReceberStatus').value;
  const fornecedorId     = tipo === 'apagar' ? document.getElementById('relApagarFornecedor').value     : '';
  const classificacaoId  = tipo === 'apagar' ? document.getElementById('relApagarClassificacao').value  : '';
  const tbodyId  = tipo === 'apagar' ? 'tbodyRelApagar'  : 'tbodyRelAreceber';
  const totaisId = tipo === 'apagar' ? 'relApagarTotais' : 'relReceberTotais';
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = loadingRow(7);
  try {
    const params = new URLSearchParams({ tipo_lancamento: tipo === 'apagar' ? 1 : 0 });
    if (de)             params.set('de', de);
    if (ate)            params.set('ate', ate);
    if (status)         params.set('status', status);
    if (fornecedorId)    params.set('fornecedor_id', fornecedorId);
    if (classificacaoId) params.set('classificacao_id', classificacaoId);
    const rows = await api('GET', `/api/relatorios/parcelas?${params}`);

    const filtroPartes = [];
    filtroPartes.push(de || ate ? `Vencimento: ${de ? new Date(de + 'T00:00').toLocaleDateString('pt-BR') : '—'} até ${ate ? new Date(ate + 'T00:00').toLocaleDateString('pt-BR') : '—'}` : 'Vencimento: todos os períodos');
    filtroPartes.push(`Status: ${status || 'Todos'}`);
    if (tipo === 'apagar') {
      const fSel = document.getElementById('relApagarFornecedor');
      const cSel = document.getElementById('relApagarClassificacao');
      if (fornecedorId)    filtroPartes.push(`Fornecedor: ${fSel.options[fSel.selectedIndex].text}`);
      if (classificacaoId) filtroPartes.push(`Tipo de Despesa: ${cSel.options[cSel.selectedIndex].text}`);
    }
    _relatorioData[tipo].filtros = filtroPartes.join('  ·  ');

    if (!rows.length) {
      tbody.innerHTML = emptyRow(7, '<i class="fa-solid fa-file"></i>', 'Nenhum registro encontrado');
      document.getElementById(totaisId).innerHTML = '';
      _relatorioData[tipo].rows = [];
      _relatorioData[tipo].totais = null;
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
    _relatorioData[tipo].rows = rows;
    _relatorioData[tipo].totais = { totalValor, totalExtra, totalPago, count: rows.length };
  } catch (e) {
    tbody.innerHTML = errorRow(7, e.message);
    _relatorioData[tipo].rows = [];
    _relatorioData[tipo].totais = null;
  }
}

function printRelatorio() {
  const tabAtiva = document.querySelector('#screen-relatorio .tab.active')?.dataset.tab;
  const tipo = tabAtiva === 'rel-areceber' ? 'areceber' : 'apagar';
  const data = _relatorioData[tipo];
  const entidadeLabel = tipo === 'apagar' ? 'Fornecedor' : 'Cliente';
  const tituloRel = tipo === 'apagar' ? 'Relatório de Contas a Pagar' : 'Relatório de Contas a Receber';

  if (!data.rows.length) {
    swalDark.fire({ icon: 'warning', title: 'Nada para imprimir', text: 'Filtre o relatório antes de imprimir.' });
    return;
  }

  const linhas = data.rows.map(p => {
    const isPago = p.status === 'PAGO';
    const extra  = Number(p.juros || 0) + Number(p.multa || 0) + Number(p.mora || 0);
    const venc   = p.data_vencimento ? new Date(p.data_vencimento).toLocaleDateString('pt-BR') : '—';
    const pgto   = p.data_pagamento  ? new Date(p.data_pagamento).toLocaleDateString('pt-BR')  : '—';
    return `<tr>
      <td>${p.numero_documento || '—'}</td>
      <td>${p.entidade_nome || '—'}</td>
      <td>${p.identificacao}</td>
      <td>${venc}</td>
      <td style="text-align:right;">R$ ${Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      <td style="text-align:right;">${extra > 0 ? 'R$ ' + extra.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</td>
      <td style="text-align:right;">${isPago ? 'Pago em ' + pgto : 'Pendente'}</td>
    </tr>`;
  }).join('');

  const agora = new Date().toLocaleString('pt-BR');
  document.getElementById('printArea').innerHTML = `
    <div class="print-header">
      <div class="print-logo">GestorPro · Financeiro</div>
      <h1>${tituloRel}</h1>
      <div class="print-filtros">${data.filtros}</div>
    </div>
    <table class="print-table">
      <thead><tr><th>Doc.</th><th>${entidadeLabel}</th><th>Parcela</th><th>Vencimento</th><th style="text-align:right;">Valor</th><th style="text-align:right;">Encargos</th><th style="text-align:right;">Situação</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>
    <div class="print-totais">
      <div>Total de parcelas: <strong>R$ ${data.totais.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
      <div>Encargos: <strong>R$ ${data.totais.totalExtra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
      <div>Total pago: <strong>R$ ${data.totais.totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
      <div>${data.totais.count} registro${data.totais.count !== 1 ? 's' : ''}</div>
    </div>
    <div class="print-footer">Gerado em ${agora}</div>
  `;
  window.print();
}
