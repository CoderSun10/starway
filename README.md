# 星程 Starway

个人桌面应用：用日历看一天，**时间**管专注、计划与番茄钟，**用度**管预算和记账。

Electron 桌面端 + Express / MySQL 后端。单用户、无登录。

仓库：<https://github.com/CoderSun10/starway>

## 功能

- 无边框圆角窗口、系统托盘、关闭进托盘、开机自启
- 日历：普通视图 / 热力图；格子显示当日专注分钟与花费
- 时间：计时、跨天计划与任务、专注统计（柱状 / 折线 / 饼图、平均线）
- 用度：按日记账、预算时段、每月固定支出、花费统计
- 主题：石墨 / 晴空 / 暖阳 / 桃雾
- 邮箱 + 密码登录；注册 / 重置密码发 6 位邮箱验证码（QQ SMTP）
- 计划、番茄、记账按账号隔离
- Docker Compose 一键启动 MySQL + API；启动时自动跑 migration
- Windows 便携版 / 安装包，Ubuntu `.deb`

当前不做：手机 App、银行流水同步、多币种。

## 结构

```
.
├── backend/              # REST API（Express + mysql2）
│   ├── src/
│   └── sql/              # schema.sql、migrations/
├── docker-compose.yml
├── .env.example
└── starway-pc/           # 桌面端（Electron + Vite + React）
    ├── src/
    └── electron/
```

## 环境

- Node.js 18+
- Docker Desktop（MySQL 8；也可只起数据库、本机跑 API）

## 配置

```powershell
copy .env.example .env
copy backend\.env.example backend\.env
```

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

把 `changeme` 换成自己的密码，把 `JWT_SECRET` 换成随机长串。
发验证码需要 QQ 邮箱 SMTP：`EMAIL_USER` 为邮箱，`EMAIL_PASS` 为邮箱授权码（不是登录密码）。**不要提交 `.env`。**

桌面端不在这里配：它按环境自动读 `starway-pc/.env.development`（开发，连 `http://127.0.0.1:3001`）和 `.env.production`（打包发行，连线上 API）。这两个文件随仓库提交，要改地址改它们。

## 启动

仓库根目录：

```bash
docker compose up -d --build
```

| 服务 | 默认容器 | 端口 |
|------|----------|------|
| MySQL 8 | `starway_mysql` | 3310 → 3306 |
| API | `starway_api` | 3001 |

健康检查：<http://127.0.0.1:3001/health>

桌面端：

```bash
cd starway-pc
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

## 打包

```bash
cd starway-pc
npm run dist:win      # Windows 便携版 + 安装包
npm run dist:linux    # Ubuntu .deb（需在 Linux / WSL 上执行）
```

产物在 `starway-pc/release/`：`Starway-*.exe`、`Starway-Setup-*.exe`、`starway_*.deb`。

## 主要接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/send-code` | 发送邮箱验证码（register / reset） |
| POST | `/api/auth/register` | 验证码注册 |
| POST | `/api/auth/login` | 邮箱登录 |
| GET | `/api/auth/me` | 当前用户 |
| POST | `/api/auth/reset-password` | 验证码重置密码 |
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
| GET/PUT/DELETE | `/api/expenses/:id` | 账目详情 |
| GET/POST | `/api/fixed-expenses` | 每月固定支出模板（花呗 / 订阅 / 梯子） |
| GET | `/api/fixed-expenses/month?month=YYYY-MM` | 某月清单：实际金额、已付状态、合计 |
| PUT/DELETE | `/api/fixed-expenses/:id` | 固定支出详情 |
| PUT | `/api/fixed-expenses/:id/month/:month` | 记某月实际：`amount_fen` / `paid` / `reset` |

时间一律存 **UTC**，界面按 `Asia/Shanghai` 日历日。金额库内为 **分**，界面为元。

## 约定

- 业务接口需要登录（Bearer JWT）。不要把此 API 暴露到公网而不加保护。
- MySQL 数据卷名保持 `focusplan_mysql_data`，库名 `focusplan`，升级容器名不会丢掉已有数据。

## 许可

MIT。见 [LICENSE](LICENSE)。
