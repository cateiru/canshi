FROM node:24-slim

# Node.js 25 以降は corepack が Node.js 本体に同梱されないため、npm で入れてから有効にする。
# pnpm のバージョンは package.json の packageManager に従う
RUN npm install -g corepack && corepack enable
ENV PNPM_CONFIG_STORE_DIR=/root/.local/share/pnpm/store

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["pnpm", "dev"]
