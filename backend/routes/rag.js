const express = require('express');
const router = express.Router();
const db = require('../db/index');

const DB_SCHEMA = `
Banco de dados PostgreSQL — sistema administrativo-financeiro agrícola.

TABELAS:

fornecedores(id, razao_social, fantasia, cnpj, ativo, criado_em, atualizado_em)

clientes(id, razao_social, fantasia, cnpj, ativo, criado_em, atualizado_em)

faturados(id, nome_completo, cpf, ativo, criado_em, atualizado_em)

classificacao(id, tipo, descricao, ativo, criado_em, atualizado_em)
  — tipo: 'DESPESA' ou 'RECEITA'
  — Categorias DESPESA: INSUMOS AGRÍCOLAS, MANUTENÇÃO E OPERAÇÃO, RECURSOS HUMANOS,
    SERVIÇOS OPERACIONAIS, INFRAESTRUTURA E UTILIDADES, ADMINISTRATIVAS,
    SEGUROS E PROTEÇÃO, IMPOSTOS E TAXAS, INVESTIMENTOS

movimentocontas(id, tipo_lancamento, descricao, valor_total, data_emissao,
                numero_documento, fornecedor_id, cliente_id, faturado_id, ativo, criado_em, atualizado_em)
  — tipo_lancamento: 1 = Contas a Pagar (Despesa), 2 = Contas a Receber (Receita)
  — valor_total: NUMERIC(12,2)
  — data_emissao: DATE

classificacao_movimento(id, movimento_id, classificacao_id)
  — Relação N:N entre movimentocontas e classificacao

parcelacontas(id, movimento_id, identificacao, numero_parcela, data_vencimento,
              valor, status, data_pagamento, criado_em, atualizado_em)
  — status: 'PENDENTE' ou 'PAGO'
  — valor: NUMERIC(12,2)
`;

async function callLLM(systemPrompt, userMessage) {
  const provider = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();

  if (provider === 'anthropic') {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    });
    return resp.content[0].text;
  }

  if (provider === 'openai') {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      max_tokens: 2048,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    });
    return resp.choices[0].message.content;
  }

  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userMessage }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.3 }
        })
      }
    );
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || `Gemini HTTP ${resp.status}`);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  throw new Error(`Provedor não suportado para RAG: ${provider}`);
}

function validateSQL(sql) {
  const clean = sql.trim().toUpperCase()
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  if (!clean.trimStart().startsWith('SELECT')) {
    throw new Error('Apenas queries SELECT são permitidas.');
  }
  for (const kw of ['DROP','DELETE','INSERT','UPDATE','TRUNCATE','ALTER','CREATE','GRANT','REVOKE','EXECUTE','EXEC','COPY']) {
    if (new RegExp(`\\b${kw}\\b`).test(clean)) {
      throw new Error(`Operação não permitida detectada: ${kw}`);
    }
  }
}

// ── POST /api/rag/query — RAG Simples (Text-to-SQL) ──────────────
router.post('/query', async (req, res) => {
  const { pergunta } = req.body;
  if (!pergunta?.trim()) return res.status(400).json({ error: 'Pergunta não informada.' });

  try {
    const sqlSystem = `Você é especialista em SQL/PostgreSQL para sistema financeiro agrícola brasileiro.
Dado o schema abaixo, gere APENAS uma query SQL SELECT para responder à pergunta do usuário.

REGRAS OBRIGATÓRIAS:
- Retorne SOMENTE o SQL puro, sem markdown (sem \`\`\`), sem comentários, sem explicações
- Use apenas SELECT — nunca INSERT, UPDATE, DELETE, DROP ou similares
- Adicione LIMIT 50 em queries sem filtro específico por ID
- Use ILIKE para buscas de texto (case-insensitive)
- Use TO_CHAR(data_emissao, 'DD/MM/YYYY') para exibir datas formatadas
- Use alias legíveis nos campos do SELECT (ex: valor_total AS "Valor Total")
- Para totais monetários: SUM(valor_total::numeric)

${DB_SCHEMA}`;

    const rawSql = await callLLM(sqlSystem, pergunta);
    const sql = rawSql.replace(/```sql\s*/gi, '').replace(/```\s*/g, '').trim();

    validateSQL(sql);

    const { rows } = await db.query(sql);

    const answerSystem = `Você é assistente financeiro especializado em sistemas agrícolas brasileiros.
Analise os dados retornados e responda à pergunta de forma clara, organizada e elaborada em português.
- Formate valores monetários como R$ X.XXX,XX
- Formate datas como DD/MM/YYYY
- Use listas com marcadores para múltiplos itens
- Use negrito (**texto**) para destacar valores e informações importantes
- Se não houver dados, informe claramente que nenhum registro foi encontrado
- Seja objetivo mas completo`;

    const answerMsg = `Pergunta: ${pergunta}

SQL executado:
${sql}

Resultado (${rows.length} registro${rows.length !== 1 ? 's' : ''}):
${JSON.stringify(rows.slice(0, 30), null, 2)}${rows.length > 30 ? `\n\n(Exibindo 30 de ${rows.length} registros)` : ''}`;

    const resposta = await callLLM(answerSystem, answerMsg);

    res.json({ tipo: 'simples', pergunta, sql, registros: rows.length, dados: rows.slice(0, 50), resposta });
  } catch (err) {
    console.error('❌ RAG Simples:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Embedding store (in-memory) ──────────────────────────────────
let embeddingStore = null;
let indexedAt = null;

async function getEmbedding(text) {
  if (process.env.OPENAI_API_KEY) {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const resp = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8192)
    });
    return resp.data[0].embedding;
  }

  // Fallback: TF-IDF hash vector (512 dimensões)
  const words = text.toLowerCase()
    .replace(/[^a-záéíóúàâêôãõçüñ0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
  const vec = new Float32Array(512).fill(0);
  for (const word of words) {
    let h = 5381;
    for (let i = 0; i < word.length; i++) h = ((h << 5) + h) ^ word.charCodeAt(i);
    vec[Math.abs(h) % 512] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return Array.from(vec).map(v => v / norm);
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na * nb) || 1);
}

async function buildEmbeddingIndex() {
  const chunks = [];

  const { rows: movs } = await db.query(`
    SELECT
      m.id, m.tipo_lancamento, m.descricao, m.valor_total,
      m.data_emissao, m.numero_documento,
      f.razao_social AS fornecedor, f.cnpj AS fornecedor_cnpj,
      c.razao_social AS cliente,
      ft.nome_completo AS faturado,
      STRING_AGG(DISTINCT cl.descricao, ', ') AS classificacoes,
      SUM(CASE WHEN pc.status = 'PAGO'     THEN pc.valor ELSE 0 END) AS valor_pago,
      SUM(CASE WHEN pc.status = 'PENDENTE' THEN pc.valor ELSE 0 END) AS valor_pendente
    FROM movimentocontas m
    LEFT JOIN fornecedores f ON m.fornecedor_id = f.id
    LEFT JOIN clientes c ON m.cliente_id = c.id
    LEFT JOIN faturados ft ON m.faturado_id = ft.id
    LEFT JOIN classificacao_movimento cm ON cm.movimento_id = m.id
    LEFT JOIN classificacao cl ON cl.id = cm.classificacao_id
    LEFT JOIN parcelacontas pc ON pc.movimento_id = m.id
    WHERE m.ativo = true
    GROUP BY m.id, f.razao_social, f.cnpj, c.razao_social, ft.nome_completo
    ORDER BY m.data_emissao DESC
    LIMIT 200
  `);

  for (const m of movs) {
    const tipo = m.tipo_lancamento === 1 ? 'Contas a Pagar' : 'Contas a Receber';
    const valor = parseFloat(m.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const data  = m.data_emissao ? new Date(m.data_emissao).toLocaleDateString('pt-BR') : '—';
    const vPago = parseFloat(m.valor_pago || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const vPend = parseFloat(m.valor_pendente || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const text = [
      `Lançamento ${tipo} NF ${m.numero_documento || 'S/N'} data ${data} valor ${valor}`,
      m.fornecedor ? `Fornecedor ${m.fornecedor} CNPJ ${m.fornecedor_cnpj}` : null,
      m.cliente    ? `Cliente ${m.cliente}` : null,
      m.faturado   ? `Faturado para ${m.faturado}` : null,
      m.descricao  ? `Produtos servicos ${m.descricao}` : null,
      m.classificacoes ? `Categorias ${m.classificacoes}` : null,
      `Pago ${vPago} Pendente ${vPend}`
    ].filter(Boolean).join(' | ');

    chunks.push({
      id: `mov_${m.id}`,
      text,
      resumo: `NF ${m.numero_documento || 'S/N'} — ${tipo} — ${valor} — ${data}`,
      meta: { tipo_registro: 'movimento', tipo_lancamento: tipo, ...m }
    });
  }

  const { rows: forns } = await db.query(
    `SELECT id, razao_social, fantasia, cnpj FROM fornecedores WHERE ativo = true LIMIT 100`
  );
  for (const f of forns) {
    const text = `Fornecedor ${f.razao_social}${f.fantasia ? ` fantasia ${f.fantasia}` : ''} CNPJ ${f.cnpj}`;
    chunks.push({ id: `forn_${f.id}`, text, resumo: f.razao_social, meta: { tipo_registro: 'fornecedor', ...f } });
  }

  const { rows: clts } = await db.query(
    `SELECT id, razao_social, fantasia, cnpj FROM clientes WHERE ativo = true LIMIT 100`
  );
  for (const c of clts) {
    const text = `Cliente ${c.razao_social}${c.fantasia ? ` fantasia ${c.fantasia}` : ''} CNPJ ${c.cnpj}`;
    chunks.push({ id: `cli_${c.id}`, text, resumo: c.razao_social, meta: { tipo_registro: 'cliente', ...c } });
  }

  for (const chunk of chunks) {
    chunk.embedding = await getEmbedding(chunk.text);
  }

  return chunks;
}

// ── POST /api/rag/embeddings/indexar ─────────────────────────────
router.post('/embeddings/indexar', async (req, res) => {
  try {
    embeddingStore = await buildEmbeddingIndex();
    indexedAt = new Date();
    const metodo = process.env.OPENAI_API_KEY ? 'openai-text-embedding-3-small' : 'tfidf-hash-512';
    res.json({ success: true, chunks: embeddingStore.length, indexado_em: indexedAt, metodo });
  } catch (err) {
    console.error('❌ Indexação embeddings:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/rag/embeddings/query ───────────────────────────────
router.post('/embeddings/query', async (req, res) => {
  const { pergunta } = req.body;
  if (!pergunta?.trim()) return res.status(400).json({ error: 'Pergunta não informada.' });

  try {
    if (!embeddingStore) {
      embeddingStore = await buildEmbeddingIndex();
      indexedAt = new Date();
    }

    const queryVec = await getEmbedding(pergunta);

    const scored = embeddingStore
      .map(c => ({ ...c, score: cosine(queryVec, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const context = scored.map((c, i) => `[${i + 1}] ${c.text}`).join('\n\n');

    const system = `Você é assistente financeiro especializado em sistemas agrícolas brasileiros.
Use APENAS as informações do contexto abaixo para responder à pergunta.
Se a informação não estiver no contexto, informe claramente que não encontrou.
Responda em português de forma clara, organizada e elaborada.
Formate valores como R$ X.XXX,XX e datas como DD/MM/YYYY.
Use listas quando houver múltiplos itens.`;

    const msg = `Pergunta: ${pergunta}

Contexto recuperado por similaridade semântica (${scored.length} registros mais relevantes):
${context}`;

    const resposta = await callLLM(system, msg);

    res.json({
      tipo: 'embeddings',
      pergunta,
      chunks_encontrados: scored.length,
      contexto: scored.map(c => ({
        id: c.id,
        resumo: c.resumo,
        texto: c.text,
        similaridade: parseFloat(c.score.toFixed(4))
      })),
      resposta,
      indexado_em: indexedAt
    });
  } catch (err) {
    console.error('❌ RAG Embeddings query:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/rag/status ──────────────────────────────────────────
router.get('/status', (_req, res) => {
  res.json({
    embedding_index: embeddingStore
      ? { chunks: embeddingStore.length, indexado_em: indexedAt }
      : null,
    provider: process.env.AI_PROVIDER || 'anthropic',
    embedding_metodo: process.env.OPENAI_API_KEY ? 'openai-text-embedding-3-small' : 'tfidf-hash-512'
  });
});

module.exports = router;
