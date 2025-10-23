# Configuración de Variables de Entorno en Vercel

## Pasos para configurar las variables de entorno:

1. Ve a tu proyecto en Vercel: https://vercel.com/dashboard
2. Selecciona tu proyecto "lohaggo"
3. Ve a **Settings** → **Environment Variables**
4. Agrega las siguientes variables:

### Variables Requeridas:

```
DATABASE_URL
postgres://postgres.kcuwlsfdqpjjondzgdqp:0G4CoVdDPNk9GCjG@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true

NEXTAUTH_SECRET
9UBMCPRx5bMxzNZIDXGRQ5qaxt6+QGrE0lvz4aKwtkQ=

NEXTAUTH_URL
https://lohaggo.vercel.app

SUPABASE_URL
https://kcuwlsfdqpjjondzgdqp.supabase.co

SUPABASE_ANON_KEY
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdXdsc2ZkcXBqam9uZHpnZHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMTM1MjEsImV4cCI6MjA3Njc4OTUyMX0.oZJ9PH925a49KVCtosZDqs-Z-DnciQLTvWTQC6hU5N0

SUPABASE_SERVICE_ROLE_KEY
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdXdsc2ZkcXBqam9uZHpnZHFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIxMzUyMSwiZXhwIjoyMDc2Nzg5NTIxfQ.LLwc8kYmVuT3yNZl5TUUm4CoB4FQ_qDXBVy0u5opm0g

NEXT_PUBLIC_SUPABASE_URL
https://kcuwlsfdqpjjondzgdqp.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdXdsc2ZkcXBqam9uZHpnZHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMTM1MjEsImV4cCI6MjA3Njc4OTUyMX0.oZJ9PH925a49KVCtosZDqs-Z-DnciQLTvWTQC6hU5N0
```

5. Para cada variable:
   - Click en **Add New**
   - Ingresa el **Name** (nombre de la variable)
   - Ingresa el **Value** (valor de la variable)
   - Selecciona los ambientes: **Production**, **Preview**, **Development**
   - Click en **Save**

6. Una vez agregadas todas las variables, haz un **Redeploy** de tu proyecto

## Migrar la Base de Datos

Antes de hacer el deploy, necesitas migrar tu base de datos de Supabase:

```bash
chmod +x migrate-supabase.sh
./migrate-supabase.sh
```

O manualmente:

```bash
export DATABASE_URL="postgres://postgres.kcuwlsfdqpjjondzgdqp:0G4CoVdDPNk9GCjG@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"
npx prisma migrate deploy
npx prisma generate
```

## Verificar

Después del deploy, verifica que:
- La aplicación carga correctamente
- Puedes hacer login
- Las rutas API funcionan
- No hay errores en los logs de Vercel

## Notas Importantes

- **NO** subas el archivo `.env.production` a Git (ya está en `.gitignore`)
- Tu base de datos local (`.env`) no se verá afectada
- Las variables de entorno en Vercel son independientes de tu entorno local
