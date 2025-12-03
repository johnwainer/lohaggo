#!/bin/bash

echo "🔍 Verificando archivos sensibles antes del commit..."
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contador de errores
ERRORS=0

# 1. Verificar archivos .env
echo "📋 Verificando archivos .env..."
if git diff --cached --name-only | grep -E "\.env$|\.env\.local$|\.env\.production$"; then
    echo -e "${RED}❌ ERROR: Intentando commitear archivos .env${NC}"
    echo "   Archivos encontrados:"
    git diff --cached --name-only | grep -E "\.env$|\.env\.local$|\.env\.production$" | sed 's/^/   - /'
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ No se encontraron archivos .env${NC}"
fi
echo ""

# 2. Verificar credenciales hardcodeadas
echo "📋 Verificando credenciales hardcodeadas..."
PATTERNS=(
    "APP_USR-[0-9]+"
    "postgres://.*:.*@"
    "mongodb://.*:.*@"
    "mysql://.*:.*@"
    "AKIA[0-9A-Z]{16}"
    "sk_live_[0-9a-zA-Z]{24}"
    "sk_test_[0-9a-zA-Z]{24}"
)

for pattern in "${PATTERNS[@]}"; do
    if git diff --cached | grep -E "$pattern" > /dev/null; then
        echo -e "${RED}❌ ERROR: Posible credencial encontrada: $pattern${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ No se encontraron credenciales hardcodeadas${NC}"
fi
echo ""

# 3. Verificar archivos de log
echo "📋 Verificando archivos de log..."
if git diff --cached --name-only | grep -E "\.log$"; then
    echo -e "${YELLOW}⚠️  ADVERTENCIA: Intentando commitear archivos .log${NC}"
    echo "   Archivos encontrados:"
    git diff --cached --name-only | grep -E "\.log$" | sed 's/^/   - /'
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ No se encontraron archivos .log${NC}"
fi
echo ""

# 4. Verificar archivos de backup
echo "📋 Verificando archivos de backup..."
if git diff --cached --name-only | grep -E "\.(bak|backup|tmp)$"; then
    echo -e "${YELLOW}⚠️  ADVERTENCIA: Intentando commitear archivos de backup${NC}"
    echo "   Archivos encontrados:"
    git diff --cached --name-only | grep -E "\.(bak|backup|tmp)$" | sed 's/^/   - /'
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ No se encontraron archivos de backup${NC}"
fi
echo ""

# 5. Verificar información sensible en documentación
echo "📋 Verificando información sensible en documentación..."
SENSITIVE_PATTERNS=(
    "@gmail.com"
    "@hotmail.com"
    "password.*123"
)

for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    if git diff --cached | grep -E "$pattern" > /dev/null; then
        echo -e "${YELLOW}⚠️  ADVERTENCIA: Posible información sensible en documentación: $pattern${NC}"
    fi
done
echo -e "${GREEN}✅ Verificación de documentación completada${NC}"
echo ""

# Resultado final
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}❌ Se encontraron $ERRORS problema(s)${NC}"
    echo ""
    echo "Por favor, revisa los archivos antes de hacer commit."
    echo "Si necesitas commitear estos archivos, usa: git commit --no-verify"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
else
    echo -e "${GREEN}✅ Todas las verificaciones pasaron correctamente${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 0
fi
