-- ============================================================
-- MIGRATION 002 — Separação das entidades Pessoa
-- Substitui a tabela unificada `pessoas` por 3 tabelas distintas
-- ============================================================

-- ─── Remove tabela unificada (se existir da migration 001) ───
DROP TABLE IF EXISTS classificacao_movimento CASCADE;
DROP TABLE IF EXISTS parcelacontas CASCADE;
DROP TABLE IF EXISTS movimentocontas CASCADE;
DROP TABLE IF EXISTS pessoas CASCADE;

-- ─── FORNECEDORES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fornecedores (
    id            SERIAL PRIMARY KEY,
    razao_social  VARCHAR(255) NOT NULL,
    fantasia      VARCHAR(255),
    cnpj          VARCHAR(18)  UNIQUE,
    ativo         BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_em     TIMESTAMP    NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ─── CLIENTES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
    id            SERIAL PRIMARY KEY,
    razao_social  VARCHAR(255) NOT NULL,
    fantasia      VARCHAR(255),
    cnpj          VARCHAR(18)  UNIQUE,
    ativo         BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_em     TIMESTAMP    NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ─── FATURADOS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faturados (
    id            SERIAL PRIMARY KEY,
    nome_completo VARCHAR(255) NOT NULL,
    cpf           VARCHAR(14)  UNIQUE,
    ativo         BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_em     TIMESTAMP    NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ─── CLASSIFICACAO ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classificacao (
    id            SERIAL PRIMARY KEY,
    tipo          VARCHAR(10)  NOT NULL CHECK (tipo IN ('DESPESA', 'RECEITA')),
    descricao     VARCHAR(255) NOT NULL,
    ativo         BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_em     TIMESTAMP    NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (tipo, descricao)
);

-- ─── MOVIMENTOCONTAS ─────────────────────────────────────────
-- tipo_lancamento: 1 = contas a pagar | 0 = contas a receber
CREATE TABLE IF NOT EXISTS movimentocontas (
    id               SERIAL PRIMARY KEY,
    tipo_lancamento  SMALLINT      NOT NULL CHECK (tipo_lancamento IN (0, 1)),
    descricao        TEXT,
    valor_total      NUMERIC(15,2) NOT NULL,
    data_emissao     DATE          NOT NULL,
    numero_documento VARCHAR(100),
    fornecedor_id    INT           REFERENCES fornecedores(id),
    cliente_id       INT           REFERENCES clientes(id),
    faturado_id      INT           REFERENCES faturados(id),
    ativo            BOOLEAN       NOT NULL DEFAULT TRUE,
    criado_em        TIMESTAMP     NOT NULL DEFAULT NOW(),
    atualizado_em    TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ─── CLASSIFICACAO_MOVIMENTO (N:N) ───────────────────────────
CREATE TABLE IF NOT EXISTS classificacao_movimento (
    movimento_id     INT NOT NULL REFERENCES movimentocontas(id),
    classificacao_id INT NOT NULL REFERENCES classificacao(id),
    PRIMARY KEY (movimento_id, classificacao_id)
);

-- ─── PARCELACONTAS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parcelacontas (
    id              SERIAL PRIMARY KEY,
    movimento_id    INT           NOT NULL REFERENCES movimentocontas(id),
    identificacao   VARCHAR(20)   NOT NULL,
    numero_parcela  SMALLINT      NOT NULL,
    data_vencimento DATE          NOT NULL,
    valor           NUMERIC(15,2) NOT NULL,
    status          VARCHAR(10)   NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PAGO')),
    data_pagamento  DATE,
    criado_em       TIMESTAMP     NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMP     NOT NULL DEFAULT NOW(),
    UNIQUE (movimento_id, identificacao)
);

-- ─── INDEXES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fornecedores_cnpj       ON fornecedores(cnpj);
CREATE INDEX IF NOT EXISTS idx_fornecedores_razao      ON fornecedores(razao_social);
CREATE INDEX IF NOT EXISTS idx_clientes_cnpj           ON clientes(cnpj);
CREATE INDEX IF NOT EXISTS idx_clientes_razao          ON clientes(razao_social);
CREATE INDEX IF NOT EXISTS idx_faturados_cpf           ON faturados(cpf);
CREATE INDEX IF NOT EXISTS idx_classificacao_tipo      ON classificacao(tipo);
CREATE INDEX IF NOT EXISTS idx_movimento_tipo          ON movimentocontas(tipo_lancamento);
CREATE INDEX IF NOT EXISTS idx_movimento_fornecedor    ON movimentocontas(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_movimento_cliente       ON movimentocontas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_parcela_movimento       ON parcelacontas(movimento_id);
CREATE INDEX IF NOT EXISTS idx_parcela_status          ON parcelacontas(status);
CREATE INDEX IF NOT EXISTS idx_parcela_vencimento      ON parcelacontas(data_vencimento);
