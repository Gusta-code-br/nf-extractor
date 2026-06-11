const express = require('express');
const router = express.Router();
const db = require('../db/index');

router.get('/', async (req, res) => {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const mesAtual = hoje.substring(0, 7);

    const [apagar, areceber, vencidas, pagas, ultimas, totalMovimentos] = await Promise.all([
      db.query(`
        SELECT COALESCE(SUM(pc.valor),0) as total, COUNT(pc.id) as qtd
        FROM parcelacontas pc
        JOIN movimentocontas m ON m.id = pc.movimento_id
        WHERE pc.status='PENDENTE' AND m.tipo_lancamento=1 AND m.ativo=true
      `),
      db.query(`
        SELECT COALESCE(SUM(pc.valor),0) as total, COUNT(pc.id) as qtd
        FROM parcelacontas pc
        JOIN movimentocontas m ON m.id = pc.movimento_id
        WHERE pc.status='PENDENTE' AND m.tipo_lancamento=0 AND m.ativo=true
      `),
      db.query(`
        SELECT COUNT(pc.id) as qtd, COALESCE(SUM(pc.valor),0) as total
        FROM parcelacontas pc
        JOIN movimentocontas m ON m.id = pc.movimento_id
        WHERE pc.status='PENDENTE' AND pc.data_vencimento < $1 AND m.ativo=true
      `, [hoje]),
      db.query(`
        SELECT COUNT(pc.id) as qtd, COALESCE(SUM(COALESCE(pc.valor_pago, pc.valor)),0) as total
        FROM parcelacontas pc
        JOIN movimentocontas m ON m.id = pc.movimento_id
        WHERE pc.status='PAGO' AND TO_CHAR(pc.data_pagamento,'YYYY-MM')=$1 AND m.ativo=true
      `, [mesAtual]),
      db.query(`
        SELECT m.id, m.numero_documento, m.valor_total, m.data_emissao, m.tipo_lancamento, m.criado_em,
               COALESCE(f.razao_social, c.razao_social) as entidade_nome
        FROM movimentocontas m
        LEFT JOIN fornecedores f ON f.id = m.fornecedor_id
        LEFT JOIN clientes c ON c.id = m.cliente_id
        WHERE m.ativo=true
        ORDER BY m.criado_em DESC LIMIT 6
      `),
      db.query(`SELECT COUNT(*) as total FROM movimentocontas WHERE ativo=true`),
    ]);

    res.json({
      apagar:           { total: Number(apagar.rows[0].total),          qtd: Number(apagar.rows[0].qtd)    },
      areceber:         { total: Number(areceber.rows[0].total),        qtd: Number(areceber.rows[0].qtd)  },
      vencidas:         { total: Number(vencidas.rows[0].total),        qtd: Number(vencidas.rows[0].qtd)  },
      pagas_mes:        { total: Number(pagas.rows[0].total),           qtd: Number(pagas.rows[0].qtd)     },
      total_movimentos: Number(totalMovimentos.rows[0].total),
      ultimas:          ultimas.rows,
    });
  } catch (e) {
    console.error('Dashboard error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
