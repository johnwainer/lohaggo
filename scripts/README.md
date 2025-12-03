# Scripts de Seguridad

Este directorio contiene scripts para verificar y mantener la seguridad del repositorio.

## 🔍 check-sensitive-files.sh

Script para verificar que no se commiteen archivos sensibles o credenciales.

### Uso Manual

```bash
# Ejecutar verificación
./scripts/check-sensitive-files.sh
```

### Configurar como Pre-commit Hook

Para ejecutar automáticamente antes de cada commit:

```bash
# Copiar el script a los hooks de git
cp scripts/check-sensitive-files.sh .git/hooks/pre-commit

# Dar permisos de ejecución
chmod +x .git/hooks/pre-commit
```

### Qué verifica

1. **Archivos .env**
   - `.env`
   - `.env.local`
   - `.env.production`

2. **Credenciales hardcodeadas**
   - Tokens de MercadoPago (APP_USR-)
   - URLs de base de datos con credenciales
   - Claves de AWS (AKIA...)
   - Tokens de Stripe (sk_live_, sk_test_)

3. **Archivos de log**
   - `*.log`

4. **Archivos de backup**
   - `*.bak`
   - `*.backup`
   - `*.tmp`

5. **Información sensible en documentación**
   - Emails reales
   - Contraseñas de ejemplo
   - Direcciones reales

### Bypass (solo si es necesario)

Si necesitas commitear un archivo que el script bloquea:

```bash
git commit --no-verify -m "mensaje"
```

⚠️ **ADVERTENCIA**: Solo usa `--no-verify` si estás seguro de que no hay información sensible.

## 🔐 check-payment-config.ts

Script para verificar la configuración de pagos en la base de datos.

### Uso

```bash
npx tsx scripts/check-payment-config.ts
```

### Funcionalidades

- Verifica si existe configuración de pagos
- Muestra el ambiente actual (TEST/PRODUCTION)
- Verifica estado de credenciales
- Crea configuración inicial si no existe

## 🔄 update-payment-config.ts

Script para actualizar credenciales de pago desde variables de entorno.

### Uso

```bash
npx tsx scripts/update-payment-config.ts
```

### Funcionalidades

- Lee credenciales de `.env.local`
- Actualiza la configuración en la base de datos
- Valida que existan las variables necesarias

## 📋 Otros Scripts

### delete-last-payment.ts

Elimina el último pago de la base de datos (útil para pruebas).

```bash
npx tsx scripts/delete-last-payment.ts
```

### validate-deployment.ts

Valida que el despliegue esté correcto.

```bash
npx tsx scripts/validate-deployment.ts
```

## 🚀 Mejores Prácticas

1. **Siempre ejecuta** `check-sensitive-files.sh` antes de hacer push
2. **Configura el pre-commit hook** para verificación automática
3. **Revisa los cambios** antes de hacer commit
4. **No uses** `--no-verify` a menos que sea absolutamente necesario
5. **Documenta** cualquier excepción en el commit message

## 🤝 Contribuir

Si agregas un nuevo script:

1. Documéntalo en este README
2. Agrega comentarios en el código
3. Incluye ejemplos de uso
4. Actualiza la documentación de seguridad si es necesario

---

**Última actualización**: Diciembre 2, 2025
