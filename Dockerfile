FROM node:22-slim

RUN corepack enable
ENV PNPM_CONFIG_STORE_DIR=/root/.local/share/pnpm/store

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["pnpm", "dev"]
