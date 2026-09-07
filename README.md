# 凝时（Ningshi）

跨平台专注计划：在同一套 MySQL REST API 上，同时运行 **Expo 移动端** 与 **Electron 桌面端**。

本仓库只包含可运行的应用源码。宣传页、安装包、密钥和本机配置均不纳入版本库。

**宣传与下载页面（不在本仓库）：** [http://1.116.121.44:5000/](http://1.116.121.44:5000/)

## 仓库结构

```
.
├── FocusPlan/          # 移动端（Expo SDK 54）+ 后端（Express + MySQL）
│   ├── src/            # App 界面、状态、API 客户端
│   ├── backend/        # REST API、SQL 结构与种子数据
│   ├── docker-compose.yml
│   ├── .env.example    # 复制为 .env 后填写（不要提交 .env）
│   └── scripts/        # 可选：把 backend 同步到服务器
└── ningshi-pc/         # 桌面端（Electron + Vite + React）
    ├── src/
    └── electron/
```

未收录：

| 内容 | 说明 |
|------|------|
| `ningshi-promo/` | 宣传站，请访问 http://1.116.121.44:5000/ |
| `.env` | 密码、主机、部署账号等，只存在于本机 |
| `node_modules/`、`dist/`、`release/`、安装包 | 依赖与构建产物 |

## 功能

- 计划：跨天时间段、任务列表、任务时长之和等于预计总工时
- 番茄钟：开始 / 暂停 / 结束，结束后关联计划或自由记录
- 统计：今日 / 本周 / 本月，柱状图、折线、按计划分布
- 时区：默认 `Asia/Shanghai`，库内时间统一存 UTC
- 桌面端额外：系统托盘、关闭最小化到托盘、开机自启

## 环境

- Node.js 18+
- Docker Desktop（MySQL 8.0；也可用 compose 同时起 API）
- 移动端：Expo Go 或 Android / iOS 模拟器
- 桌面端：Windows / Linux（打包见 `ningshi-pc`）

## 配置（必做）

所有密码、数据库口令、云端 API 地址、SSH 部署信息都写在 **本机 `.env`**，仓库里只有占位模板。

```bash
cd FocusPlan
copy .env.example .env
copy backend\.env.example backend\.env
```

macOS / Linux：

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

然后编辑这两个文件，把 `changeme` 换成你自己的值。不要把 `.env` 提交到 Git。

## 1. 启动后端（MySQL + API）

在 `FocusPlan/` 下（已填好 `.env`）：

```bash
docker compose up -d --build
```

| 服务 | 默认容器名（可用 `.env` 覆盖） | 端口 |
|------|-------------------------------|------|
| MySQL 8 | `ningshi_mysql` | 3307 → 3306 |
| API | `ningshi_api` | 3001 |

首次启动会执行 `backend/sql/schema.sql` 与 `seed.sql`。

仅本机跑 API、MySQL 仍用 Docker 时：

```bash
cd FocusPlan/backend
# 已复制并填写 .env
npm install
npm run dev
```

默认：`http://127.0.0.1:3001`

重置数据库（会清空数据卷）：

```bash
docker compose down -v
docker compose up -d --build
```

### 主要接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/schedules` | 计划列表 / 创建 |
| GET/PUT/DELETE | `/api/schedules/:id` | 计划详情与更新 |
| GET/PATCH/DELETE | `/api/tasks` | 任务 |
| GET/POST | `/api/sessions` | 番茄会话 |
| GET | `/api/stats/overview` | 今日 / 周 / 月 |
| GET | `/api/stats/daily?days=7` | 按天聚合 |
| GET | `/api/stats/by-schedule` | 按计划分布 |
| GET/PUT | `/api/settings` | 时区等 |

## 2. 启动移动端

```bash
cd FocusPlan
npm install
npx expo start
```

默认 API 为 `http://127.0.0.1:3001`。云端或真机地址写在 `.env` 的 `EXPO_PUBLIC_API_BASE_URL`，也可在 App **设置** 里修改。

真机调试：电脑与手机同一 Wi-Fi，在设置里填电脑局域网地址，例如 `http://192.168.x.x:3001`，并点「测试连接」。Android 真机不要用 `10.0.2.2`（那是模拟器网关）。

打 Android 预览包：

```bash
cd FocusPlan
npx eas build -p android --profile preview
```

EAS 的 `projectId` / `owner` 同样放在本机 `.env`，不要写进 `app.json`。

## 3. 启动桌面端

后端需先可用（本机 `http://127.0.0.1:3001` 或在设置里改 API）。

```bash
cd ningshi-pc
npm install
npm run dev
```

打包：

| 平台 | 命令 | 产物目录 |
|------|------|----------|
| Windows 便携版 / 安装包 | `npm run dist:win` | `ningshi-pc/release/` |
| Linux `.deb` | 在 Linux 上执行 `npm run dist:linux` | 同上 |

已打好的安装包不在本仓库，请到宣传页下载：http://1.116.121.44:5000/

## 部署后端（可选）

`FocusPlan/scripts/` 用于把 `backend` 与 `docker-compose.yml` 同步到你的服务器。主机、账号、密码全部从本机 `.env` 读取。

需安装 `ssh2`：`npm install ssh2 --prefix FocusPlan`

```bash
cd FocusPlan
# 确认 .env 里已填写 DEPLOY_HOST / DEPLOY_USER / DEPLOY_PASS
node scripts/deploy-docker.js
```

## 许可

源码按仓库现状提供，供学习与运行。
