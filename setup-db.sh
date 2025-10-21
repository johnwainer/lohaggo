#!/bin/bash

# Script para configurar PostgreSQL y la base de datos

echo "🔧 Configurando PostgreSQL..."

# Agregar PostgreSQL al PATH
export PATH="/Library/PostgreSQL/16/bin:$PATH"

# Verificar que PostgreSQL esté instalado
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL no está instalado o no está en el PATH"
    echo "Por favor, instala PostgreSQL primero"
    exit 1
fi

echo "✅ PostgreSQL encontrado: $(psql --version)"

# Crear la base de datos
echo "📦 Creando base de datos 'servicios_db'..."
PGPASSWORD=123456 createdb -U postgres -h localhost servicios_db 2>/dev/null || echo "⚠️  La base de datos ya existe o hubo un error"

# Verificar la conexión
echo "🔌 Verificando conexión a la base de datos..."
PGPASSWORD=123456 psql -U postgres -h localhost -d servicios_db -c "SELECT version();" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Conexión exitosa a PostgreSQL"
else
    echo "❌ No se pudo conectar a PostgreSQL"
    echo "Verifica que PostgreSQL esté corriendo y que la contraseña sea correcta"
    exit 1
fi

echo ""
echo "🎉 PostgreSQL configurado correctamente!"
echo ""
echo "Ahora puedes ejecutar:"
echo "  npm install"
echo "  npx prisma migrate dev --name init"
echo "  npm run dev"
