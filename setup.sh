#!/bin/bash

echo "🚀 Instalando ServiciosApp..."
echo ""

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm install

# Verificar si existe .env
if [ ! -f .env ]; then
    echo ""
    echo "⚠️  No se encontró archivo .env"
    echo "📝 Creando archivo .env de ejemplo..."
    cat > .env << EOL
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/servicios_db"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="http://localhost:3000"
EOL
    echo "✅ Archivo .env creado. Por favor, actualiza DATABASE_URL con tus credenciales."
fi

echo ""
echo "🗄️  Configurando base de datos..."
npx prisma db push

echo ""
echo "🌱 Poblando base de datos con datos iniciales..."
npx prisma db seed

echo ""
echo "✅ ¡Instalación completada!"
echo ""
echo "Para iniciar el servidor de desarrollo, ejecuta:"
echo "  npm run dev"
echo ""
echo "Usuarios de prueba:"
echo "  Cliente: cliente@test.com / password123"
echo "  Socio: socio1@test.com / password123"
echo "  Admin: admin@servicios.com / password123"
echo ""
