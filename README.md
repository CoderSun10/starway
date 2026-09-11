# 星程 Starway

个人桌面应用：**时间**（专注、计划、番茄钟）与 **用度**（预算、记账）分栏使用，日历作公共首页。

本仓库是 **一期（v1）**。单用户、无登录；Electron 桌面端 + Express / MySQL 后端。不做手机端，暂不打包安装包。

仓库地址：<https://github.com/CoderSun10/starway>

## 一期范围

已包含：

- 无边框圆角窗口、系统托盘、关闭进托盘、开机自启
- 日历：普通 / 热力图；格子显示当日专注分钟与花费
- 时间：计时、跨天计划与任务、专注统计（柱状 / 折线 / 饼图、平均线）
- 用度：按日记账、预算时段、花费统计
- 主题：石墨 / 晴空 / 暖阳 / 桃雾
- Docker Compose 一键起 MySQL + API；启动时自动跑 migration

明确不做（留给后续）：

- 账号密码、多用户
- 打包 exe / deb（开发模式 `npm run dev` 即可）
- 手机 App、银行流水同步、多币种

## 结构

```
.
├── backend/              # REST API（Express + mysql2）
│   ├── src/
│   ├── sql/              # schema.sql、seed.sql、migrations/
│   └── scripts/          # load-demo.js 演示数据
├── docker-compose.yml
├── .env.example
├── docs/PHASE1.md        # 一期说明
└── ningshi-pc/           # 桌面端（Electron + Vite + React）
    ├── src/
    └── electron/
```

目录名 `ningshi-pc` 是历史遗留，产品名以「星程 / Starway」为准。

## 环境

- Node.js 18+
- Docker Desktop（MySQL 8；也可只起数据库、本机跑 API）

## 配置

```powershell
copy .env.example .env
copy backend\.env.example backend\.env
copy ningshi-pc\.env.example ningshi-pc\.env
```

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp ningshi-pc/.env.example ningshi-pc/.env
```

把 `changeme` 换成自己的密码。**不要提交 `.env`。**

桌面端默认请求 `http://127.0.0.1:3001`。换机器或换服务器时，在应用 **设置** 里改 API 地址即可，无需重新打包。

## 启动

仓库根目录：

```bash
docker compose up -d --build
```

| 服务 | 默认容器 | 端口 |
|------|----------|------|
| MySQL 8 | `ningshi_mysql` | 3310 → 3306 |
| API | `ningshi_api` | 3001 |

健康检查：<http://127.0.0.1:3001/health>

桌面端：

```bash
cd ningshi-pc
npm install
npm run dev
```

会打开 Electron，开发页 <http://127.0.0.1:5173>。

仅本机跑 API、数据库仍用 Docker：

```bash
docker compose up -d mysql
cd backend
npm install
npm run dev
```

演示数据（会清空计划 / 会话 / 账本后重灌，仅开发用）：

```bash
cd backend
node scripts/load-demo.js
```

演示数据截止 **2026-09-11**（含当天）。

## 主要接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/schedules` | 时间计划 |
| GET/PUT/DELETE | `/api/schedules/:id` | 计划详情 |
| GET/PATCH/DELETE | `/api/tasks` | 任务 |
| GET/POST | `/api/sessions` | 番茄会话（支持 `limit` / `offset`） |
| GET | `/api/stats/overview` | 今日 / 周 / 月 |
| GET | `/api/stats/daily?days=7` | 按天 |
| GET | `/api/stats/by-schedule` | 按计划分布 |
| GET | `/api/stats/day-summary` | 月历每日专注 + 花费 |
| GET/PUT | `/api/settings` | 时区等 |
| GET/POST | `/api/budget-periods` | 用度预算时段 |
| GET/POST | `/api/expenses` | 按日记账（含 `created_at` 填写时间） |

时间一律存 **UTC**，界面按 `Asia/Shanghai` 日历日。金额库内为 **分**，界面为元。

## 约定

- 单用户、无鉴权。不要把此 API 暴露到公网而不加保护。
- 一期不改库名 `focusplan`、容器名前缀，以免打断已有数据卷。

## 许可

MIT。见 [LICENSE](LICENSE)。
