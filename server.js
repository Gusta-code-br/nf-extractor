require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const path = require('path');

const AI_PROVIDER = process.env.AI_PROVIDER?.toLowerCase() || 'anthropic';
const HUGGINGFACE_MODEL = process.env.HUGGINGFACE_MODEL || 'google/flan-t5-large';
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_MODEL = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

console.log(`🚀 Provedor AI selecionado: ${AI_PROVIDER}`);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Função auxiliar: extrair JSON com segurança ──────────────────────────────
function extractJSON(text) {
  if (!text) return null;

  // tenta achar primeiro bloco JSON
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// ─── Função auxiliar: retry ───────────────────────────────────────────────────
async function withRetry(fn, attempts = 2) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      console.warn(`⚠️ Tentativa ${i + 1} falhou, tentando novamente...`);
    }
  }
}

// ─── Rota de extração ─────────────────────────────────────────────────────────
app.post('/api/extract', async (req, res) => {
  const { base64, mediaType, text } = req.body;

  if (AI_PROVIDER === 'anthropic' && !base64) {
    return res.status(400).json({ error: 'Arquivo não enviado.' });
  }

  if (AI_PROVIDER !== 'anthropic' && !text) {
    return res.status(400).json({ error: 'Texto extraído do PDF não enviado.' });
  }

  try {
    let rawText;

    if (AI_PROVIDER === 'anthropic') {
      rawText = await extractWithAnthropic(base64, mediaType);
    } else if (AI_PROVIDER === 'huggingface') {
      rawText = await extractWithHuggingFace(text);
    } else if (AI_PROVIDER === 'gemini') {
      rawText = await extractWithGemini(text);
    } else if (AI_PROVIDER === 'openai') {
      rawText = await extractWithOpenAI(text);
    } else {
      return res.status(500).json({ error: `Provedor AI desconhecido: ${AI_PROVIDER}` });
    }

    console.log('🧠 RAW IA:', rawText);

    if (!rawText || rawText.trim() === '') {
      return res.status(422).json({ error: 'Resposta vazia da IA.' });
    }

    const parsed = extractJSON(rawText);

    if (!parsed) {
      return res.status(422).json({
        error: 'IA não retornou JSON válido.',
        raw: rawText
      });
    }

    return res.json({ data: parsed });
  } catch (err) {
    console.error('❌ Erro IA:', err);

    if (err.status === 401) {
      return res.status(401).json({ error: 'API Key inválida.' });
    }

    if (err.status === 429) {
      return res.status(429).json({ error: 'Limite de requisições atingido.' });
    }

    return res.status(500).json({
      error: err.message || 'Erro interno ao processar.'
    });
  }
});

function buildPrompt() {
  return `
    Retorne APENAS JSON válido.\nO JSON deve começar com { e terminar com }.\n 
    A classificação de despesa deve ser preenchida por você com base no produto/serviço identificado.\n
    Não inclua explicações, markdown ou texto fora do JSON.\n\n
    Formato obrigatório:\n{\n
      "fornecedor": {\n    "razaoSocial": "string",\n    "fantasia": "string ou null",\n    "cnpj": "string"\n  },\n  "faturado": {\n    "nomeCompleto": "string",\n    "cpf_Cnpj": "string ou null"\n  },\n  "numeroNotaFiscal": "string",\n  "dataEmissao": "string",\n  "descricaoProdutos": "string",\n  "parcelas": [],\n  "quantidadeParcelas": 1,\n  "valorTotal": 0,\n  "classificacoesDespesa": []\n}
      \n`;
}

async function extractWithAnthropic(base64, mediaType) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada.');
  }

  const client = new Anthropic({ apiKey });

  const message = await withRetry(() =>
    client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: mediaType || 'application/pdf',
              data: base64
            }
          },
          { type: 'text', text: buildPrompt() }
        ]
      }]
    })
  );

  return message.content.map(b => b.text || '').join('');
}

async function extractWithHuggingFace(text) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error('HUGGINGFACE_API_KEY não configurada.');
  }

  const response = await withRetry(() =>
    fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(HUGGINGFACE_MODEL)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: `${buildPrompt()}\n\nTexto da nota fiscal:\n${text}`,
        options: { wait_for_model: true, use_cache: false }
      })
    })
  );

  const result = await response.json();
  if (!response.ok) {
    const errMsg = result.error || JSON.stringify(result);
    throw new Error(`Hugging Face retornou erro: ${errMsg}`);
  }

  if (Array.isArray(result)) {
    return result[0]?.generated_text || '';
  }

  return result.generated_text || result[0]?.generated_text || '';
}

async function makeGeminiRequest(apiKey, model, text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${buildPrompt()}\n\nTexto da nota fiscal:\n${text}` }]
      }],
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.2,
        candidateCount: 1
      }
    })
  });

  const textBody = await response.text();
  let result;

  if (!response.ok) {
    let errMsg = textBody;
    try {
      result = JSON.parse(textBody);
      errMsg = result.error?.message || JSON.stringify(result);
    } catch {
      // Use raw response body if parsing fails.
    }
    const error = new Error(`Gemini retornou erro HTTP ${response.status}: ${errMsg}`);
    error.status = response.status;
    error.model = model;
    throw error;
  }

  try {
    result = JSON.parse(textBody);
  } catch {
    throw new Error(`Gemini retornou resposta inválida: ${textBody}`);
  }

  return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function extractWithGemini(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada.');
  }

  const modelsToTry = [GEMINI_MODEL];
  if (!modelsToTry.includes('gemini-2.5-flash')) {
    modelsToTry.push('gemini-2.5-flash');
  }

  let lastError = null;
  for (const model of modelsToTry) {
    try {
      return await withRetry(() => makeGeminiRequest(apiKey, model, text));
    } catch (err) {
      lastError = err;
      if (err.status === 404 && model !== modelsToTry[modelsToTry.length - 1]) {
        console.warn(`⚠ Modelo '${model}' não encontrado. Tentando fallback com '${modelsToTry[modelsToTry.length - 1]}'.`);
        continue;
      }
      if (err.status === 404 && model === modelsToTry[modelsToTry.length - 1]) {
        throw new Error(`Gemini retornou 404 para os modelos testados: ${modelsToTry.join(', ')}. Verifique se sua API key e projeto Google têm acesso a esses modelos.`);
      }
      throw err;
    }
  }

  throw lastError;
}

async function extractWithOpenAI(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada.');
  }

  const client = new OpenAI({ apiKey });

  const response = await withRetry(() =>
    client.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 1000,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: `${buildPrompt()}\n\nTexto da nota fiscal:\n${text}`
        }
      ]
    })
  );

  return response.choices[0]?.message?.content || '';
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
