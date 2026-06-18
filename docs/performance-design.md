# 性能设计

本文档定义编辑器的性能边界。新增功能时必须先判断代码属于热路径、提交路径还是重任务路径，避免把源码序列化、Mermaid 渲染、持久化等重活放回高频输入事件。

## 目标

- 目标设备按 MacBook 120Hz 触控板设计。
- 触控板平移、捏合缩放、节点拖拽、组拖拽、框选、连线预览属于热路径，视觉反馈目标是下一帧内完成。
- 源码同步、历史记录、文件 dirty 状态、草稿持久化、Mermaid render 和 AI bridge 上报属于提交路径或重任务路径，不能逐帧执行。

## 路径分层

### 热路径

热路径只允许做必要的命令式视觉更新和轻量命中计算：

- Konva Stage viewport 使用命令式 position/scale 更新。
- 渲染视图使用 DOM transform 更新。
- wheel、gesture、pointer move 通过 requestAnimationFrame 合并。
- 画布和渲染视图的 viewport 热路径必须复用 `useViewportScheduler`，先更新视觉，再延迟提交 React 状态或 `viewport.set` 命令。
- 热路径可以写 ref，不能依赖 React 每个事件都完成 render。

### 提交路径

提交路径在明确边界运行：

- 节点拖拽结束后同步 Mermaid 源码一次。
- 组拖拽结束后同步 Mermaid 源码一次，拖拽中只更新组内节点位置的 draft graph。
- 节点或组拖拽结束后再计算自动归组并提交源码，不能在 pointer move 中改 Mermaid 结构。
- 连线创建、端点重连、文本编辑提交时同步 graph/source/history。
- viewport 停顿后低频提交到 React state。
- 画布 viewport 停顿后通过 `EditorCommand` 提交 `viewport.set`，渲染视图 viewport 停顿后提交本地 React state。
- 草稿持久化使用 debounce 写入。网页版落到 localStorage，桌面版落到 Tauri 应用状态。
- AI bridge 上下文只在选择、编辑、视口稳定或定时心跳时上报，不能跟随 pointer move 每帧请求。

### 重任务路径

重任务必须防抖、缓存或版本保护：

- Mermaid render 使用 source/theme 缓存。
- Mermaid render 使用 version token，旧异步结果不能覆盖新输入。
- 源码解析、源码序列化和 Mermaid render 需要记录开发态耗时。

## 开发态观测

开发环境会把轻量指标写入 `window.__MERMAID_EDITOR_PERF__`：

- `metrics`：最近的耗时样本，例如 viewport visual latency、Mermaid render、源码解析、源码序列化。
- `counters`：计数器，例如 render cache hit、草稿写入。

在浏览器控制台查看：

```js
window.__MERMAID_EDITOR_PERF__
```

可在 DevTools 里用下面的片段汇总单项指标的 p50/p95/max：

```js
const values = window.__MERMAID_EDITOR_PERF__.metrics
  .filter((metric) => metric.name === "canvas-viewport-visual-latency")
  .map((metric) => metric.value)
  .sort((a, b) => a - b);
const pick = (ratio) => values[Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * ratio) - 1))];
({ count: values.length, p50: pick(0.5), p95: pick(0.95), max: values.at(-1) });
```

## 大图验收

使用 CLI 生成可重复的大图夹具：

```bash
npm run mmm -- fixture --size 100 --out /tmp/mermaid-perf-100.mmd
npm run mmm -- fixture --size 300 --out /tmp/mermaid-perf-300.mmd
npm run mmm -- fixture --size 800 --out /tmp/mermaid-perf-800.mmd
```

验收目标：

- 800 节点场景下，触控板平移和缩放的 `canvas-viewport-visual-latency` p95 目标不超过 20ms。
- 高频输入期间不应出现 `serialize-mermaid`、`mermaid-render`、history、草稿写入或 AI bridge 请求类指标。
- 大图下节点拖拽、组拖拽、框选、连线、重连和视图过滤器保持功能正确。
- 发布前必须通过 `npm run ready`；该命令会运行测试、类型检查、Vite 生产构建，并在验收成功后保持前端调试服务持续运行。
- 桌面发布前必须额外通过 `npm run desktop:build`。Linux/WSL 环境需要先安装 Tauri/WebView/Wayland 等系统依赖。
- `mmm context` 本地 bridge 响应目标不超过 50ms，`mmm apply` 到编辑器生效目标不超过 500ms。

## 约束

- 不允许在 pointer move、wheel、gesture change 中执行 `serializeMermaid`、`mermaid.render`、草稿写入、AI bridge 请求或历史记录写入。
- 不允许在拖拽过程中逐帧写 Mermaid 源码；拖拽中只更新 graph draft，拖拽结束再同步 source。
- Konva 大图渲染必须先通过 render scope 控制绘制量；裁剪只能影响绘制列表，不能改变命中语义、提交结果或 Mermaid 图结构。
- 组 bounds 必须由节点几何和子组几何的 memoized pure helper 派生，不能在 Konva shape handler 中临时扫描 Mermaid 源码。
- 组级连线必须复用现有边路由纯函数，不能在渲染组件中单独计算路径。
- 新增大图能力前，优先复用现有几何、路由、视觉状态纯函数，并为缓存策略补测试。
