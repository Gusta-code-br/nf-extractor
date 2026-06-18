// ── AUTH CHECK ─────────────────────────────────────────────────
const _token = localStorage.getItem('gp_token');
const _user  = JSON.parse(localStorage.getItem('gp_user') || 'null');
if (!_token || !_user) { window.location.href = '/login.html'; }

// ── SWAL DARK ──────────────────────────────────────────────────
const swalDark = Swal.mixin({
  background: '#0f130e', color: '#ddebd7',
  confirmButtonColor: '#6dde4a', cancelButtonColor: '#263024',
  customClass: { popup: 'swl-popup', confirmButton: 'swl-confirm', cancelButton: 'swl-cancel', title: 'swl-title' }
});
(() => {
  const s = document.createElement('style');
  s.textContent = `.swl-popup{border:1px solid #263024!important;border-radius:8px!important;font-family:'Space Grotesk',sans-serif!important}.swl-title{color:#ddebd7!important;font-size:16px!important}.swl-confirm{font-family:'Space Grotesk',sans-serif!important;font-weight:700!important;font-size:12px!important;letter-spacing:.06em!important;color:#050805!important;border-radius:4px!important}.swl-cancel{font-family:'Space Grotesk',sans-serif!important;font-weight:600!important;font-size:12px!important;color:#8fab84!important;border-radius:4px!important;border:1px solid #2f3b2d!important}.swal2-html-container{color:#8fab84!important;font-size:13px!important}`;
  document.head.appendChild(s);
})();

// ── USER INFO ──────────────────────────────────────────────────
if (_user) {
  const userEl = document.getElementById('topbarUser');
  if (userEl) userEl.textContent = _user.nome + ' · ' + (_user.perfil_nome || '');
  if (_user.admin) {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
  }
}

// ── LOGOUT ─────────────────────────────────────────────────────
function logout() {
  localStorage.removeItem('gp_token');
  localStorage.removeItem('gp_user');
  window.location.href = '/login.html';
}

// ── STATE ──────────────────────────────────────────────────────
let selectedFile = null, extractedData = null;
let ragMode = 'simples', ragIndexInfo = null;
let _quitarId = null, _quitarVencimento = null;

// ── HELPERS ────────────────────────────────────────────────────
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}
function loadingRow(cols) { return `<tr><td colspan="${cols}"><div class="empty"><div class="empty-icon"><i class="fa-solid fa-rotate fa-spin"></i></div><div class="empty-text">Carregando…</div></div></td></tr>`; }
function emptyRow(cols, icon, msg) { return `<tr><td colspan="${cols}"><div class="empty"><div class="empty-icon">${icon}</div><div class="empty-text">${msg}</div></div></td></tr>`; }
function errorRow(cols, msg) { return `<tr><td colspan="${cols}"><div class="empty"><div class="empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><div class="empty-text">${msg}</div></div></td></tr>`; }
function syntaxHL(json) {
  return json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, m => {
      let c = 'j-num';
      if (/^"/.test(m)) c = /:$/.test(m) ? 'j-key' : 'j-str';
      else if (/true|false/.test(m)) c = 'j-bool';
      else if (/null/.test(m)) c = 'j-null';
      return `<span class="${c}">${m}</span>`;
    });
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── NAV ────────────────────────────────────────────────────────
const screenMeta = {
  dashboard:   ['Dashboard',               'Visão geral financeira'],
  nf:          ['Extração de Nota Fiscal', 'Carregue um PDF e extraia os dados com IA'],
  fornecedores:['Fornecedores',            'Cadastro e gestão de fornecedores'],
  clientes:    ['Clientes',                'Cadastro e gestão de clientes'],
  faturados:   ['Faturados',               'Cadastro de pessoas faturadas'],
  bancos:      ['Instituições Bancárias',  'Cadastro de bancos para quitação de parcelas'],
  despesas:    ['Tipo de Despesa',         'Classificações de despesas'],
  receitas:    ['Tipo de Receita',         'Classificações de receitas'],
  apagar:      ['Contas a Pagar',          'Lançamentos de contas a pagar — clique em ⌄ para ver parcelas'],
  areceber:    ['Contas a Receber',        'Lançamentos de contas a receber'],
  relatorio:   ['Relatório Financeiro',    'Relatório detalhado de parcelas com filtros'],
  rag:         ['Assistente IA',           'Consultas inteligentes com RAG sobre seus dados financeiros'],
  usuarios:    ['Usuários',                'Gerenciamento de usuários do sistema'],
  perfis:      ['Perfis de Acesso',        'Gerenciamento de perfis e permissões'],
};

document.getElementById('topbarDate').textContent =
  new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const screen = item.dataset.screen;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('screen-' + screen).classList.add('active');
    const [t, sub] = screenMeta[screen] || ['', ''];
    document.getElementById('topbarTitle').textContent = t;
    document.getElementById('topbarSub').textContent   = sub;
    loadScreen(screen);
  });
});

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
});

function navTo(screen) {
  const item = document.querySelector(`.nav-item[data-screen="${screen}"]`);
  if (item) item.click();
}

function loadScreen(s) {
  if (s === 'dashboard')    loadDashboard();
  if (s === 'fornecedores') loadFornecedores();
  if (s === 'clientes')     loadClientes();
  if (s === 'faturados')    loadFaturados();
  if (s === 'bancos')       loadBancos();
  if (s === 'despesas')     loadClassifs('DESPESA',  'tbodyDespesas');
  if (s === 'receitas')     loadClassifs('RECEITA',  'tbodyReceitas');
  if (s === 'apagar')       loadMovimentos(1, 'tbodyApagar');
  if (s === 'areceber')     loadMovimentos(0, 'tbodyAreceber');
  if (s === 'relatorio')    loadRelatorio('apagar');
  if (s === 'rag')          initRag();
  if (s === 'usuarios')     loadUsuarios();
  if (s === 'perfis')       loadPerfis();
}

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  initNF();
});
