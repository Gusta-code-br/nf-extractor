const express = require('express');
const router = express.Router();
const db = require('../db/index');

// POST /api/importar/verificar — consulta sem persistir
router.post('/verificar', async (req, res) => {
  const { fornecedor, faturado, classificacoesDespesa } = req.body;
  const checks = [];

  // Fornecedor
  if (fornecedor?.cnpj || fornecedor?.razaoSocial) {
    const cnpjClean = (fornecedor.cnpj || '').replace(/\D/g, '');
    let rows = [];
    if (cnpjClean) {
      const q = await db.query(
        `SELECT * FROM fornecedores WHERE REGEXP_REPLACE(cnpj,'[^0-9]','','g') = $1`,
        [cnpjClean]
      );
      rows = q.rows;
    }
    checks.push({ entidade: 'FORNECEDOR', nome: fornecedor.razaoSocial, doc: fornecedor.cnpj, existe: rows.length > 0, id: rows[0]?.id || null });
  }

  // Faturado
  if (faturado?.cpf_cnpj || faturado?.nomeCompleto) {
    const cpfClean = (faturado.cpf_cnpj || '').replace(/\D/g, '');
    let rows = [];
    if (cpfClean) {
      const q = await db.query(
        `SELECT * FROM faturados WHERE REGEXP_REPLACE(cpf,'[^0-9]','','g') = $1`,
        [cpfClean]
      );
      rows = q.rows;
    }
    checks.push({ entidade: 'FATURADO', nome: faturado.nomeCompleto, doc: faturado.cpf_cnpj, existe: rows.length > 0, id: rows[0]?.id || null });
  }

  // Classificações
  for (const desc of (classificacoesDespesa || [])) {
    const { rows } = await db.query(
      `SELECT * FROM classificacao WHERE LOWER(descricao)=LOWER($1) AND tipo='DESPESA'`, [desc]
    );
    checks.push({ entidade: 'DESPESA', nome: desc, existe: rows.length > 0, id: rows[0]?.id || null });
  }

  res.json(checks);
});

// POST /api/importar — persiste tudo em transação
router.post('/', async (req, res) => {
  const { fornecedor, faturado, classificacoesDespesa, parcelas, ...movimento } = req.body;

  try {
    const result = await db.transaction(async (client) => {
      const log = [];

      // ── 1. FORNECEDOR ───────────────────────────────────────
      let fornecedorId;
      const cnpjClean = (fornecedor?.cnpj || '').replace(/\D/g, '');
      const { rows: fRows } = await client.query(
        `SELECT * FROM fornecedores WHERE REGEXP_REPLACE(cnpj,'[^0-9]','','g') = $1`, [cnpjClean]
      );
      if (fRows.length) {
        fornecedorId = fRows[0].id;
        log.push({ entidade: 'FORNECEDOR', status: 'EXISTE', id: fornecedorId, nome: fRows[0].razao_social });
      } else {
        const { rows: [nf] } = await client.query(
          `INSERT INTO fornecedores (razao_social, cnpj, fantasia) VALUES ($1,$2,$3) RETURNING *`,
          [fornecedor.razaoSocial, fornecedor.cnpj || null, fornecedor.fantasia || null]
        );
        fornecedorId = nf.id;
        log.push({ entidade: 'FORNECEDOR', status: 'CRIADO', id: fornecedorId, nome: nf.razao_social });
      }

      // ── 2. FATURADO ─────────────────────────────────────────
      let faturadoId = null;
      if (faturado?.nomeCompleto) {
        const cpfClean = (faturado.cpf_cnpj || '').replace(/\D/g, '');
        let fatRows = [];
        if (cpfClean) {
          const q = await client.query(
            `SELECT * FROM faturados WHERE REGEXP_REPLACE(cpf,'[^0-9]','','g') = $1`, [cpfClean]
          );
          fatRows = q.rows;
        }
        if (fatRows.length) {
          faturadoId = fatRows[0].id;
          log.push({ entidade: 'FATURADO', status: 'EXISTE', id: faturadoId, nome: fatRows[0].nome_completo });
        } else {
          const { rows: [nfat] } = await client.query(
            `INSERT INTO faturados (nome_completo, cpf) VALUES ($1,$2) RETURNING *`,
            [faturado.nomeCompleto, cpfClean || null]
          );
          faturadoId = nfat.id;
          log.push({ entidade: 'FATURADO', status: 'CRIADO', id: faturadoId, nome: nfat.nome_completo });
        }
      }

      // ── 3. CLASSIFICAÇÕES ───────────────────────────────────
      const classificacaoIds = [];
      for (const desc of (classificacoesDespesa || [])) {
        const { rows: cRows } = await client.query(
          `SELECT * FROM classificacao WHERE LOWER(descricao)=LOWER($1) AND tipo='DESPESA'`, [desc]
        );
        if (cRows.length) {
          classificacaoIds.push(cRows[0].id);
          log.push({ entidade: 'DESPESA', status: 'EXISTE', id: cRows[0].id, nome: desc });
        } else {
          const { rows: [nc] } = await client.query(
            `INSERT INTO classificacao (tipo, descricao) VALUES ('DESPESA',$1) RETURNING *`, [desc]
          );
          classificacaoIds.push(nc.id);
          log.push({ entidade: 'DESPESA', status: 'CRIADO', id: nc.id, nome: desc });
        }
      }

      // ── 4. MOVIMENTO ────────────────────────────────────────
      const { rows: [mov] } = await client.query(
        `INSERT INTO movimentocontas
          (tipo_lancamento, descricao, valor_total, data_emissao, numero_documento, fornecedor_id, faturado_id)
         VALUES (1,$1,$2,$3,$4,$5,$6) RETURNING *`,
        [movimento.descricaoProdutos || null, movimento.valorTotal, movimento.dataEmissao,
         movimento.numeroNotaFiscal || null, fornecedorId, faturadoId]
      );

      // ── 5. CLASSIFICAÇÃO_MOVIMENTO ──────────────────────────
      for (const cid of classificacaoIds) {
        await client.query(
          `INSERT INTO classificacao_movimento (movimento_id, classificacao_id) VALUES ($1,$2)`,
          [mov.id, cid]
        );
      }

      // ── 6. PARCELAS ─────────────────────────────────────────
      const parcelasData = parcelas?.length
        ? parcelas
        : [{ dataVencimento: movimento.dataEmissao, valor: movimento.valorTotal }];

      const total = parcelasData.length;
      const parcelasInseridas = [];
      for (let idx = 0; idx < parcelasData.length; idx++) {
        const p = parcelasData[idx];
        const num = idx + 1;
        const ident = `${String(num).padStart(3,'0')}/${String(total).padStart(3,'0')}`;
        const { rows: [parc] } = await client.query(
          `INSERT INTO parcelacontas (movimento_id, identificacao, numero_parcela, data_vencimento, valor)
           VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [mov.id, ident, num, p.dataVencimento || p.data_vencimento || movimento.dataEmissao, p.valor]
        );
        parcelasInseridas.push(parc);
      }

      log.push({
        entidade: 'MOVIMENTO', status: 'CRIADO', id: mov.id,
        nome: `NF ${movimento.numeroNotaFiscal || mov.id} — R$ ${Number(movimento.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      });

      return { movimento: { ...mov, parcelas: parcelasInseridas }, log };
    });

    res.status(201).json(result);
  } catch (e) {
    console.error('Erro na importação:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
