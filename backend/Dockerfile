FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache postgresql-client redis

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
