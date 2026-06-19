#!/bin/bash
set -e
LOGIN=$(curl -s --max-time 10 -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gestorpro.com","senha":"admin123"}')
echo "LOGIN: $LOGIN"
TOKEN=$(node -pe "JSON.parse(process.argv[1]).token" "$LOGIN")
echo "TOKEN: $TOKEN"

echo "--- relatorios/parcelas (sem filtro) ---"
curl -s --max-time 10 "http://localhost:3000/api/relatorios/parcelas?tipo_lancamento=1" -H "Authorization: Bearer $TOKEN"
echo
echo "--- fornecedores ---"
curl -s --max-time 10 "http://localhost:3000/api/fornecedores?ativo=true" -H "Authorization: Bearer $TOKEN"
echo
echo "--- classificacoes DESPESA ---"
curl -s --max-time 10 "http://localhost:3000/api/classificacoes?tipo=DESPESA&ativo=true" -H "Authorization: Bearer $TOKEN"
echo
echo "--- filtro por fornecedor_id=1 ---"
curl -s --max-time 10 "http://localhost:3000/api/relatorios/parcelas?tipo_lancamento=1&fornecedor_id=1" -H "Authorization: Bearer $TOKEN"
echo
echo "--- arquivos estaticos ---"
for p in /js/screens/relatorio.js /assets/css/main.css; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$p")
  echo "$code  $p"
done
