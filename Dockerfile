FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# Thai TTF font for PDF export (admin-export.ts reads from ./fonts at runtime).
# If fonts/ is empty, PDF still generates but Thai renders as boxes.
COPY fonts ./fonts

EXPOSE 3000

CMD ["sh", "-c", "node_modules/.bin/prisma db push --accept-data-loss && node dist/app.js"]
