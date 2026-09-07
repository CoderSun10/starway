# 凝时 Backend

轻量 Node.js + Express + mysql2 REST API，供 Expo 移动端调用。

## 推荐：全 Docker 运行（本地 / 服务器同一套）

在项目**根目录** `FocusPlan/`：

```bash
# 先复制并填写 .env
copy .env.example .env

# 启动 MySQL + API（API 监听 3001）
docker compose up -d --build

# 看日志
docker compose logs -f api

# 更新代码后重新构建 API（MySQL 数据卷保留）
docker compose up -d --build api

# 停止
docker compose down
```

| 容器 | 名称（可用 `.env` 覆盖） | 端口 |
|------|------|------|
| MySQL 8 | `ningshi_mysql` | 3307→3306 |
| API | `ningshi_api` | 3001→3001 |

容器内 API 通过服务名 `mysql:3306` 连库（不要写 127.0.0.1）。

### 云服务器一键同步更新

本机改完 `backend/` 后：

```bash
node scripts/deploy-docker.js
```

主机、账号、密码从本机 `FocusPlan/.env` 读取（`DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_PASS`）。

## 数据库表结构

| 表名 | 说明 |
|------|------|
| `schedules` | 计划：标题、描述、开始/结束时间(UTC)、预计总工时(分钟) |
| `tasks` | 任务：归属计划、描述、预计时长、排序 |
| `pomodoro_sessions` | 番茄会话：开始/结束(UTC)、时长、关联计划/任务、自由内容 |
| `app_settings` | 客户端设置（如时区模式） |

详细字段见 `sql/schema.sql`。

**约定：** 所有 `DATETIME` 存 **UTC**；统计按 `Asia/Shanghai` 日历日聚合（`CONVERT_TZ`）。

## 本地启动

```bash
# 1. 根目录启动 MySQL
docker compose up -d

# 2. 安装依赖并启动 API
cd backend
cp .env.example .env   # Windows 可直接复制
npm install
npm run dev
```

默认：`http://127.0.0.1:3001`

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| PORT | 3001 | 服务端口 |
| DB_HOST | 127.0.0.1 | MySQL 主机 |
| DB_PORT | 3307 | 映射端口 |
| DB_USER | root | 用户 |
| DB_PASSWORD | （必填，见 `.env`） | 密码 |
| DB_NAME | focusplan | 库名 |

## 主要 API

- `GET/POST /api/schedules` — 计划列表 / 创建（含任务，校验时长之和）
- `GET/PUT/DELETE /api/schedules/:id`
- `GET/PATCH/DELETE /api/tasks`
- `GET/POST /api/sessions` — 番茄会话
- `GET /api/stats/overview|daily|by-schedule|by-task|schedule/:id`
- `GET/PUT /api/settings`
