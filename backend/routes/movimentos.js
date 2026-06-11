const express = require('express');
const router = express.Router();
const db = require('../db/index');

// GET /api/movimentos?tipo_lancamento=1&busca=xx
router.get('/', async (req, res) => {
  const { tipo_lancamento, busca } = req.query;
  let conditions = ['m.ativo = true'];
  let params = [];
  let i = 1;

  if (tipo_lancamento !== undefined) {
    conditions.push(`m.tipo_lancamento = $${i++}`);
    params.push(parseInt(tipo_lancamento));
  }
  if (busca) {
    conditions.push(`(LOWER(f.razao_social) LIKE $${i} OR LOWER(c.razao_social) LIKE $${i} OR m.numero_documento LIKE $${i})`);
    params.push(`%${busca.toLowerCase()}%`); i++;
  }

  const where = 'WHERE ' + conditions.join(' AND ');
  const { rows } = await db.query(`
    SELECT
      m.*,
      f.razao_social  AS fornecedor_nome,
      f.cnpj          AS fornecedor_doc,
      c.razao_social  AS cliente_nome,
      c.cnpj          AS cliente_doc,
      ft.nome_completo AS faturado_nome,
      ft.cpf           AS faturado_doc,
      json_agg(DISTINCT jsonb_build_object('id', cl.id, 'descricao', cl.descricao, 'tipo', cl.tipo))
        FILTER (WHERE cl.id IS NOT NULL) AS classificacoes,
      json_agg(DISTINCT jsonb_build_object(
        'id', pc.id, 'identificacao', pc.identificacao,
        'numero_parcela', pc.numero_parcela,
        'data_vencimento', pc.data_vencimento,
        'valor', pc.valor, 'status', pc.status,
        'data_pagamento', pc.data_pagamento,
        'juros', pc.juros, 'multa', pc.multa, 'mora', pc.mora,
        'valor_pago', pc.valor_pago, 'instituicao_id', pc.instituicao_id
      )) FILTER (WHERE pc.id IS NOT NULL) AS parcelas
    FROM movimentocontas m
    LEFT JOIN fornecedores f  ON m.fornecedor_id = f.id
    LEFT JOIN clientes c      ON m.cliente_id    = c.id
    LEFT JOIN faturados ft    ON m.faturado_id   = ft.id
    LEFT JOIN classificacao_movimento cm ON cm.movimento_id = m.id
    LEFT JOIN classificacao cl ON cl.id = cm.classificacao_id
    LEFT JOIN parcelacontas pc ON pc.movimento_id = m.id
    ${where}
    GROUP BY m.id, f.razao_social, f.cnpj, c.razao_social, c.cnpj, ft.nome_completo, ft.cpf
    ORDER BY m.criado_em DESC
  `, params);
  res.json(rows);
});

// GET /api/movimentos/:id
router.get('/:id', async (req, res) => {
  const { rows } = await db.query(`
    SELECT m.*,
      f.razao_social AS fornecedor_nome, f.cnpj AS fornecedor_doc,
      c.razao_social AS cliente_nome,
      ft.nome_completo AS faturado_nome,
      json_agg(DISTINCT jsonb_build_object('id', cl.id, 'descricao', cl.descricao))
        FILTER (WHERE cl.id IS NOT NULL) AS classificacoes,
      json_agg(DISTINCT jsonb_build_object(
        'id', pc.id, 'identificacao', pc.identificacao,
        'numero_parcela', pc.numero_parcela,
        'data_vencimento', pc.data_vencimento,
        'valor', pc.valor, 'status', pc.status,
        'data_pagamento', pc.data_pagamento
      )) FILTER (WHERE pc.id IS NOT NULL) AS parcelas
    FROM movimentocontas m
    LEFT JOIN fornecedores f  ON m.fornecedor_id = f.id
    LEFT JOIN clientes c      ON m.cliente_id    = c.id
    LEFT JOIN faturados ft    ON m.faturado_id   = ft.id
    LEFT JOIN classificacao_movimento cm ON cm.movimento_id = m.id
    LEFT JOIN classificacao cl ON cl.id = cm.classificacao_id
    LEFT JOIN parcelacontas pc ON pc.movimento_id = m.id
    WHERE m.id = $1
    GROUP BY m.id, f.razao_social, f.cnpj, c.razao_social, ft.nome_completo
  `, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
  res.json(rows[0]);
});

// POST /api/movimentos
router.post('/', async (req, res) => {
  const { tipo_lancamento, descricao, valor_total, data_emissao,
          numero_documento, fornecedor_id, cliente_id, faturado_id,
          classificacao_ids, parcelas } = req.body;

  if (valor_total === undefined || !data_emissao) {
    return res.status(400).json({ error: 'valor_total e data_emissao são obrigatórios' });
  }

  try {
    const result = await db.transaction(async (client) => {
      const { rows: [mov] } = await client.query(
        `INSERT INTO movimentocontas
          (tipo_lancamento, descricao, valor_total, data_emissao, numero_documento, fornecedor_id, cliente_id, faturado_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [tipo_lancamento, descricao, valor_total, data_emissao,
         numero_documento || null, fornecedor_id || null, cliente_id || null, faturado_id || null]
      );

      if (classificacao_ids?.length) {
        for (const cid of classificacao_ids) {
          await client.query(
            `INSERT INTO classificacao_movimento (movimento_id, classificacao_id) VALUES ($1,$2)`,
            [mov.id, cid]
          );
        }
      }

      const parcsData = parcelas?.length
        ? parcelas
        : [{ data_vencimento: data_emissao, valor: valor_total }];

      const total = parcsData.length;
      const parcelasInseridas = [];
      for (let idx = 0; idx < parcsData.length; idx++) {
        const p = parcsData[idx];
        const num = idx + 1;
        const ident = `${String(num).padStart(3,'0')}/${String(total).padStart(3,'0')}`;
        const { rows: [parc] } = await client.query(
          `INSERT INTO parcelacontas (movimento_id, identificacao, numero_parcela, data_vencimento, valor)
           VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [mov.id, ident, num, p.data_vencimento, p.valor]
        );
        parcelasInseridas.push(parc);
      }

      return { ...mov, parcelas: parcelasInseridas };
    });

    res.status(201).json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/movimentos/:id/status
router.patch('/:id/status', async (req, res) => {
  const { ativo } = req.body;
  const { rows } = await db.query(
    `UPDATE movimentocontas SET ativo=$1, atualizado_em=NOW() WHERE id=$2 RETURNING *`,
    [ativo, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
  res.json(rows[0]);
});

// PATCH /api/movimentos/parcela/:parcelaId/pagar
router.patch('/parcela/:parcelaId/pagar', async (req, res) => {
  const { data_pagamento, juros, multa, mora, instituicao_id } = req.body;

  const { rows: [current] } = await db.query(
    'SELECT valor FROM parcelacontas WHERE id=$1', [req.params.parcelaId]
  );
  if (!current) return res.status(404).json({ error: 'Parcela não encontrada' });

  const vJuros = parseFloat(juros) || 0;
  const vMulta = parseFloat(multa) || 0;
  const vMora  = parseFloat(mora)  || 0;
  const valorPago = Number(current.valor) + vJuros + vMulta + vMora;

  const { rows } = await db.query(
    `UPDATE parcelacontas
     SET status='PAGO', data_pagamento=$1, juros=$2, multa=$3, mora=$4,
         valor_pago=$5, instituicao_id=$6, atualizado_em=NOW()
     WHERE id=$7 RETURNING *`,
    [data_pagamento || new Date().toISOString().split('T')[0],
     vJuros, vMulta, vMora, valorPago,
     instituicao_id || null,
     req.params.parcelaId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
  res.json(rows[0]);
});

module.exports = router;
