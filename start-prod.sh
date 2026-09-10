#!/usr/bin/env bash
set -e

if [ ! -f .env ]; then
  echo "Arquivo .env nao encontrado. Copie .env.example para .env e ajuste o dominio."
  exit 1
fi

docker compose up -d --build

echo "Servidor rodando."
echo "Acesse: https://$(grep '^PUBLIC_URL=' .env | cut -d= -f2- | sed 's#https://##; s#http://##')"
