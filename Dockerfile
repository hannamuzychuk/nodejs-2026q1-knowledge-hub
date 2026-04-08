# Stage 1 (build): 
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci --legacy-peer-deps

COPY . .

RUN npm run build


#Stage 2 (production):

FROM node:24-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /app/package*.json ./

RUN npm ci --omit=dev --legacy-peer-deps

COPY --from=builder /app/dist ./dist

USER node

EXPOSE 4000 

CMD ["node", "dist/main"]

