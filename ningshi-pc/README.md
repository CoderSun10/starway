# 凝时 · 桌面端（ningshi-pc）

独立 Electron 工程，**不依赖** `FocusPlan` App 源码目录。  
共用同一套后端 API（默认本机 `http://127.0.0.1:3001`）。

宣传与下载页（安装包不在本仓库）：[http://1.116.121.44:5000/](http://1.116.121.44:5000/)

## 开发

```bash
cd ningshi-pc
npm install
npm run dev
```

需先启动后端（例如 FocusPlan 的 Docker：`docker compose up -d`）。

## 打包

| 平台 | 命令 | 产物 |
|------|------|------|
| Windows 便携版 | `npm run dist:win` | `release/Ningshi-1.0.0-x64.exe`（免安装） |
| Windows 安装包 | 同上 | `release/Ningshi-Setup-1.0.0-x64.exe` |
| Ubuntu | `npm run dist:linux` | `release/ningshi_*.deb` |

### 为什么没有 `.deb` 文件？

打包是在 **Windows 本机** 上完成的。  
`electron-builder` 的 **Ubuntu `.deb` 必须在 Linux 环境生成**（或可用的 WSL），不能在纯 Windows 上稳定交叉编译。  
当前环境 **WSL 不可用**，因此 `release/` 里只有 Windows 的 `.exe`，没有 `.deb`——不是漏配，是环境限制。

在 **Ubuntu 电脑或 WSL** 里生成 deb：

```bash
cd ningshi-pc
npm install
npm run dist:linux
# 产物：release/ningshi_1.0.0_amd64.deb
```

> 若本机无开发者模式导致签名工具失败，已默认 `signAndEditExecutable: false`。

### 图标

与安卓 App 同源：`FocusPlan/assets/icon.png`（黑底金表）已复制到 `build/icon.png` / 托盘图标。

### 已打好的 Windows 产物（本机）

路径：`ningshi-pc/release/`

- `Ningshi-1.0.0-x64.exe` — 便携版，双击即用  
- `Ningshi-Setup-1.0.0-x64.exe` — 安装版  

## 功能一览

- 专注计时（墙钟）、保存会话（关联计划 / 自由记录）
- 计划 CRUD、任务完成度滑块（详情页即时保存）
- 统计：近 7/30 天、饼图 Top5+其他
- 四套主题、结束提示音（本地合成）、系统通知
- 系统托盘、关闭最小化到托盘、开机自启
- 打包：Windows Setup.exe / Ubuntu .deb

## 技术栈

- Electron 33
- Vite + React 18
- React Router / Zustand / Axios / Recharts / Day.js
