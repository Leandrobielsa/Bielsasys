# ─────────────────────────────────────────────────────────────
#  BielsaSys — Dockerfile
#  Proyecto ASIR · Leandro Bielsa Raro · 2025
# ─────────────────────────────────────────────────────────────

# Imagen base oficial de Node.js (LTS ligera)
FROM node:20-alpine

# Metadatos de la imagen
LABEL maintainer="Leandro Bielsa Raro"
LABEL description="BielsaSys B2B Hortofrutícola"
LABEL version="2.0"

# Crear directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar package.json primero (aprovecha caché de capas de Docker)
COPY package*.json ./

# Instalar dependencias (si las hubiera)
RUN npm install --production 2>/dev/null || true

# Copiar el resto del código fuente
COPY . .

# Crear carpeta de logs dentro del contenedor
RUN mkdir -p /app/logs

# Crear usuario no-root por seguridad (buena práctica ASIR)
RUN addgroup -S bielsagroup && adduser -S bielsauser -G bielsagroup
RUN chown -R bielsauser:bielsagroup /app
USER bielsauser

# Exponer el puerto de la aplicación
EXPOSE 3000

# Healthcheck: Docker comprobará que la app responde cada 30s
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Comando de arranque
CMD ["node", "server.js"]
