# 星程 Starway API — 生产镜像
FROM node:20-alpine

WORKDIR /app

# 仅安装生产依赖（加快构建、减小体积）
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

COPY src ./src
COPY sql ./sql

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
