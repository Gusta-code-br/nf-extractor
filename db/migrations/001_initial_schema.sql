-- ============================================================
-- MIGRATION 001 — Schema inicial
-- Projeto Administrativo-Financeiro · N2
-- ============================================================

-- ─── Extensão para UUID ──────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── PESSOAS ─────────────────────────────────────────────────
-- tipo: 'CLIENTE-FORNECEDOR' | 'FATURADO'
CREATE TABLE IF NOT EXISTS pessoas (
    id           SERIAL PRIMARY KEY,
    tipo         VARCHAR(20)  NOT NULL CHECK (tipo IN ('CLIENTE-FORNECEDOR', 'FATURADO')),
    razao_social VARCHAR(255) NOT NULL,
    cpf_cnpj     VARCHAR(18)  UNIQUE,          -- CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00)
    fantasia     VARCHAR(255),
    ativo        BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_em    TIMESTAMP    NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ─── CLASSIFICACAO ───────────────────────────────────────────
-- tipo: 'DESPESA' | 'RECEITA'
CREATE TABLE IF NOT EXISTS classificacao (
    id          SERIAL PRIMARY KEY,
    tipo        VARCHAR(10)  NOT NULL CHECK (tipo IN ('DESPESA', 'RECEITA')),
    descricao   VARCHAR(255) NOT NULL,
    ativo       BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_em   TIMESTAMP    NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP  NOT NULL DEFAULT NOW(),
    UNIQUE (tipo, descricao)
);

-- ─── MOVIMENTOCONTAS ─────────────────────────────────────────
-- tipo_lancamento: 1 = contas a pagar | 0 = contas a receber
CREATE TABLE IF NOT EXISTS movimentocontas (
    id               SERIAL PRIMARY KEY,
    tipo_lancamento  SMALLINT     NOT NULL CHECK (tipo_lancamento IN (0, 1)),
    descricao        TEXT,
    valor_total      NUMERIC(15,2) NOT NULL,
    data_emissao     DATE         NOT NULL,
    numero_documento VARCHAR(100),
    pessoa_id        INT          NOT NULL REFERENCES pessoas(id),
    faturado_id      INT          REFERENCES pessoas(id),  -- sempre do tipo FATURADO
    ativo            BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_em        TIMESTAMP    NOT NULL DEFAULT NOW(),
    atualizado_em    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ─── CLASSIFICACAO_MOVIMENTO (N:N) ───────────────────────────
-- Um lançamento pode ter uma ou mais classificações
CREATE TABLE IF NOT EXISTS classificacao_movimento (
    movimento_id     INT NOT NULL REFERENCES movimentocontas(id),
    classificacao_id INT NOT NULL REFERENCES classificacao(id),
    PRIMARY KEY (movimento_id, classificacao_id)
);

-- ─── PARCELACONTAS ───────────────────────────────────────────
-- status: 'PENDENTE' | 'PAGO'
CREATE TABLE IF NOT EXISTS parcelacontas (
    id              SERIAL PRIMARY KEY,
    movimento_id    INT           NOT NULL REFERENCES movimentocontas(id),
    identificacao   VARCHAR(20)   NOT NULL,              -- ex: '001/003' — única por movimento
    numero_parcela  SMALLINT      NOT NULL,
    data_vencimento DATE          NOT NULL,
    valor           NUMERIC(15,2) NOT NULL,
    status          VARCHAR(10)   NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PAGO')),
    data_pagamento  DATE,                                -- preenchida quando PAGO
    criado_em       TIMESTAMP     NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMP     NOT NULL DEFAULT NOW(),
    UNIQUE (movimento_id, identificacao)
);

-- ─── INDEXES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pessoas_cpf_cnpj        ON pessoas(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_pessoas_tipo             ON pessoas(tipo);
CREATE INDEX IF NOT EXISTS idx_classificacao_tipo       ON classificacao(tipo);
CREATE INDEX IF NOT EXISTS idx_movimento_tipo           ON movimentocontas(tipo_lancamento);
CREATE INDEX IF NOT EXISTS idx_movimento_pessoa         ON movimentocontas(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_parcela_movimento        ON parcelacontas(movimento_id);
CREATE INDEX IF NOT EXISTS idx_parcela_status           ON parcelacontas(status);
CREATE INDEX IF NOT EXISTS idx_parcela_vencimento       ON parcelacontas(data_vencimento);
