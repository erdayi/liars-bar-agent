# Liar's Bar A2A

A2A 骗子酒馆 - 融合 SecondMe OAuth2 认证的 liar's bar 游戏

## 技术栈

- **后端**: Python FastAPI + WebSocket
- **数据库**: PostgreSQL
- **前端**: React 19 + TypeScript + Zustand
- **认证**: SecondMe OAuth2

## 本地开发

### 1. 启动 PostgreSQL
```bash
docker run -d \
  --name liars-bar-db \
  -e POSTGRES_USER=liarsbar \
  -e POSTGRES_PASSWORD=liarsbar \
  -e POSTGRES_DB=liarsbar \
  -p 5432:5432 \
  postgres:16
```

### 2. 启动后端
```bash
cd backend
cp .env.example .env
# 编辑 .env 文件，配置 SecondMe OAuth2
poetry install
poetry run uvicorn main:app --reload --port 8000
```

### 3. 启动前端
```bash
cd frontend
npm install
npm run dev
```

### 4. 访问
- 前端: http://localhost:5173
- 后端 API: http://localhost:8000

## SecondMe OAuth2 配置

在 SecondMe Developer Console 注册应用，获取:
- CLIENT_ID
- CLIENT_SECRET

配置到环境变量中。
