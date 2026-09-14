# 星程 Starway · 桌面端

独立 Electron 工程。  
共用同一套后端 API。地址按环境从 `.env.development` / `.env.production` 读，源码里不写死：

| 模式 | 文件 | 地址 |
|------|------|------|
| 开发（`npm run dev` / `dev:web`） | `.env.development` | `http://127.0.0.1:3001` |
| 打包发行（`vite build` / `dist:*`） | `.env.production` | `http://49.234.199.55:3001` |

这两个文件随仓库提交，改地址改它们即可。`.env` 是个人本地覆盖，可选，不提交。

## 开发

```bash
cd starway-pc
npm install
npm run dev
```

`npm run dev` 开 Electron 窗口，`npm run dev:web` 只开浏览器页面（<http://127.0.0.1:5173>）。
`copy .env.example .env` 只在需要临时指向别的后端时才用。

需先启动后端（仓库根目录：`docker compose up -d --build`）。

## 打包

| 平台 | 命令 | 产物 |
|------|------|------|
| Windows 便携版 | `npm run dist:win` | `release/Starway-1.2.0-x64.exe`（免安装） |
| Windows 安装包 | 同上 | `release/Starway-Setup-1.2.0-x64.exe` |
| Ubuntu | `npm run dist:linux` | `release/starway_*.deb` |

### 为什么没有 `.deb` 文件？

打包是在 **Windows 本机** 上完成的。  
`electron-builder` 的 **Ubuntu `.deb` 必须在 Linux 环境生成**（或可用的 WSL），不能在纯 Windows 上稳定交叉编译。  
当前环境 **WSL 不可用**，因此 `release/` 里只有 Windows 的 `.exe`，没有 `.deb`——不是漏配，是环境限制。

在 **Ubuntu 电脑或 WSL** 里生成 deb：

```bash
cd starway-pc
npm install
npm run dist:linux
# 产物：release/starway_1.2.0_amd64.deb
```

> 若本机无开发者模式导致签名工具失败，已默认 `signAndEditExecutable: false`。

### 图标

应用图标在 `build/icon.png`，托盘图标在 `build/tray.png`。

### Windows 产物

路径：`starway-pc/release/`

- `Starway-1.2.0-x64.exe` — 便携版，双击即用  
- `Starway-Setup-1.2.0-x64.exe` — 安装版  

## 功能一览

- 专注计时（墙钟）、保存会话（关联计划 / 自由记录）
- 计划 CRUD、任务完成度滑块（详情页即时保存）
- 统计：近 7/30 天、饼图 Top5+其他
- 四套主题、结束提示音（本地合成）、系统通知
- 系统托盘、关闭最小化到托盘、开机自启
- 用度：按日记账、预算账本、每月固定支出（花呗 / 订阅 / 梯子，可按月改金额、标已付）
- 设置 → 关于：检查更新（读 GitHub Releases，可下载对应平台安装包）
- 打包：Windows Setup.exe / Ubuntu .deb

## 技术栈

- Electron 33
- Vite + React 18
- React Router / Zustand / Axios / Recharts / Day.js
