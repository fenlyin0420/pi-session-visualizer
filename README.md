# Pi Session Visualizer

**Open every pi session as a timeline, a graph, and a set of insights — without moving a single byte of your data.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Linux](https://img.shields.io/badge/Linux-AppImage-e10e0e.svg)](#quick-start)
[![Platform: macOS](https://img.shields.io/badge/macOS-dmg-627ea5.svg)](#quick-start)
[![Platform: Windows](https://img.shields.io/badge/Windows-NSIS-282c39.svg)](#quick-start)
[![Local-first](https://img.shields.io/badge/Local-first-%E6%9C%A1%E6%9C%A1%E5%B9%B8-e74ce3.svg)](#local-first)

pi writes each session as plain `.jsonl` — great for machines, hard for humans. Pi Session Visualizer is a local-first desktop app (Electron + React + TypeScript) that opens those files read-only and turns them into:

- 📜 **Timeline** — every user message, Pi response, thinking block, tool call, and result in order, with markdown, code fences, and diff formatting
- 🕸️ **Relationship graph** — an event graph built from `parentId`, zoomable, with node → timeline jump-back
- 📊 **Insights** — tokens, cache, reasoning effort, cost, model, tool usage, activity distribution

| | |
| :--- | :--- |
| <img src="assets/screenshot-timeline.png" alt="Timeline view" width="560"> | <img src="assets/screenshot-graph.png" alt="Relationship graph" width="560"> |
| **Timeline** — thinking blocks, tool calls & results, diffs, compaction events, inline code highlighting | **Relationship graph** — event DAG by `parentId`, zoom/pan, click a node to inspect it |
| <img src="assets/screenshot-insights.png" alt="Insights dashboard" width="560"> | <img src="assets/screenshot-debug.png" alt="Error-aware timeline" width="560"> |
| **Insights** — token/cost breakdown, activity distribution, message composition, model usage | **Error-aware timeline** — error badges, filters (dialogue / tool / event / error), compact history |

## ✨ Features

- **Zero data movement** — reads `~/.pi/agent/sessions/**/*.jsonl` (and `~/.pi/agent/session`) in place; nothing is uploaded, stored, or mutated
- **Full event coverage** — `session`, `message`, `thinking`, tool calls/results, `model_change`, `thinking_level_change`, `context_edit`, `compaction`, `custom`
- **Search & filters** — full-text session search (⌘/Ctrl+K), workspace filter, active / error sessions
- **Insights dashboard** — total tokens (incl. cache & reasoning), estimated cost, tool usage, activity distribution, message composition
- **Any session root** — point the app at any directory of `.jsonl` files via the bottom-left controls; custom root is remembered
- **Live** — incremental file change detection every 2.5 s; open sessions refresh automatically
- **Export** — Markdown or JSONL export of the current session; native "open folder" access
- **Dark / light** — theme follows the OS
- **Hardened Electron** — no Node integration, context isolation + renderer sandbox on

## 🚀 Quick Start

### Linux (AppImage)

```bash
curl -Lo PiSessionVisualizer.AppImage \
  https://github.com/fenlyin0420/pi-session-visualizer/releases/latest/download/Pi.Session.Visualizer-0.1.0.AppImage
./PiSessionVisualizer.AppImage
```

### From source

Requires **Node.js ≥ 22.12**.

```bash
git clone https://github.com/fenlyin0420/pi-session-visualizer.git
cd pi-session-visualizer
npm install
npm run dev
```

On WSL or headless Linux without a working GPU sandbox, use:

```bash
npm run dev:linux   # --noSandbox + GPU disabled for dev processes only
```

The packaged app does **not** use these flags — it keeps `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.

### Build

```bash
npm run build      # typecheck + bundle (main / preload / renderer)
npm run dist       # platform installer into release/
npm run dist:dir   # unpacked dir for inspection
```

Targets: Linux AppImage · macOS dmg · Windows NSIS (Deb available after a homepage/maintainer email is configured).

## 🔒 Local-first by design

- Sessions are opened **read-only**; `.jsonl.bak` files are ignored
- The scan index lives in memory — close the app, nothing to migrate
- The only persistent state is your chosen session root in Electron's user data dir
- Renderer runs without Node access; everything is exposed through a `contextBridge`

## ⌨️ Shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘/Ctrl + K` | Focus session search |
| `⌘/Ctrl + R` | Rescan + reload current session |
| `Esc` | Clear / close search |

## 🛠 Project layout

```text
src/
├── main/       Electron main process: dir config, scan repo, JSONL parser
├── preload/    contextBridge API
├── renderer/   React UI: timeline, graph, insights
└── shared/     shared types
tests/          JSONL parser tests
```

The parser skips corrupt lines and counts them as session warnings — one bad line never takes the app down.

## 📄 License

[MIT](LICENSE)

---

## 中文说明

**Pi 会话可视化器** —— 用时间线、关系图和洞察面板打开你运行过的每一个 pi 会话，数据原地只读，不上传、不复制、不改写。

> [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

pi 把每个会话写成纯文本 `.jsonl`——对机器友好，对人不够友好。Pi Session Visualizer 是一款本地优先的桌面应用（Electron + React + TypeScript），直接读取这些文件，将其转成：

- 📜 **时间线** —— 用户消息、Pi 回复、思考块、工具调用与结果按序呈现，支持 Markdown、代码围栏与 Diff 渲染
- 🕸️ **关系图** —— 基于 `parentId` 构建的事件图，支持缩放/平移，点击节点可跳回时间线
- 📊 **洞察** —— Token、缓存、推理量、成本、模型与工具使用统计

| | |
| :--- | :--- |
| <img src="assets/screenshot-timeline.png" alt="时间线视图" width="560"> | <img src="assets/screenshot-graph.png" alt="关系图" width="560"> |
| **时间线** —— 思考块、工具调用/结果、Diff、压缩事件、代码高亮 | **关系图** —— 基于 `parentId` 的事件 DAG，缩放/平移，节点可跳转时间线 |
| <img src="assets/screenshot-insights.png" alt="洞察仪表盘" width="560"> | <img src="assets/screenshot-debug.png" alt="错误感知时间线" width="560"> |
| **洞察** —— Token/成本、活动分布、消息构成、模型使用 | **错误感知时间线** —— 错误徽标、筛选器（对话/工具/事件/错误）、压缩历史 |

### 功能

- **本地优先** —— 原地只读 `~/.pi/agent/sessions/**/*.jsonl`（兼容 `~/.pi/agent/session`），数据不上云
- **全事件覆盖** —— 会话、消息、思考、工具调用/结果、模型切换、思考等级变化、上下文编辑、压缩、自定义事件
- **检索与筛选** —— 全文检索（⌘/Ctrl+K）、工作区筛选、活跃/错误会话
- **洞察仪表盘** —— Token（含缓存与推理量）、预估成本、工具使用、活动分布、消息构成
- **任意会话目录** —— 左下角切换目录；自定义路径保存于 Electron 用户数据目录
- **实时刷新** —— 每 2.5 秒增量检测文件变化，活跃会话自动刷新
- **导出** —— Markdown / JSONL 导出当前会话；原生"打开位置"
- **跟随系统主题** —— 深色/浅色自动切换
- **加固的 Electron** —— 关闭 Node Integration、开启 Context Isolation 与 renderer 沙箱

### 快速开始

**Linux（AppImage）**

```bash
curl -Lo PiSessionVisualizer.AppImage \
  https://github.com/fenlyin0420/pi-session-visualizer/releases/latest/download/Pi.Session.Visualizer-0.1.0.AppImage
./PiSessionVisualizer.AppImage
```

**从源码运行**（需要 Node.js ≥ 22.12）

```bash
git clone https://github.com/fenlyin0420/pi-session-visualizer.git
cd pi-session-visualizer
npm install
npm run dev
```

WSL 或无 GPU 的 Linux 下，若 Chromium 沙箱/GPU 启动失败：

```bash
npm run dev:linux   # 仅开发进程使用 --noSandbox 并禁用 GPU
```

打包版不使用这些参数，窗口仍保持 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。

**构建**

```bash
npm run build      # 类型检查 + 打包（main/preload/renderer）
npm run dist       # 生成当前平台安装包（release/）
npm run dist:dir   # 仅生成解包目录
```

当前构建目标：Linux AppImage · macOS dmg · Windows NSIS（补充项目主页与维护者邮箱后可启用 Deb）。

### 本地优先

- 会话**只读**打开；忽略 `.jsonl.bak`
- 扫描索引仅存内存，关闭应用即消失，无需迁移
- 唯一持久状态：你选择的会话目录（保存于 Electron 用户数据目录）
- Renderer 无 Node 访问权，全部经 `contextBridge` 暴露

### 快捷键

| 快捷键 | 操作 |
| --- | --- |
| `⌘/Ctrl + K` | 聚焦会话搜索 |
| `⌘/Ctrl + R` | 重新扫描并读取当前会话 |
| `Esc` | 清空并退出搜索 |

### 项目结构

```text
src/
├── main/       主进程：目录配置、扫描仓库、JSONL 解析器
├── preload/    contextBridge API
├── renderer/   React 界面：时间线、关系图、洞察视图
└── shared/     共享类型
tests/          解析器测试
```

解析器会跳过损坏行并计入会话警告——单行坏数据不会让应用崩溃。

### 协议

[MIT](LICENSE)
