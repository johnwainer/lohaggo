#!/bin/bash

echo "🚀 Iniciando migración de 50 nuevos servicios..."
echo ""
echo "⚠️  IMPORTANTE: Asegúrate de que DATABASE_URL en .env apunta a la base de datos correcta"
echo ""
read -p "¿Continuar? (s/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Ss]$ ]]
then
    echo "✅ Ejecutando migración..."
    npx tsx prisma/add-new-services.ts
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✨ ¡Migración completada exitosamente!"
        echo ""
        echo "📊 Próximos pasos:"
        echo "1. Verificar servicios en Prisma Studio: npx prisma studio"
        echo "2. Probar el buscador en la aplicación"
        echo "3. Revisar que los servicios aparecen correctamente"
        echo ""
    else
        echo ""
        echo "❌ Error en la migración. Revisa los logs arriba."
        echo ""
    fi
else
    echo "❌ Migración cancelada"
fi
