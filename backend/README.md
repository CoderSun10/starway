# 星程 Starway · Backend

轻量 Node.js + Express + mysql2 REST API，供桌面端调用。

## 推荐：全 Docker 运行

在仓库**根目录**：

```bash
copy .env.example .env
docker compose up -d --build
docker compose logs -f api
```

| 容器 | 名称（可用 `.env` 覆盖） | 端口 |
|------|------|------|
| MySQL 8 | `starway_mysql` | 3310→3306 |
| API | `starway_api` | 3001→3001 |

容器内 API 通过服务名 `mysql:3306` 连库（不要写 127.0.0.1）。

## 数据库表结构

| 表名 | 说明 |
|------|------|
| `schedules` | 计划：标题、描述、开始/结束时间(UTC)、预计总工时(分钟) |
| `tasks` | 任务：归属计划、描述、预计时长、排序 |
| `pomodoro_sessions` | 番茄会话：开始/结束(UTC)、时长、关联计划/任务、自由内容 |
| `app_settings` | 客户端设置（如时区模式） |

详细字段见 `sql/schema.sql`。

**约定：** 所有 `DATETIME` 存 **UTC**；统计按 `Asia/Shanghai` 日历日聚合（`CONVERT_TZ`）。

## 本地启动（MySQL 用 Docker，API 用 Node）

```bash
docker compose up -d mysql
cd backend
copy .env.example .env
npm install
npm run dev
```

默认：`http://127.0.0.1:3001`

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| PORT | 3001 | 服务端口 |
| DB_HOST | 127.0.0.1 | MySQL 主机 |
| DB_PORT | 3310 | 映射端口（避开旧项目常用的 3307） |
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
