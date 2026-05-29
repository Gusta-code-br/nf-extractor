require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const path = require('path');

const AI_PROVIDER    = process.env.AI_PROVIDER?.toLowerCase() || 'anthropic';
const HUGGINGFACE_MODEL = process.env.HUGGINGFACE_MODEL || 'google/flan-t5-large';
const GEMINI_MODEL   = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const OPENAI_MODEL   = process.env.OPENAI_MODEL || 'gpt-4o-mini';

console.log(`🚀 Provedor AI: ${AI_PROVIDER}`);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Rotas ──────────────────────────────────────────────────────
app.use('/api/fornecedores',   require('./routes/fornecedores'));
app.use('/api/clientes',       require('./routes/clientes'));
app.use('/api/faturados',      require('./routes/faturados'));
app.use('/api/classificacoes', require('./routes/classificacoes'));
app.use('/api/movimentos',     require('./routes/movimentos'));
app.use('/api/importar',       require('./routes/importar'));

// ── Helpers ────────────────────────────────────────────────────
function extractJSON(text) {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

async function withRetry(fn, attempts = 2) {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === attempts - 1) throw err;
      console.warn(`⚠️ Tentativa ${i + 1} falhou, retentando...`);
    }
  }
}

// ── Prompt ─────────────────────────────────────────────────────
function buildPrompt() {
  return `
Você é um extrator especializado de dados de notas fiscais brasileiras para um sistema agrícola.

INSTRUÇÕES CRÍTICAS:
- Retorne APENAS JSON válido, começando com { e terminando com }
- Sem markdown, sem explicações, sem texto fora do JSON
- Todos os campos devem ser preenchidos; use null quando não encontrar o dado

CLASSIFICAÇÃO DE DESPESA (campo classificacoesDespesa):
Analise os produtos/serviços da nota e classifique em uma ou mais das categorias abaixo.
Retorne um array de strings com os nomes exatos das categorias:

- "INSUMOS AGRÍCOLAS" → sementes, fertilizantes, defensivos agrícolas, corretivos
- "MANUTENÇÃO E OPERAÇÃO" → combustíveis, lubrificantes, peças, parafusos, componentes mecânicos, manutenção de máquinas, pneus, filtros, correias, ferramentas, utensílios
- "RECURSOS HUMANOS" → mão de obra temporária, salários, encargos
- "SERVIÇOS OPERACIONAIS" → frete, transporte, colheita terceirizada, secagem, armazenagem, pulverização, aplicação
- "INFRAESTRUTURA E UTILIDADES" → energia elétrica, arrendamento de terras, construções, reformas, materiais de construção
- "ADMINISTRATIVAS" → honorários contábeis, advocatícios, agronômicos, despesas bancárias, financeiras
- "SEGUROS E PROTEÇÃO" → seguro agrícola, seguro de ativos, máquinas, veículos, seguro prestamista
- "IMPOSTOS E TAXAS" → ITR, IPTU, IPVA, INCRA-CCIR
- "INVESTIMENTOS" → aquisição de máquinas, implementos, veículos, imóveis, infraestrutura rural

FORMATO DE SAÍDA OBRIGATÓRIO:
{
  "fornecedor": {
    "razaoSocial": "string — razão social completa da empresa emissora",
    "fantasia": "string ou null — nome fantasia se houver",
    "cnpj": "string — CNPJ formatado como XX.XXX.XXX/XXXX-XX"
  },
  "faturado": {
    "nomeCompleto": "string — nome completo do destinatário/tomador",
    "cpf_cnpj": "string ou null — CPF formatado como XXX.XXX.XXX-XX ou CNPJ"
  },
  "numeroNotaFiscal": "string — número da NF",
  "dataEmissao": "string — data no formato YYYY-MM-DD",
  "descricaoProdutos": "string — descrição resumida dos produtos/serviços",
  "quantidadeParcelas": 1,
  "valorTotal": 0.00,
  "parcelas": [
    {
      "numeroParcela": 1,
      "dataVencimento": "YYYY-MM-DD",
      "valor": 0.00
    }
  ],
  "classificacoesDespesa": ["CATEGORIA EXATA"]
}
`.trim();
}

// ── Rota de extração ───────────────────────────────────────────
app.post('/api/extract', async (req, res) => {
  const { base64, mediaType, text } = req.body;

  if (AI_PROVIDER === 'anthropic' && !base64)
    return res.status(400).json({ error: 'Arquivo não enviado.' });
  if (AI_PROVIDER !== 'anthropic' && !text)
    return res.status(400).json({ error: 'Texto do PDF não enviado.' });

  try {
    let rawText;
    if      (AI_PROVIDER === 'anthropic')   rawText = await extractWithAnthropic(base64, mediaType);
    else if (AI_PROVIDER === 'huggingface') rawText = await extractWithHuggingFace(text);
    else if (AI_PROVIDER === 'gemini')      rawText = await extractWithGemini(text);
    else if (AI_PROVIDER === 'openai')      rawText = await extractWithOpenAI(text);
    else return res.status(500).json({ error: `Provedor desconhecido: ${AI_PROVIDER}` });

    console.log('🧠 RAW IA:', rawText?.slice(0, 200));
    if (!rawText?.trim()) return res.status(422).json({ error: 'Resposta vazia da IA.' });

    const parsed = extractJSON(rawText);
    if (!parsed) return res.status(422).json({ error: 'IA não retornou JSON válido.', raw: rawText });

    return res.json({ data: parsed });
  } catch (err) {
    console.error('❌ Erro IA:', err);
    if (err.status === 401) return res.status(401).json({ error: 'API Key inválida.' });
    if (err.status === 429) return res.status(429).json({ error: 'Rate limit atingido.' });
    return res.status(500).json({ error: err.message || 'Erro interno.' });
  }
});

// ── Providers ──────────────────────────────────────────────────
async function extractWithAnthropic(base64, mediaType) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada.');
  const client = new Anthropic({ apiKey });
  const message = await withRetry(() =>
    client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: mediaType || 'application/pdf', data: base64 } },
          { type: 'text', text: buildPrompt() }
        ]
      }]
    })
  );
  return message.content.map(b => b.text || '').join('');
}

async function extractWithHuggingFace(text) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) throw new Error('HUGGINGFACE_API_KEY não configurada.');
  const response = await withRetry(() =>
    fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(HUGGINGFACE_MODEL)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: `${buildPrompt()}\n\nTexto da nota fiscal:\n${text}`, options: { wait_for_model: true } })
    })
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || JSON.stringify(result));
  return Array.isArray(result) ? result[0]?.generated_text || '' : result.generated_text || '';
}

async function makeGeminiRequest(apiKey, model, text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${buildPrompt()}\n\nTexto da nota fiscal:\n${text}` }] }],
      generationConfig: { maxOutputTokens: 1500, temperature: 0.1, candidateCount: 1 }
    })
  });
  const textBody = await response.text();
  if (!response.ok) {
    let errMsg = textBody;
    try { errMsg = JSON.parse(textBody).error?.message || textBody; } catch {}
    const error = new Error(`Gemini HTTP ${response.status}: ${errMsg}`);
    error.status = response.status;
    throw error;
  }
  const result = JSON.parse(textBody);
  return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function extractWithGemini(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada.');
  const models = [...new Set([GEMINI_MODEL, 'gemini-2.0-flash'])];
  let lastError;
  for (const model of models) {
    try { return await withRetry(() => makeGeminiRequest(apiKey, model, text)); }
    catch (err) {
      lastError = err;
      if (err.status !== 404) throw err;
      console.warn(`⚠ Modelo '${model}' não encontrado, tentando fallback...`);
    }
  }
  throw lastError;
}

async function extractWithOpenAI(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada.');
  const client = new OpenAI({ apiKey });
  const response = await withRetry(() =>
    client.chat.completions.create({
      model: OPENAI_MODEL, max_tokens: 1500, temperature: 0.1,
      messages: [{ role: 'user', content: `${buildPrompt()}\n\nTexto da nota fiscal:\n${text}` }]
    })
  );
  return response.choices[0]?.message?.content || '';
}

// ── Start ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ http://localhost:${PORT}`));
