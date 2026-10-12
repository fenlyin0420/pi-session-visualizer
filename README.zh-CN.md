# Pi Session Visualizer（中文版）

🌐 [English](README.md) | **中文**

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

每个 [release](https://github.com/fenlyin0420/pi-session-visualizer/releases/latest) 都附带三平台安装包：

| 平台 | 文件 |
| --- | --- |
| Linux | `Pi.Session.Visualizer-0.1.0.AppImage` |
| macOS（universal，Intel + Apple Silicon 通用） | `Pi.Session.Visualizer-0.1.0-universal.dmg` |
| Windows | `Pi.Session.Visualizer.Setup.0.1.0.exe` |

**Linux（AppImage）**

```bash
curl -Lo PiSessionVisualizer.AppImage \
  https://github.com/fenlyin0420/pi-session-visualizer/releases/latest/download/Pi.Session.Visualizer-0.1.0.AppImage
chmod +x PiSessionVisualizer.AppImage
./PiSessionVisualizer.AppImage
```

**macOS（dmg）**

```bash
curl -Lo PiSessionVisualizer.dmg \
  https://github.com/fenlyin0420/pi-session-visualizer/releases/latest/download/Pi.Session.Visualizer-0.1.0-universal.dmg
open PiSessionVisualizer.dmg
```

把 **Pi Session Visualizer** 拖进 `/Applications`。安装包未签名，首次打开需右键 →「打开」，或：

```bash
xattr -dr com.apple.quarantine "/Applications/Pi Session Visualizer.app"
```

**Windows（NSIS）**

```powershell
Invoke-WebRequest -Uri https://github.com/fenlyin0420/pi-session-visualizer/releases/latest/download/Pi.Session.Visualizer.Setup.0.1.0.exe -OutFile PiSessionVisualizer-Setup.exe
.\PiSessionVisualizer-Setup.exe
```

安装包未签名，SmartScreen 提示时选「更多信息 → 仍要运行」。

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

当前构建目标：Linux AppImage · macOS dmg（universal）· Windows NSIS；打 `v*` tag 后由 CI 一次性构建三平台，见 [.github/workflows/release.yml](.github/workflows/release.yml)（补充项目主页与维护者邮箱后可启用 Deb）。

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
