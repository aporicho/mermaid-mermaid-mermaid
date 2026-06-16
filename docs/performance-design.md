# 性能设计

本文档定义编辑器的性能边界。新增功能时必须先判断代码属于热路径、提交路径还是重任务路径，避免把源码序列化、Mermaid 渲染、持久化等重活放回高频输入事件。

## 目标

- 目标设备按 MacBook 120Hz 触控板设计。
- 触控板平移、捏合缩放、节点拖拽、框选、连线预览属于热路径，视觉反馈目标是下一帧内完成。
- 源码同步、历史记录、文件 dirty 状态、localStorage、Mermaid render 属于提交路径或重任务路径，不能逐帧执行。

## 路径分层

### 热路径

热路径只允许做必要的命令式视觉更新和轻量命中计算：

- Konva Stage viewport 使用命令式 position/scale 更新。
- 渲染视图使用 DOM transform 更新。
- wheel、gesture、pointer move 通过 requestAnimationFrame 合并。
- 热路径可以写 ref，不能依赖 React 每个事件都完成 render。

### 提交路径

提交路径在明确边界运行：

- 节点拖拽结束后同步 Mermaid 源码一次。
- 连线创建、端点重连、文本编辑提交时同步 graph/source/history。
- viewport 停顿后低频提交到 React state。
- localStorage 使用 debounce 写入。

### 重任务路径

重任务必须防抖、缓存或版本保护：

- Mermaid render 使用 source/theme 缓存。
- Mermaid render 使用 version token，旧异步结果不能覆盖新输入。
- 源码解析、源码序列化和 Mermaid render 需要记录开发态耗时。

## 开发态观测

开发环境会把轻量指标写入 `window.__MERMAID_EDITOR_PERF__`：

- `metrics`：最近的耗时样本，例如 viewport visual latency、Mermaid render、源码解析、源码序列化。
- `counters`：计数器，例如 render cache hit、localStorage write。

在浏览器控制台查看：

```js
window.__MERMAID_EDITOR_PERF__
```

## 约束

- 不允许在 pointer move、wheel、gesture change 中执行 `serializeMermaid`、`mermaid.render`、localStorage 写入或历史记录写入。
- 不允许在拖拽过程中逐帧写 Mermaid 源码；拖拽中只更新 graph draft，拖拽结束再同步 source。
- 新增大图能力前，优先复用现有几何、路由、视觉状态纯函数，并为缓存策略补测试。
