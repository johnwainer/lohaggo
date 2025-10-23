#!/bin/bash

# Script para migrar la base de datos de Supabase
# Ejecuta este script cuando necesites migrar la base de datos de producción

export DATABASE_URL="postgres://postgres.kcuwlsfdqpjjondzgdqp:0G4CoVdDPNk9GCjG@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"

echo "Migrando base de datos de Supabase..."
npx prisma migrate deploy

echo "Generando cliente de Prisma..."
npx prisma generate

echo "¡Listo!"
