# Stage 1 (build): 
FROM node:24-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./

RUN npm ci --legacy-peer-deps

COPY . .


RUN npx prisma generate

RUN npm run build


#Stage 2 (production):

FROM node:24-alpine AS runner

RUN apk add --no-cache openssl wget

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev --legacy-peer-deps

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist

USER node

EXPOSE 4000

CMD ["node", "dist/main.js"]
