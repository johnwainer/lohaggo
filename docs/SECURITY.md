# 🔒 Seguridad y Archivos Sensibles

## ⚠️ IMPORTANTE: Archivos que NO deben estar en Git

Los siguientes archivos contienen información sensible y **NUNCA** deben ser commiteados al repositorio:

### 1. Variables de Entorno

```
.env
.env.local
.env.production
.env.production.local
.env*.local
```

**Contienen**:
- Credenciales de base de datos
- Tokens de MercadoPago
- Secretos de NextAuth
- Claves de API (Cloudinary, etc.)
- Claves VAPID para notificaciones push

### 2. Logs

```
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.next/dev/logs/
```

**Pueden contener**:
- Información de usuarios
- Errores con datos sensibles
- Tokens de sesión
- Consultas SQL con datos

### 3. Archivos de Backup

```
*.bak
*.backup
*.tmp
*~
```

**Pueden contener**:
- Copias de archivos con credenciales
- Datos de prueba con información real

### 4. Directorios Temporales

```
/tmp/
/.next/
/out/
/build/
```

**Pueden contener**:
- Archivos compilados con variables de entorno
- Caché con información sensible

### 5. Configuraciones de IDE

```
.vscode/
.idea/
*.swp
*.swo
```

**Pueden contener**:
- Configuraciones locales
- Rutas absolutas del sistema
- Credenciales guardadas

## ✅ Verificación de Seguridad

### Paso 1: Verificar .gitignore

Asegúrate de que tu `.gitignore` incluya todos los patrones mencionados arriba.

```bash
cat .gitignore
```

### Paso 2: Verificar archivos trackeados

Verifica que no haya archivos sensibles trackeados en git:

```bash
# Buscar archivos .env
git ls-files | grep -E "\.env"

# Buscar archivos de log
git ls-files | grep -E "\.log$"

# Buscar archivos de backup
git ls-files | grep -E "\.(bak|backup|tmp)$"
```

### Paso 3: Remover archivos del historial (si es necesario)

Si accidentalmente commiteaste archivos sensibles:

```bash
# Remover archivo del historial de git
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch ruta/al/archivo" \
  --prune-empty --tag-name-filter cat -- --all

# O usar git-filter-repo (recomendado)
git filter-repo --path ruta/al/archivo --invert-paths

# Forzar push (¡CUIDADO!)
git push origin --force --all
```

⚠️ **ADVERTENCIA**: Esto reescribe el historial de git. Coordina con tu equipo antes de hacerlo.

## 🔐 Buenas Prácticas

### 1. Variables de Entorno

**✅ HACER**:
- Usar archivos `.env.local` para desarrollo
- Usar variables de entorno del servidor en producción
- Documentar variables necesarias en `.env.example`
- Usar valores de ejemplo en la documentación

**❌ NO HACER**:
- Commitear archivos `.env` con valores reales
- Compartir credenciales por chat o email
- Usar credenciales de producción en desarrollo
- Hardcodear credenciales en el código

### 2. Credenciales de Base de Datos

**✅ HACER**:
- Usar el modelo `PaymentConfig` para credenciales de pago
- Rotar credenciales periódicamente
- Usar credenciales diferentes para cada ambiente
- Limitar permisos de base de datos

**❌ NO HACER**:
- Usar la misma contraseña en todos los ambientes
- Compartir credenciales de producción con todo el equipo
- Dejar credenciales por defecto (postgres/postgres)

### 3. Tokens y Claves de API

**✅ HACER**:
- Usar credenciales TEST para desarrollo
- Regenerar tokens si se exponen
- Monitorear uso de APIs
- Implementar rate limiting

**❌ NO HACER**:
- Exponer tokens en el frontend
- Usar tokens de producción en desarrollo
- Compartir tokens en repositorios públicos

## 📋 Checklist de Seguridad

Antes de hacer push a git:

- [ ] Verificar que `.env` no esté en el commit
- [ ] Verificar que no haya credenciales hardcodeadas
- [ ] Verificar que `.gitignore` esté actualizado
- [ ] Verificar que no haya logs con información sensible
- [ ] Verificar que la documentación use ejemplos genéricos
- [ ] Verificar que no haya archivos de backup

Antes de desplegar a producción:

- [ ] Usar credenciales de producción diferentes
- [ ] Verificar que las credenciales estén en variables de entorno
- [ ] Verificar que el ambiente esté en PRODUCTION
- [ ] Verificar que los logs no expongan información sensible
- [ ] Implementar monitoreo de seguridad
- [ ] Configurar alertas de seguridad

## 🚨 Qué hacer si se exponen credenciales

### 1. Acción Inmediata

1. **Rotar credenciales inmediatamente**
   - Cambiar contraseñas de base de datos
   - Regenerar tokens de API
   - Actualizar secretos de NextAuth

2. **Remover del historial de git**
   ```bash
   git filter-repo --path .env --invert-paths
   git push origin --force --all
   ```

3. **Notificar al equipo**
   - Informar sobre la exposición
   - Coordinar cambio de credenciales
   - Actualizar documentación

### 2. Verificación

1. **Revisar logs de acceso**
   - Base de datos
   - APIs (MercadoPago, Cloudinary)
   - Servidor

2. **Buscar actividad sospechosa**
   - Transacciones no autorizadas
   - Accesos desde IPs desconocidas
   - Cambios no autorizados en datos

### 3. Prevención

1. **Implementar pre-commit hooks**
   ```bash
   # .git/hooks/pre-commit
   #!/bin/sh
   if git diff --cached --name-only | grep -E "\.env$"; then
     echo "Error: Intentando commitear archivo .env"
     exit 1
   fi
   ```

2. **Usar herramientas de escaneo**
   - git-secrets
   - truffleHog
   - GitGuardian

3. **Educación del equipo**
   - Capacitación en seguridad
   - Revisión de código
   - Documentación clara

## 📚 Recursos Adicionales

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
- [12 Factor App - Config](https://12factor.net/config)
- [Secrets Management](https://www.vaultproject.io/)

## 🤝 Contribuir

Si encuentras un problema de seguridad:

1. **NO** lo reportes públicamente
2. Envía un email a: security@lohaggo.com
3. Incluye detalles del problema
4. Espera respuesta antes de divulgar

---

**Última actualización**: Diciembre 2, 2025
**Versión**: 1.0.0
