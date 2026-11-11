FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# pg_dump / pg_restore pour les sauvegardes automatiques (Owner Control). Leur version doit être ≥ celle du serveur PostgreSQL (sinon pg_dump refuse).
RUN apk add --no-cache postgresql-client
COPY package.json package-lock.json ./
# Construction reproductible : npm ci refuse de continuer si le verrou et package.json divergent.
# Si le fichier package-lock.json manque, la construction échoue ici (lancez « npm install » puis versionnez-le).
RUN npm ci --omit=dev
COPY server ./server
COPY migrations ./migrations
COPY public ./public
# Dossier des sauvegardes (BACKUP_DIR) : en production, monter un disque PERSISTANT dessus, sinon les fichiers disparaissent au redéploiement.
RUN mkdir -p /app/backups && chown node:node /app/backups
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:${PORT:-8080}/api/health || exit 1
CMD ["node", "server/index.js"]
