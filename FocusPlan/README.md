# FocusPlan（专注计划）

基于 **Expo SDK 54（JavaScript）+ Express + MySQL 8.0** 的专注计划与番茄钟应用。

宣传与下载页（不在本仓库）：[http://1.116.121.44:5000/](http://1.116.121.44:5000/)  
桌面端源码见仓库根目录 `ningshi-pc/`。

> 技术取舍：**全栈使用 JavaScript（非 TypeScript）**，便于快速落地与直接运行。数据层不使用 AsyncStorage/SQLite 作为主存储，统一走 MySQL REST API。  
> **SDK 版本：54**（与当前 Expo Go 兼容；React 19.1 / React Native 0.81）。

## 功能闭环

1. **计划安排**：创建跨天时间段计划、任务列表、任务时长之和必须等于预计总工时  
2. **番茄钟**：1~200 分钟、开始/暂停/结束、常亮、通知/震动/铃声、结束后关联计划或自由填写  
3. **统计图表**：今日/本周/本月、7/30 天柱状图与折线、按计划饼图、历史会话  
4. **时区**：默认 `Asia/Shanghai`，设置页可切换设备本地；**库内统一存 UTC**

## 目录结构

```
FocusPlan/
├── App.js                 # 入口
├── src/
│   ├── components/        # UI 组件
│   ├── screens/           # 计划 / 计时器 / 统计 / 设置
│   ├── navigation/
│   ├── services/api.js    # Axios 封装
│   ├── stores/            # Zustand
│   ├── utils/time.js      # dayjs 时区工具
│   └── constants/theme.js
├── backend/               # Express + mysql2
│   ├── src/
│   ├── sql/schema.sql
│   └── sql/seed.sql
├── docker-compose.yml
└── package.json
```

## 环境要求

- Node.js 18+
- Docker Desktop（MySQL 8.0）
- Expo Go（手机）或 Android/iOS 模拟器

## 一、配置环境变量

```bash
copy .env.example .env
copy backend\.env.example backend\.env
```

把其中的占位符改成你自己的密码与地址。`.env` 不会进 Git。

## 二、启动 MySQL（Docker）

在项目根目录 `FocusPlan/` 执行：

```bash
docker compose up -d
```

| 项 | 值 |
|----|-----|
| 容器名 | `.env` 中 `MYSQL_CONTAINER`，默认 `ningshi_mysql` |
| 端口 | **3307 → 3306** |
| 库名 | `focusplan` |
| 密码 | 只写在 `.env` 的 `MYSQL_ROOT_PASSWORD` / `MYSQL_PASSWORD` |

首次启动会自动执行：

- `backend/sql/schema.sql` — 建表  
- `backend/sql/seed.sql` — 示例数据  

查看状态：

```bash
docker compose ps
docker compose logs mysql
```

重置数据（会清空卷）：

```bash
docker compose down -v
docker compose up -d
```

## 三、启动后端 API

```bash
cd backend
copy .env.example .env   # Windows；macOS/Linux: cp .env.example .env
npm install
npm run dev
```

默认地址：`http://127.0.0.1:3001`  
健康检查：`http://127.0.0.1:3001/health`

### 后端环境变量（`backend/.env`）

| 变量 | 默认 | 说明 |
|------|------|------|
| PORT | 3001 | API 端口 |
| DB_HOST | 127.0.0.1 | MySQL 主机 |
| DB_PORT | 3307 | Docker 映射端口 |
| DB_USER | root | 用户 |
| DB_PASSWORD | （必填，见 `.env`） | 密码 |
| DB_NAME | focusplan | 数据库 |

### 主要 REST 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/schedules` | 计划列表 / 创建（含任务校验） |
| GET/PUT/DELETE | `/api/schedules/:id` | 计划详情与更新 |
| GET/PATCH/DELETE | `/api/tasks` | 任务 |
| GET/POST | `/api/sessions` | 番茄会话 |
| GET | `/api/stats/overview` | 今日/周/月概览 |
| GET | `/api/stats/daily?days=7` | 按天聚合 |
| GET | `/api/stats/by-schedule` | 按计划分布 |
| GET | `/api/stats/schedule/:id` | 单计划进度 |
| GET/PUT | `/api/settings` | 时区模式等 |

## 四、启动 Expo 前端

```bash
# 在 FocusPlan 根目录
npm install
npx expo start
```

用 Expo Go 扫码，或按 `a` / `i` 打开模拟器。

### API baseURL 说明

前端默认：

| 环境 | 默认地址 |
|------|----------|
| iOS 模拟器 | `http://127.0.0.1:3001` |
| Android 模拟器 | `http://10.0.2.2:3001` |
| 真机 | 需手动改成电脑局域网 IP |

**真机调试：**

1. 电脑与手机同一 Wi-Fi  
2. 查电脑 IP（Windows：`ipconfig`，如 `192.168.1.8`）  
3. 后端需监听 `0.0.0.0`（已默认）  
4. 在 App **设置**页把 API 改为电脑局域网地址，点「测试连接」  
5. 若公司网络隔离，可用 [ngrok](https://ngrok.com/)：  
   `ngrok http 3001` → 将 HTTPS 地址填入设置  

防火墙需放行 **3001** 端口。

也可改 `app.json` → `extra.apiBaseUrl`。

## 五、数据库表（摘要）

### schedules

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| title | VARCHAR | 标题 |
| start_at / end_at | DATETIME | **UTC** 时间段（可跨天） |
| planned_minutes | INT | 预计总工时（分钟） |

### tasks

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| schedule_id | FK | 所属计划 |
| description | VARCHAR | 描述 |
| planned_minutes | INT | 预计分钟 |
| sort_order | INT | 排序 |

### pomodoro_sessions

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| schedule_id / task_id | FK 可空 | 关联计划/任务 |
| content | VARCHAR 可空 | 自由内容 |
| started_at / ended_at | DATETIME | **UTC** |
| duration_minutes | INT | 实际时长 |

完整 DDL：`backend/sql/schema.sql`。

## 六、推荐自测路径

1. Docker 起库 → 后端 `/health` 返回 OK  
2. App 设置页「测试连接」成功  
3. 新建计划：总工时 60 分钟，两个任务 30+30，保存  
4. 计时器设 1 分钟 → 开始 → 结束后关联计划/任务 → 保存  
5. 统计页看到今日时长与图表；计划详情看到进度条  

## 七、技术取舍说明

| 点 | 选择 | 理由 |
|----|------|------|
| 语言 | **JavaScript** | 按需求简化，避免 TS 配置与类型摩擦 |
| 导航 | React Navigation Tabs + Stack | 结构清晰，无需文件路由心智负担 |
| 状态 | Zustand | 轻量，适合计时器与设置 |
| 存储 | MySQL + Express | 移动端不直连 DB，安全且可统计 |
| 图表 | react-native-chart-kit | 依赖少，柱/线/饼足够 |
| 铃声 | expo-av + 远程短音 | 免打包本地音频；无网时仍有震动/通知 |
| 任务排序 | 上移/下移 | 比拖拽依赖更少，实现稳定 |

## 八、常见问题

**Q: Android 真机连不上 API？**  
A: 不要用 `10.0.2.2`（仅模拟器）。用电脑局域网 IP，并确认后端与防火墙。

**Q: Docker 初始化 SQL 没生效？**  
A: 初始化脚本只在**数据卷首次创建**时执行。需 `docker compose down -v` 后重建。

**Q: 通知不弹出？**  
A: 首次进入会请求权限；Android 13+ 需允许通知。真机效果优于模拟器。

**Q: 跨天计划怎么算「今天」？**  
A: 列表按「时间段与当日有交集」过滤；统计会话按 **started_at** 所在日历日（默认上海）归属。

---

FocusPlan · 专注每一段计划
