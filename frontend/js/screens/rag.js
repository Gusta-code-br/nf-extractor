function setRagMode(mode) {
  ragMode = mode;
  document.getElementById('ragModeSimples').classList.toggle('active', mode === 'simples');
  document.getElementById('ragModeEmbeddings').classList.toggle('active', mode === 'embeddings');
  document.getElementById('btnIndexar').style.display = mode === 'embeddings' ? '' : 'none';
  document.getElementById('ragModoLabel').textContent = mode === 'simples'
    ? 'MODO: RAG SIMPLES (TEXT-TO-SQL)'
    : 'MODO: RAG EMBEDDINGS (BUSCA VETORIAL)';
  atualizarStatusIndex();
}

function atualizarStatusIndex() {
  const el = document.getElementById('ragIndexStatus');
  if (ragMode === 'embeddings') {
    if (ragIndexInfo) {
      const dt = new Date(ragIndexInfo.indexado_em).toLocaleString('pt-BR');
      el.textContent = `ÍNDICE: ${ragIndexInfo.chunks} chunks · ${dt}`;
      el.style.color = 'var(--accent)';
    } else {
      el.textContent = 'ÍNDICE: não criado — clique em INDEXAR DADOS';
      el.style.color = 'var(--warning)';
    }
  } else {
    el.textContent = '';
  }
}

async function initRag() {
  try {
    const status = await api('GET', '/api/rag/status');
    if (status.embedding_index) {
      ragIndexInfo = status.embedding_index;
      atualizarStatusIndex();
    }
  } catch (_) {}
}

async function indexarDados() {
  const btn = document.getElementById('btnIndexar');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> INDEXANDO...';
  try {
    const result = await api('POST', '/api/rag/embeddings/indexar', {});
    ragIndexInfo = { chunks: result.chunks, indexado_em: result.indexado_em };
    atualizarStatusIndex();
    swalDark.fire({ icon: 'success', title: `Indexação concluída! ${result.chunks} chunks criados.`, text: `Método: ${result.metodo}`, timer: 2500, showConfirmButton: false });
  } catch (e) {
    swalDark.fire({ icon: 'error', title: 'Erro na indexação', text: e.message });
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> INDEXAR DADOS';
  }
}

function limparRag() {
  document.getElementById('ragChat').innerHTML = `
    <div class="rag-welcome">
      <div class="rag-welcome-icon"><i class="fa-solid fa-robot"></i></div>
      <div class="rag-welcome-text">
        <strong>Olá! Sou seu assistente financeiro com IA.</strong><br>
        Faça perguntas sobre seus dados em linguagem natural.<br>
        <span style="color:var(--muted);font-size:11px;margin-top:6px;display:block;">
          Exemplos: "Qual o total de despesas em insumos agrícolas?" · "Quais parcelas estão pendentes?"
        </span>
      </div>
    </div>`;
}

function ragEscape(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function ragMarkdown(text) {
  return ragEscape(text)
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-•]\s(.+)$/gm, '<span style="display:block;padding-left:12px;margin:2px 0;">• $1</span>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

function appendMsg(role, html) {
  const chat = document.getElementById('ragChat');
  const div = document.createElement('div');
  div.className = `rag-msg rag-msg-${role}`;
  div.innerHTML = html;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function toggleSql(id) {
  document.getElementById(id).classList.toggle('open');
}

async function enviarRag() {
  const input = document.getElementById('ragInput');
  const pergunta = input.value.trim();
  if (!pergunta) return;

  const btn = document.getElementById('btnRagEnviar');
  btn.disabled = true;
  input.disabled = true;
  input.value = '';

  appendMsg('user', `<div class="rag-bubble rag-bubble-user">${ragEscape(pergunta)}</div>`);

  const loadingDiv = appendMsg('ai', `
    <div class="rag-typing">
      <div class="rag-dots"><span></span><span></span><span></span></div>
      <span style="font-size:12px;color:var(--muted);">Processando com IA…</span>
    </div>`);

  try {
    let result;
    if (ragMode === 'simples') {
      result = await api('POST', '/api/rag/query', { pergunta });
    } else {
      result = await api('POST', '/api/rag/embeddings/query', { pergunta });
    }

    loadingDiv.remove();

    if (ragMode === 'simples') {
      const sqlId = 'sql_' + Date.now();
      appendMsg('ai', `
        <div>
          <div class="rag-bubble rag-bubble-ai">${ragMarkdown(result.resposta)}</div>
          <div class="rag-sql-block">
            <div class="rag-sql-header" onclick="toggleSql('${sqlId}')">
              <span class="rag-sql-label"><i class="fa-solid fa-code"></i> SQL gerado · ${result.registros} registro${result.registros !== 1 ? 's' : ''}</span>
              <i class="fa-solid fa-chevron-down" style="font-size:9px;color:var(--muted);"></i>
            </div>
            <pre class="rag-sql-body" id="${sqlId}">${ragEscape(result.sql)}</pre>
          </div>
          <div class="rag-meta"><i class="fa-solid fa-database"></i> RAG Simples · Text-to-SQL · ${result.registros} registro${result.registros !== 1 ? 's' : ''}</div>
        </div>`);
    } else {
      if (result.indexado_em) {
        ragIndexInfo = ragIndexInfo || {};
        ragIndexInfo.indexado_em = result.indexado_em;
        atualizarStatusIndex();
      }
      const chunksHtml = (result.contexto || []).slice(0, 5).map(c => `
        <div class="rag-chunk">
          <div class="rag-chunk-header">
            <span class="rag-chunk-id">${ragEscape(c.id)}</span>
            <span class="rag-chunk-score">sim: ${c.similaridade}</span>
          </div>
          <div class="rag-chunk-text">${ragEscape((c.resumo || c.texto || '').slice(0, 140))}${(c.texto || '').length > 140 ? '…' : ''}</div>
        </div>`).join('');

      appendMsg('ai', `
        <div>
          <div class="rag-bubble rag-bubble-ai">${ragMarkdown(result.resposta)}</div>
          <details class="rag-chunks-block">
            <summary><i class="fa-solid fa-network-wired"></i> ${result.chunks_encontrados} chunks recuperados por similaridade</summary>
            ${chunksHtml}
          </details>
          <div class="rag-meta"><i class="fa-solid fa-network-wired"></i> RAG Embeddings · ${result.chunks_encontrados} chunks</div>
        </div>`);
    }
  } catch (e) {
    loadingDiv.remove();
    appendMsg('ai', `<div class="rag-bubble rag-bubble-ai rag-bubble-error"><i class="fa-solid fa-triangle-exclamation"></i> Erro: ${ragEscape(e.message)}</div>`);
  } finally {
    btn.disabled = false;
    input.disabled = false;
    input.focus();
  }
}
