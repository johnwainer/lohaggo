#!/bin/bash

echo "🚀 Configurando sistema de pagos con MercadoPago..."
echo ""

echo "📦 Instalando dependencias..."
npm install mercadopago

echo ""
echo "🔧 Generando cliente de Prisma..."
npx prisma generate

echo ""
echo "🗄️  Actualizando base de datos..."
npx prisma db push

echo ""
echo "✅ Configuración completada!"
echo ""
echo "📝 Próximos pasos:"
echo "1. Verifica que las variables de entorno de MercadoPago estén en .env"
echo "2. Configura el webhook en MercadoPago: https://tu-dominio.com/api/payments/webhook"
echo "3. Inicia el servidor: npm run dev"
echo ""
echo "📖 Lee PAYMENT_SYSTEM.md para más información"
