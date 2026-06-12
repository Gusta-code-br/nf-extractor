require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { query, pool } = require('./db/index');

// ── Helpers ──────────────────────────────────────────────────────
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randVal = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(2));
const fmtCNPJ = (n) => String(n).padStart(14, '0').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
const fmtCPF  = (n) => String(n).padStart(11, '0').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function pastDate(daysAgo) {
  return addDays(new Date(), -randInt(0, daysAgo));
}

// ── Dados mestres ────────────────────────────────────────────────
const fornecedoresData = [
  { razao: 'Agro Insumos Cerrado Ltda',        fantasia: 'AgroCerrado',     cnpj: fmtCNPJ(11222333000181) },
  { razao: 'Fertilizantes Sul Brasil S/A',      fantasia: 'FertSul',         cnpj: fmtCNPJ(22333444000192) },
  { razao: 'Mecânica Rural Santos Ltda',        fantasia: 'MecRural',        cnpj: fmtCNPJ(33444555000103) },
  { razao: 'Combustíveis Horizonte Ltda',       fantasia: 'HorizFuel',       cnpj: fmtCNPJ(44555666000114) },
  { razao: 'Sementes Ouro Verde Ltda',          fantasia: 'OuroVerde',       cnpj: fmtCNPJ(55666777000125) },
  { razao: 'Defensivos Agro Planalto S/A',      fantasia: 'AgroPlanalto',    cnpj: fmtCNPJ(66777888000136) },
  { razao: 'Irrigação Técnica Brasil Ltda',     fantasia: 'IrrigaBrasil',    cnpj: fmtCNPJ(77888999000147) },
  { razao: 'Transporte Rural Rápido Ltda',      fantasia: 'TransRural',      cnpj: fmtCNPJ(88999000000158) },
  { razao: 'Armazéns Graneleiros Norte Ltda',   fantasia: 'GranelNorte',     cnpj: fmtCNPJ(99000111000169) },
  { razao: 'Energia Solar Campo Ltda',          fantasia: 'SolarCampo',      cnpj: fmtCNPJ(10111222000170) },
  { razao: 'Seguros Rurais Proteção S/A',       fantasia: 'ProteSeg',        cnpj: fmtCNPJ(20222333000181) },
  { razao: 'Contabilidade Agro Gestão Ltda',    fantasia: 'AgroGestão',      cnpj: fmtCNPJ(30333444000192) },
  { razao: 'Colheita Terceirizada Campo Ltda',  fantasia: 'CampoColheita',   cnpj: fmtCNPJ(40444555000103) },
  { razao: 'Pulverização Aérea Cerrado S/A',    fantasia: 'AeroCerrado',     cnpj: fmtCNPJ(50555666000114) },
  { razao: 'Calcário e Solo Brasil Ltda',       fantasia: 'CalSoloBrasil',   cnpj: fmtCNPJ(60666777000125) },
];

const clientesData = [
  { razao: 'Cooperativa Agrícola do Vale Ltda',  fantasia: 'CoopVale',    cnpj: fmtCNPJ(71777888000136) },
  { razao: 'Exportadora Grãos Brasil S/A',        fantasia: 'ExportGrãos', cnpj: fmtCNPJ(81888999000147) },
  { razao: 'Frigorífico Bom Corte Ltda',          fantasia: 'BomCorte',    cnpj: fmtCNPJ(91999000000158) },
  { razao: 'Processadora de Soja Centro Ltda',    fantasia: 'SojaCentro',  cnpj: fmtCNPJ(12000111000169) },
  { razao: 'Distribuidora Alimentos Nobre S/A',   fantasia: 'AlimNobre',   cnpj: fmtCNPJ(22111222000170) },
  { razao: 'Indústria de Óleos Vegetais Ltda',    fantasia: 'ÓleosVeg',    cnpj: fmtCNPJ(32222333000181) },
  { razao: 'Cerealista Vale do Rio Ltda',         fantasia: 'CerealRio',   cnpj: fmtCNPJ(42333444000192) },
  { razao: 'Atacadista Rural Primavera Ltda',     fantasia: 'RuralPrimav', cnpj: fmtCNPJ(52444555000103) },
];

const faturadosData = [
  { nome: 'Carlos Daniel Laporta Castro',  cpf: fmtCPF(12345678901) },
  { nome: 'Ana Paula Ferreira Silva',       cpf: fmtCPF(23456789012) },
  { nome: 'José Augusto Mendes Junior',    cpf: fmtCPF(34567890123) },
  { nome: 'Maria Oliveira Santos',          cpf: fmtCPF(45678901234) },
  { nome: 'Pedro Henrique Costa Neto',     cpf: fmtCPF(56789012345) },
];

const despesaClassifs = [
  'INSUMOS AGRÍCOLAS',
  'MANUTENÇÃO E OPERAÇÃO',
  'RECURSOS HUMANOS',
  'SERVIÇOS OPERACIONAIS',
  'INFRAESTRUTURA E UTILIDADES',
  'ADMINISTRATIVAS',
  'SEGUROS E PROTEÇÃO',
  'IMPOSTOS E TAXAS',
  'INVESTIMENTOS',
];

const receitaClassifs = [
  'VENDA DE SOJA',
  'VENDA DE MILHO',
  'VENDA DE ALGODÃO',
  'VENDA DE CAFÉ',
  'VENDA DE GADO',
  'ARRENDAMENTO',
  'OUTRAS RECEITAS',
];

// ── Descrições realistas por categoria ──────────────────────────
const descricoesPorClassif = {
  'INSUMOS AGRÍCOLAS':            ['Adubo NPK 20-05-20', 'Herbicida Roundup 20L', 'Inseticida Belt SC 100ml', 'Fungicida Priori Xtra 1L', 'Sementes de Soja 40kg', 'Calcário Dolomítico 500kg'],
  'MANUTENÇÃO E OPERAÇÃO':        ['Revisão Trator John Deere', 'Troca de óleo colheitadeira', 'Peças reposição pulverizador', 'Manutenção preventiva implementos', 'Reparo bomba irrigação'],
  'RECURSOS HUMANOS':             ['Folha de pagamento Abril', 'Encargos sociais Maio', 'Vale alimentação turma safra', 'Uniforme e EPI trabalhadores', 'FGTS competência Março'],
  'SERVIÇOS OPERACIONAIS':        ['Colheita terceirizada soja', 'Frete grãos para cooperativa', 'Secagem milho 50t', 'Aplicação aérea defensivo', 'Plantio mecanizado 200ha'],
  'INFRAESTRUTURA E UTILIDADES':  ['Energia elétrica Março', 'Combustível diesel 5000L', 'Manutenção estrada interna', 'Lubrificantes e graxas', 'Internet rural instalação'],
  'ADMINISTRATIVAS':              ['Honorários contabilidade', 'Assinatura software gestão', 'Material escritório', 'Registro ITR 2024', 'Despesas bancárias Abril'],
  'SEGUROS E PROTEÇÃO':           ['Seguro rural soja safra 24/25', 'Seguro máquinas agrícolas', 'Seguro responsabilidade civil', 'Proagro adesão 2024'],
  'IMPOSTOS E TAXAS':             ['FUNRURAL competência Abril', 'ITR 2024 parcela 1', 'ICMS diferencial alíquota', 'Taxas ambientais licença'],
  'INVESTIMENTOS':                ['Pivô central irrigação 50ha', 'Silo metálico 500t', 'Galpão armazenagem 200m²', 'Trator Valtra 125cv entrada'],
  'VENDA DE SOJA':                ['Soja safra 24/25 lote 001', 'Soja Fixação ESALQ+50', 'Venda antecipada soja 200sc'],
  'VENDA DE MILHO':               ['Milho safrinha lote 003', 'Milho 2ª safra 100t', 'Venda milho BM&F'],
  'VENDA DE ALGODÃO':             ['Algodão pluma safra 24', 'Algodão caroço 50t', 'Contrato algodão ANEC'],
  'VENDA DE CAFÉ':                ['Café arábica 100 sacas', 'Café cereja descascado', 'Café especial lote reserva'],
  'VENDA DE GADO':                ['Boi gordo 20 cabeças', 'Novilho precoce 15 cab', 'Vaca descarte 10 cabeças'],
  'ARRENDAMENTO':                 ['Arrendamento 50ha Fazenda Boa Vista', 'Arrendamento Chácara São João', 'Contrato arrendamento 80ha'],
  'OUTRAS RECEITAS':              ['Locação máquina colheitadeira', 'Venda lenha eucalipto', 'Receita venda terra arrendada'],
};

// ── Seed principal ───────────────────────────────────────────────
async function seed() {
  console.log('🌱 Iniciando seed...\n');

  // ── Fornecedores ────────────────────────────────────────────────
  const fornIds = [];
  for (const f of fornecedoresData) {
    const r = await query(
      `INSERT INTO fornecedores (razao_social, fantasia, cnpj, ativo) VALUES ($1,$2,$3,true)
       ON CONFLICT (cnpj) DO UPDATE SET razao_social=$1 RETURNING id`,
      [f.razao, f.fantasia, f.cnpj]
    );
    fornIds.push(r.rows[0].id);
  }
  console.log(`✅ ${fornIds.length} fornecedores`);

  // ── Clientes ────────────────────────────────────────────────────
  const cliIds = [];
  for (const c of clientesData) {
    const r = await query(
      `INSERT INTO clientes (razao_social, fantasia, cnpj, ativo) VALUES ($1,$2,$3,true)
       ON CONFLICT (cnpj) DO UPDATE SET razao_social=$1 RETURNING id`,
      [c.razao, c.fantasia, c.cnpj]
    );
    cliIds.push(r.rows[0].id);
  }
  console.log(`✅ ${cliIds.length} clientes`);

  // ── Faturados ───────────────────────────────────────────────────
  const fatIds = [];
  for (const f of faturadosData) {
    const r = await query(
      `INSERT INTO faturados (nome_completo, cpf, ativo) VALUES ($1,$2,true)
       ON CONFLICT (cpf) DO UPDATE SET nome_completo=$1 RETURNING id`,
      [f.nome, f.cpf]
    );
    fatIds.push(r.rows[0].id);
  }
  console.log(`✅ ${fatIds.length} faturados`);

  // ── Classificações ──────────────────────────────────────────────
  const classifMap = {};
  for (const desc of despesaClassifs) {
    const r = await query(
      `INSERT INTO classificacao (tipo, descricao, ativo) VALUES ('DESPESA',$1,true)
       ON CONFLICT DO NOTHING RETURNING id`,
      [desc]
    );
    if (r.rows.length) classifMap[desc] = r.rows[0].id;
    else {
      const e = await query(`SELECT id FROM classificacao WHERE descricao=$1`, [desc]);
      classifMap[desc] = e.rows[0]?.id;
    }
  }
  for (const desc of receitaClassifs) {
    const r = await query(
      `INSERT INTO classificacao (tipo, descricao, ativo) VALUES ('RECEITA',$1,true)
       ON CONFLICT DO NOTHING RETURNING id`,
      [desc]
    );
    if (r.rows.length) classifMap[desc] = r.rows[0].id;
    else {
      const e = await query(`SELECT id FROM classificacao WHERE descricao=$1`, [desc]);
      classifMap[desc] = e.rows[0]?.id;
    }
  }
  console.log(`✅ ${Object.keys(classifMap).length} classificações`);

  // ── Movimentos: 70 Pagar + 40 Receber = 110 ──────────────────────
  let movCount = 0, parcCount = 0;

  // Contas a PAGAR (tipo_lancamento=1)
  for (let i = 0; i < 70; i++) {
    const classifKey = rand(despesaClassifs);
    const descList   = descricoesPorClassif[classifKey] || ['Despesa agrícola'];
    const desc       = rand(descList);
    const emissao    = pastDate(365);
    const fornId     = rand(fornIds);
    const fatId      = rand(fatIds);
    const numDoc     = `NF-${String(10000 + i).padStart(6,'0')}`;
    const nParcelas  = randInt(1, 3);
    const valorTotal = randVal(500, 85000);

    const mov = await query(
      `INSERT INTO movimentocontas
         (tipo_lancamento, descricao, valor_total, data_emissao, numero_documento,
          fornecedor_id, faturado_id, ativo)
       VALUES (1,$1,$2,$3,$4,$5,$6,true) RETURNING id`,
      [desc, valorTotal, emissao, numDoc, fornId, fatId]
    );
    const movId = mov.rows[0].id;
    movCount++;

    // Vincula classificação
    const cId = classifMap[classifKey];
    if (cId) await query(
      `INSERT INTO classificacao_movimento (movimento_id, classificacao_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [movId, cId]
    );

    // Parcelas
    const valorParc = parseFloat((valorTotal / nParcelas).toFixed(2));
    for (let p = 1; p <= nParcelas; p++) {
      const vencimento = addDays(emissao, p * 30);
      const isPago     = Math.random() < 0.45;
      const status     = isPago ? 'PAGO' : 'PENDENTE';
      const dataPag    = isPago ? addDays(vencimento, randInt(-5, 10)) : null;
      const valorPago  = isPago ? valorParc : null;

      await query(
        `INSERT INTO parcelacontas
           (movimento_id, identificacao, numero_parcela, data_vencimento, valor, status, data_pagamento, valor_pago)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [movId, `${numDoc}/${p}`, p, vencimento, valorParc, status, dataPag, valorPago]
      );
      parcCount++;
    }
  }

  // Contas a RECEBER (tipo_lancamento=0)
  for (let i = 0; i < 40; i++) {
    const classifKey = rand(receitaClassifs);
    const descList   = descricoesPorClassif[classifKey] || ['Receita agrícola'];
    const desc       = rand(descList);
    const emissao    = pastDate(365);
    const cliId      = rand(cliIds);
    const fatId      = rand(fatIds);
    const numDoc     = `NF-REC-${String(5000 + i).padStart(6,'0')}`;
    const nParcelas  = randInt(1, 2);
    const valorTotal = randVal(8000, 350000);

    const mov = await query(
      `INSERT INTO movimentocontas
         (tipo_lancamento, descricao, valor_total, data_emissao, numero_documento,
          cliente_id, faturado_id, ativo)
       VALUES (0,$1,$2,$3,$4,$5,$6,true) RETURNING id`,
      [desc, valorTotal, emissao, numDoc, cliId, fatId]
    );
    const movId = mov.rows[0].id;
    movCount++;

    const cId = classifMap[classifKey];
    if (cId) await query(
      `INSERT INTO classificacao_movimento (movimento_id, classificacao_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [movId, cId]
    );

    const valorParc = parseFloat((valorTotal / nParcelas).toFixed(2));
    for (let p = 1; p <= nParcelas; p++) {
      const vencimento = addDays(emissao, p * 30);
      const isPago     = Math.random() < 0.55;
      const status     = isPago ? 'PAGO' : 'PENDENTE';
      const dataPag    = isPago ? addDays(vencimento, randInt(-3, 7)) : null;
      const valorPago  = isPago ? valorParc : null;

      await query(
        `INSERT INTO parcelacontas
           (movimento_id, identificacao, numero_parcela, data_vencimento, valor, status, data_pagamento, valor_pago)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [movId, `${numDoc}/${p}`, p, vencimento, valorParc, status, dataPag, valorPago]
      );
      parcCount++;
    }
  }

  console.log(`✅ ${movCount} movimentos (70 pagar + 40 receber)`);
  console.log(`✅ ${parcCount} parcelas`);
  console.log('\n🎉 Seed concluído!');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Erro no seed:', err.message);
  process.exit(1);
});
