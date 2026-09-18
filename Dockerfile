ARG NODE_VERSION
FROM node:${NODE_VERSION}-slim

RUN npm i -g corepack && corepack enable
ENV PNPM_CONFIG_STORE_DIR=/root/.local/share/pnpm/store

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["pnpm", "dev"]
