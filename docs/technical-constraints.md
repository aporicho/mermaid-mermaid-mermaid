# 技术约束

本文档记录跨模块的基础技术约束。新增编辑器能力时，优先遵守这里的术语和边界，避免 UI、CLI、Mermaid 源码和内部模型互相污染。

## 应用运行边界

- 前端统一使用 Vite + React SPA。普通网页版只承诺 Mermaid 编辑、查看、导入和导出；实时 AI 上下文属于桌面版或显式本地 bridge。
- 桌面版使用 Tauri v2。Tauri 负责窗口、真实文件读写、应用状态、安装包和本地 AI bridge；React 负责编辑器体验。
- 不再依赖 Next runtime、Next API routes 或固定 `127.0.0.1:3000`。新增本地服务能力必须放在 Tauri/CLI bridge 边界。
- `editor-runtime.ts` 是 Web/desktop 平台能力的唯一前端适配层。组件不能直接调用浏览器文件选择 API、Tauri invoke、AI bridge HTTP endpoint 或本地持久化 API。
- AI CLI 实时命令默认读取 `~/.mermaid-canvas-editor/bridge.json`，并带 bearer token 访问随机 loopback bridge。CLI 读到的是当前编辑器会话状态，不是磁盘文件快照。

## Mermaid 术语边界

- 内部图模型使用 `node` 和 `edge`。`CanvasNode`、`MermaidGraph.nodes`、布局、选择、几何和连线路由都继续使用图论语义。
- Mermaid 源码层使用 `id`、`label` 和 `shape`。例如 `N1@{ shape: rect, label: "WebUI" }` 中，`N1` 是稳定节点 ID，不是源码关键字。
- AI/CLI 修改 Mermaid 时必须优先用节点 ID 定位对象，不能用 label 作为唯一标识。label 是用户可读文本，可以重复或被频繁改写。
- WebUI 可以向用户展示“节点 ID”，但不应把 Mermaid 源码里的 ID 描述成新的对象类型。
- 新建节点默认 ID 使用 `N1`、`N2`、`N3` 序列。解析已有 Mermaid 时不迁移 `A`、`WebUI`、`Node1` 等历史或用户自定义 ID。

## 视觉主题边界

- 应用级 token 清单以 [theme-tokens.md](theme-tokens.md) 为准。新增主题字段、画布视觉字段、Mermaid 变量映射和对象级覆盖时，必须先归入该 token 体系。
- WebUI 使用暖纸底、近黑细线和少量珊瑚红强调。红色只用于 selected、active、connection target、primary command 和关键反馈，不作为大面积背景。
- 普通 UI 颜色必须优先使用 shadcn token，例如 `bg-background`、`bg-card`、`text-foreground`、`border-border`、`text-muted-foreground`、`bg-primary`。
- 主题设置页只能修改主题 token。业务组件不直接保存用户主题色，也不绕过 `editor-theme.ts` 自行转换 CSS、Konva 或 Mermaid 渲染变量。
- 高亮按钮使用 `bg-primary`，图标和文字使用背景色 token，例如 `text-background` 或 `text-primary-foreground`。未激活图标使用 `text-icon`。
- Konva 画布颜色必须集中在 `CANVAS_VISUAL_TOKENS`，节点、连线、锚点、对齐辅助线、网格和草稿线不能在渲染组件里分散硬编码主题色。
- 手写样式只能作为 shadcn token 的扩展，例如源码面板行背景和渲染视图网格；这些扩展必须继续引用 CSS variables。
- 图标统一使用 Iconoir。新增按钮、菜单项和工具入口必须沿用现有尺寸、间距和 hover/active 规则。
