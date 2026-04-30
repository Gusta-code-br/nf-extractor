# 📄 Extrator de Nota Fiscal com IA

## Por que precisa de um servidor Node.js?

Chamar `api.anthropic.com` diretamente do navegador é **bloqueado por CORS** e
expõe sua API key no código-fonte. Este servidor atua como proxy seguro:

```
Navegador → POST /api/extract → server.js → API Anthropic → resposta
```

---

## Estrutura do projeto

```
nf-extractor/
├── server.js          ← servidor Express (backend/proxy)
├── package.json
└── public/
    ├── index.html     ← frontend
    └── css/
        └── style.css  ← cole aqui o seu style.css original
```

---

## Instalação e uso

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar a API Key

A forma mais simples é criar um arquivo `.env` na raiz do projeto com uma das chaves abaixo.

Para Anthropic:

```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-SUA_CHAVE_AQUI
```

Para Hugging Face (plano gratuito disponível):

```env
AI_PROVIDER=huggingface
HUGGINGFACE_API_KEY=hf_sua_chave_aqui
HUGGINGFACE_MODEL=google/flan-t5-large
```

Para Gemini:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy... # sua chave Google API com Generative AI API habilitada
GEMINI_MODEL=gemini-1.5-pro # use text-bison-001 se seu projeto não tiver acesso ao Gemini
```

Se preferir configurar direto no terminal:

**Linux / Mac:**
```bash
export AI_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-ant-SUA_CHAVE_AQUI
```

**Windows (PowerShell):**
```powershell
$env:AI_PROVIDER="anthropic"
$env:ANTHROPIC_API_KEY="sk-ant-SUA_CHAVE_AQUI"
```

> Obtenha sua chave Anthropic em: https://console.anthropic.com/settings/keys
>
> Obtenha sua chave Hugging Face em: https://huggingface.co/settings/tokens

### 3. Iniciar o servidor

```bash
npm start
```

### 4. Acessar no navegador

```
http://localhost:3000
```

---

## Onde colocar o style.css

Coloque o arquivo `style.css` em:

```
public/css/style.css
```

---

## Variáveis de ambiente opcionais

| Variável              | Padrão             | Descrição                                        |
|-----------------------|--------------------|--------------------------------------------------|
| `AI_PROVIDER`         | `anthropic`        | Provedor de IA: `anthropic`, `huggingface` ou `gemini` |
| `ANTHROPIC_API_KEY`   | —                  | Chave Anthropic (se `AI_PROVIDER=anthropic`)     |
| `HUGGINGFACE_API_KEY` | —                  | Chave Hugging Face (se `AI_PROVIDER=huggingface`) |
| `HUGGINGFACE_MODEL`   | `google/flan-t5-large` | Modelo Hugging Face para inferência         |
| `GEMINI_API_KEY`      | —                  | Chave Google API para Gemini (se `AI_PROVIDER=gemini`) |
| `GEMINI_MODEL`        | `gemini-1.5-pro`   | Modelo Gemini para inferência (ou `text-bison-001` se não houver acesso ao Gemini) |
| `PORT`                | `3000`             | Porta do servidor HTTP                           |
