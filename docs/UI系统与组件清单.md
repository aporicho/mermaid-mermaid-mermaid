# UI 系统与组件清单

本文档是编辑器界面的代码清单与统一约束。目标是统一结构和交互语义，同时让颜色、圆角、边线、密度、排版、图标和动效继续由主题决定。画布中的 Mermaid 语义图形、节点内容卡片和第三方组件内部结构不在 DOM UI 重构范围内。

## 分层

| 层级 | 位置 | 职责 |
| --- | --- | --- |
| 主题 token | `lib/editor-theme` | 定义色彩、Chrome、空间、圆角、描边、图标、排版和动效；编译为 CSS 变量及画布 token |
| 基础原语 | `src/components/ui` | Button、Input、Textarea、Select、Popover、Dialog、DropdownMenu、Tabs、Switch、Collapsible、Badge、Tooltip、ScrollArea |
| 编辑器语义组件 | `components/editor-ui` | 把基础原语组合成编辑器通用的按钮、工具栏、面板、弹窗、字段、列表、菜单和反馈 |
| 功能界面 | `components` | 只组合语义组件并保留业务行为；避免再次定义通用外观 |
| 画布交互控件 | `konva-canvas`、`canvas-document-editor` | 复用工具栏、按钮、菜单、提示和弹窗；坐标、命中区和编辑框几何仍属于画布实现 |

## UI 分类与落点

| 分类 | 主要界面 | 通用组件 | 当前落点 |
| --- | --- | --- | --- |
| 应用框架 | 浮动入口、窗口控制、工作区 Chrome | `EditorIconButton`、`FloatingPanel` | `floating-chrome`、`workspace-view-controls`、`workspace-panel-controls` |
| 工作区面板 | 资源管理器、检查器、源码、终端、主题、Markdown 窗口 | `EditorPanelHeader`、`EditorPanelBody`、`EditorPanelFooter` | 各面板组件；可移动窗口仍由 `FloatingPanel` 负责位置和尺寸 |
| 菜单与浮层 | 文件、更多、过滤、节点和项目文件上下文菜单 | `EditorMenuSurface`、`EditorMenuSection`、`EditorMenuItem`、`EditorMenuToggleItem` | `editor-menus`、`explorer-panel`、`konva-canvas/node-action-ui` |
| 工具栏 | 多选排布、无限画布创建工具 | `EditorToolbar`、`EditorToolbarGroup`、`EditorIconButton` | `selection-arrangement-toolbar`、`canvas-document-toolbar` |
| 表单与设置 | 主题 token、字体、检查器属性、地址栏 | `EditorField`、`EditorSearchField`、`EditorNumberField` 及基础 Input/Select | `theme-settings-*`、`inspector-panel`、`browser-tool-window` |
| 弹窗 | 节点链接、Markdown 文档、图片 URL、未保存确认 | `EditorDialog` | 对应四个业务组件；焦点圈定、Escape、外部点击和层级由 Radix 处理 |
| 列表与导航 | 主题分类、主题库、Markdown 文件、项目资源树 | `EditorList`、`EditorListRow`、`EditorTree`、`EditorTreeGroup`、`EditorTreeRow` | 主题面板、文档弹窗、资源管理器；项目资源树在通用树语义上扩展文件拖动和上下文菜单 |
| 状态反馈 | 错误横幅、诊断、空状态、状态消息、拖放徽标 | `EditorNotice`、`EditorEmptyState`、`EditorStatusBadge` | `file-workflow-feedback`、`diagnostic-panel`、`editor-overlays` |
| 内容宿主 | Mermaid 预览、Markdown、源码、终端、WebView | 只统一外壳 | 内容渲染、编辑器和第三方运行时内部样式保持独立 |
| 画布交互 | 多选工具、节点操作提示、上下文菜单、内联编辑 | DOM 部分复用语义层；几何部分使用画布 token | Konva/Pixi 组件目录 |

## 语义组件 API

- `EditorIconButton`：唯一的图标按钮入口，按 `floating`、`panel`、`toolbar`、`inline` 上下文选择尺寸；支持按下、危险、未保存和数量徽标。
- `EditorToolbar` / `EditorToolbarGroup`：统一工具条表面、间距和分组；按钮必须有可访问名称。
- `EditorPanelHeader` / `Body` / `Footer`：统一面板分隔、内边距和拖动排除区域。
- `EditorDialog`：统一标题、说明、关闭按钮、正文滚动和底部操作；支持不可关闭确认态及受容器约束的模式。
- `EditorField` / `Error` / `SearchField` / `NumberField`：统一标签、帮助文本、错误和输入控件。
- `EditorList` / `EditorListRow`：统一列表选择态与主副文本。
- `EditorTree` / `EditorTreeGroup` / `EditorTreeRow`：统一树语义、层级缩进、选择态与键盘焦点。
- `EditorMenuSurface` / `Section` / `Item` / `ToggleItem`：统一命令、分组、说明、尾部信息与开关态。
- `EditorNotice` / `EmptyState` / `StatusBadge`：统一中性、强调和危险反馈。

## 主题约束

Chrome token 版本为 v7，新增 `chrome` 组：`borderWidth`、`dividerWidth`、`focusRingWidth`、`surfaceOpacity`、`backdropBlur`、`shadowOpacity`。它们与既有 `space`、`radius`、`icon`、`typography`、`motion` 共同编译为 `--ui-*` CSS 变量。

功能组件不得判断“理性极简”主题 ID。该主题把圆角、模糊和阴影设为零，并使用更细的边线，因此同一组件结构会自然呈现直角、扁平、克制的界面。其他主题可以保留各自的圆角、层次和色彩。

## 实现规则

1. 新的命令按钮优先使用 `EditorIconButton` 或 `EditorMenuItem`，不要复制 Tooltip、图标尺寸和焦点样式。
2. 新的模态交互必须使用 `EditorDialog`；不要在功能组件里重新实现遮罩、焦点管理、Escape 或任意 z-index。
3. 浮层层级只来自 `lib/overlay-layers.ts`。自定义坐标菜单需要同时注册全局 overlay activity。
4. 通用表面使用 `editor-ui-surface`、`editor-ui-popover`、`editor-ui-panel`、`editor-ui-dialog`；固定圆角和阴影只允许出现在内容语义或画布几何中。
5. 节点、卡片、连线、内联编辑框等画布语义对象可以保留专用结构，但可见几何必须读取主题 token。
6. 组件目录和本文档共同承担组件目录职责，不引入 Storybook。

## 明确保留的例外

- Mermaid SVG/Konva/Pixi 节点、分组、连线及卡片内容是文档语义，不强制套用 DOM 面板组件。
- xterm、Milkdown、WebView2 的内部 DOM/CSS 由各自适配层管理，仅统一宿主外壳。
- 画布内联输入框的宽高、坐标和命中范围由几何模型决定；它们仍复用主题字体、边线、圆角和焦点 token。
- 项目树文件行包含指针捕获和拖入画布行为，可保留专用实现，但尺寸和状态类必须来自共用 Chrome token。
