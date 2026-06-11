function initNF() {
  const fileInput     = document.getElementById('fileInput');
  const uploadZone    = document.getElementById('uploadZone');
  const fileInfoEl    = document.getElementById('fileInfo');
  const btnExtract    = document.getElementById('btnExtract');
  const errorBox      = document.getElementById('errorBox');
  const progressWrap  = document.getElementById('progressWrap');
  const progressFill  = document.getElementById('progressFill');
  const progressLabel = document.getElementById('progressLabel');

  function setLoading(on) { btnExtract.disabled = on; btnExtract.classList.toggle('loading-state', on); }
  function setProgress(pct, label) { progressWrap.classList.add('visible'); progressFill.style.width = pct + '%'; progressLabel.textContent = label; }
  function hideProgress() { progressWrap.classList.remove('visible'); }
  function showError(msg) { errorBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> ' + msg; errorBox.classList.add('visible'); }
  function hideError()    { errorBox.classList.remove('visible'); }

  function handleFile(file) {
    if (!file) return;
    if (file.type !== 'application/pdf') { showError('Selecione um arquivo PDF.'); return; }
    selectedFile = file;
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatBytes(file.size);
    fileInfoEl.classList.add('visible');
    btnExtract.disabled = false;
    hideError();
  }

  fileInput.addEventListener('change', e => handleFile(e.target.files[0]));
  uploadZone.addEventListener('dragover',  e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', ()  => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault(); uploadZone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/pdf') handleFile(f);
    else showError('Selecione um arquivo PDF.');
  });

  document.getElementById('removeFile').addEventListener('click', () => {
    selectedFile = null; fileInput.value = '';
    fileInfoEl.classList.remove('visible');
    btnExtract.disabled = true;
    hideError(); hideProgress();
    document.getElementById('resultsCard').style.display = 'none';
  });

  btnExtract.addEventListener('click', async () => {
    if (!selectedFile) return;
    hideError(); setLoading(true); setProgress(10, 'Lendo o PDF…');
    try {
      const base64   = await fileToBase64(selectedFile);
      const fileText = await pdfToText(selectedFile);
      setProgress(40, 'Enviando para o servidor…');
      const result = await api('POST', '/api/extract', { base64, mediaType: selectedFile.type, text: fileText });
      setProgress(90, 'Processando…');
      extractedData = result.data;
      setProgress(100, 'Concluído!');
      setTimeout(() => { setLoading(false); renderResults(extractedData); }, 500);
    } catch (e) {
      setLoading(false); hideProgress();
      showError('Erro: ' + e.message);
    }
  });

  document.getElementById('btnCopy').addEventListener('click', () => {
    if (!extractedData) return;
    navigator.clipboard.writeText(JSON.stringify(extractedData, null, 2)).then(() => {
      document.getElementById('btnCopy').innerHTML = '<i class="fa-solid fa-check"></i> COPIADO';
      setTimeout(() => document.getElementById('btnCopy').innerHTML = '<i class="fa-solid fa-copy"></i> COPIAR', 2000);
    });
  });

  document.getElementById('btnImport').addEventListener('click', async () => {
    if (!extractedData) return;
    await swalDark.fire({
      title: '<i class="fa-solid fa-magnifying-glass"></i> Verificando registros…',
      html: `<div id="checkList" style="text-align:left;margin-top:8px;"></div>`,
      showConfirmButton: false, allowOutsideClick: false,
      didOpen: async () => {
        const list = document.getElementById('checkList');
        list.innerHTML = '<div style="color:#4a5e47;font-size:12px;font-family:monospace;">Consultando banco de dados…</div>';
        await delay(600);
        try {
          const checks = await api('POST', '/api/importar/verificar', {
            fornecedor: extractedData.fornecedor,
            faturado:   extractedData.faturado,
            classificacoesDespesa: extractedData.classificacoesDespesa
          });
          list.innerHTML = '';
          for (const item of checks) {
            await delay(350);
            const div = document.createElement('div');
            div.className = 'check-item';
            div.innerHTML = `
              <span class="check-icon">${item.existe ? '<i class="fa-solid fa-circle-check" style="color:#6dde4a;"></i>' : '<i class="fa-solid fa-circle-plus" style="color:#d4a843;"></i>'}</span>
              <div class="check-body">
                <div class="check-entity">${item.entidade}</div>
                <div class="check-name">${item.nome || '—'}</div>
                ${item.doc ? `<div style="font-size:11px;color:#4a5e47;font-family:monospace;">${item.doc}</div>` : ''}
                <div class="check-status ${item.existe ? 'existe' : 'nao'}">
                  ${item.existe ? `✓ EXISTE — ID: ${item.id}` : '✗ NÃO EXISTE — será criado'}
                </div>
              </div>`;
            list.appendChild(div);
          }
          await delay(400);
          Swal.update({ showConfirmButton: true, confirmButtonText: '<i class="fa-solid fa-rocket"></i> CONFIRMAR IMPORTAÇÃO', showCancelButton: true, cancelButtonText: 'CANCELAR', allowOutsideClick: true });
        } catch (e) {
          list.innerHTML = `<div style="color:#e05555;">Erro: ${e.message}</div>`;
          Swal.update({ showConfirmButton: false, showCancelButton: true, cancelButtonText: 'FECHAR', allowOutsideClick: true });
        }
      }
    }).then(async result => {
      if (!result.isConfirmed) return;
      swalDark.fire({ title: '<i class="fa-solid fa-spinner fa-spin"></i> Importando…', html: '<div style="color:#8fab84;font-size:13px;font-family:monospace;">Criando registros…</div>', showConfirmButton: false, allowOutsideClick: false });
      try {
        const resp = await api('POST', '/api/importar', {
          ...extractedData,
          parcelas: extractedData.parcelas?.map(p => ({ dataVencimento: p.dataVencimento, valor: p.valor }))
        });
        const mov = resp.movimento;
        const log = resp.log || [];
        const logHtml = log.map(l => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #1e2c1b;">
            <span>${l.status === 'CRIADO' ? '<i class="fa-solid fa-circle-plus" style="color:#d4a843;"></i>' : '<i class="fa-solid fa-circle-check" style="color:#6dde4a;"></i>'}</span>
            <div>
              <div style="font-size:10px;color:#6dde4a;font-family:monospace;letter-spacing:.08em;">${l.entidade}</div>
              <div style="font-size:13px;color:#ddebd7;font-weight:600;">${l.nome}</div>
              <div style="font-size:11px;color:#4a5e47;font-family:monospace;">${l.status} · ID: ${l.id}</div>
            </div>
          </div>`).join('');
        swalDark.fire({
          icon: 'success',
          title: '<i class="fa-solid fa-circle-check"></i> Lançamento Registrado!',
          html: `<div style="text-align:left;">
            <div style="margin-bottom:12px;padding:10px 14px;background:rgba(109,222,74,.08);border:1px solid rgba(109,222,74,.2);border-radius:4px;">
              <div style="font-size:10px;color:#6dde4a;font-family:monospace;letter-spacing:.08em;margin-bottom:4px;">MOVIMENTO</div>
              <div style="font-size:14px;color:#ddebd7;font-weight:700;">NF ${mov.numero_documento || mov.id}</div>
              <div style="font-size:13px;color:#6dde4a;">R$ ${Number(mov.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div style="font-size:11px;color:#4a5e47;font-family:monospace;">ID: ${mov.id} · ${mov.parcelas?.length || 1} parcela(s)</div>
            </div>
            <div style="font-size:11px;color:#4a5e47;margin-bottom:6px;font-family:monospace;letter-spacing:.08em;">REGISTROS AFETADOS</div>
            ${logHtml}
          </div>`,
          confirmButtonText: 'FECHAR', width: 500,
        });
        loadMovimentos(1, 'tbodyApagar');
      } catch (e) {
        swalDark.fire({ icon: 'error', title: 'Erro na importação', text: e.message });
      }
    });
  });

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const card = tab.closest('.card');
      card.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      card.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab)?.classList.add('active');
    });
  });
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(',')[1]);
    r.onerror = () => rej(new Error('Falha ao ler arquivo'));
    r.readAsDataURL(file);
  });
}

async function pdfToText(file) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
  const ab  = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  let text  = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(x => x.str).join(' ') + '\n\n';
  }
  return text.trim();
}

function renderResults(data) {
  document.getElementById('resultsCard').style.display = 'block';
  document.getElementById('jsonOutput').innerHTML = syntaxHL(JSON.stringify(data, null, 2));
  const fv = document.getElementById('formattedView');
  fv.innerHTML = `
    <div class="field-group">
      <div class="field-group-title"><i class="fa-solid fa-file-lines"></i> Nota Fiscal</div>
      <div class="fields">
        <div><div class="field-label">Número</div><div class="field-value hl">${data.numeroNotaFiscal || '—'}</div></div>
        <div><div class="field-label">Emissão</div><div class="field-value">${data.dataEmissao || '—'}</div></div>
        <div><div class="field-label">Valor Total</div><div class="field-value hl">R$ ${Number(data.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></div>
        <div><div class="field-label">Parcelas</div><div class="field-value">${data.quantidadeParcelas || 1}</div></div>
      </div>
    </div>
    <div class="field-group">
      <div class="field-group-title"><i class="fa-solid fa-industry"></i> Fornecedor</div>
      <div class="fields">
        <div><div class="field-label">Razão Social</div><div class="field-value">${data.fornecedor?.razaoSocial || '—'}</div></div>
        <div><div class="field-label">Fantasia</div><div class="field-value">${data.fornecedor?.fantasia || '—'}</div></div>
        <div><div class="field-label">CNPJ</div><div class="field-value hl">${data.fornecedor?.cnpj || '—'}</div></div>
      </div>
    </div>
    <div class="field-group">
      <div class="field-group-title"><i class="fa-solid fa-user"></i> Faturado</div>
      <div class="fields">
        <div><div class="field-label">Nome</div><div class="field-value">${data.faturado?.nomeCompleto || '—'}</div></div>
        <div><div class="field-label">CPF/CNPJ</div><div class="field-value hl">${data.faturado?.cpf_cnpj || '—'}</div></div>
      </div>
    </div>
    ${data.descricaoProdutos ? `<div class="field-group"><div class="field-group-title"><i class="fa-solid fa-cart-shopping"></i> Produtos</div><div style="font-size:13px;color:var(--text);">${data.descricaoProdutos}</div></div>` : ''}
    ${data.classificacoesDespesa?.length ? `<div class="field-group"><div class="field-group-title"><i class="fa-solid fa-tag"></i> Classificação de Despesa</div><div>${data.classificacoesDespesa.map(c => `<span class="tag">${c}</span>`).join('')}</div></div>` : ''}
    ${data.parcelas?.length ? `
    <div class="field-group">
      <div class="field-group-title"><i class="fa-solid fa-credit-card"></i> Parcelas</div>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Vencimento</th><th>Valor</th></tr></thead>
        <tbody>${data.parcelas.map(p => `<tr><td class="td-mono">${p.numeroParcela}</td><td class="td-mono">${p.dataVencimento || '—'}</td><td class="td-mono" style="color:var(--accent);">R$ ${Number(p.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>` : ''}
  `;
  document.getElementById('resultsCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
