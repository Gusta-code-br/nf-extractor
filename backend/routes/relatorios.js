const express = require('express');
const router = express.Router();
const db = require('../db/index');

router.get('/parcelas', async (req, res) => {
  const { tipo_lancamento, de, ate, status, fornecedor_id, classificacao_id } = req.query;
  const conditions = ['m.ativo = true'];
  const params = [];
  let i = 1;

  if (tipo_lancamento !== undefined) {
    conditions.push(`m.tipo_lancamento = $${i++}`);
    params.push(parseInt(tipo_lancamento));
  }
  if (de) {
    conditions.push(`pc.data_vencimento >= $${i++}`);
    params.push(de);
  }
  if (ate) {
    conditions.push(`pc.data_vencimento <= $${i++}`);
    params.push(ate);
  }
  if (status) {
    conditions.push(`pc.status = $${i++}`);
    params.push(status.toUpperCase());
  }
  if (fornecedor_id) {
    conditions.push(`m.fornecedor_id = $${i++}`);
    params.push(parseInt(fornecedor_id));
  }
  if (classificacao_id) {
    conditions.push(`m.id IN (SELECT movimento_id FROM classificacao_movimento WHERE classificacao_id = $${i++})`);
    params.push(parseInt(classificacao_id));
  }

  const { rows } = await db.query(`
    SELECT
      pc.id, pc.identificacao, pc.numero_parcela,
      pc.data_vencimento, pc.data_pagamento,
      pc.valor, pc.juros, pc.multa, pc.mora, pc.valor_pago, pc.status,
      m.numero_documento, m.tipo_lancamento,
      COALESCE(f.razao_social, c.razao_social) AS entidade_nome,
      ib.nome AS banco_nome
    FROM parcelacontas pc
    JOIN movimentocontas m ON m.id = pc.movimento_id
    LEFT JOIN fornecedores f   ON f.id  = m.fornecedor_id
    LEFT JOIN clientes c       ON c.id  = m.cliente_id
    LEFT JOIN instituicao_bancaria ib ON ib.id = pc.instituicao_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY pc.data_vencimento ASC, m.numero_documento
  `, params);

  res.json(rows);
});

module.exports = router;
