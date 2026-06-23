# Mermaid 画布编辑器

这是一个本地项目文档编辑器，把 Mermaid 源码编辑、官方渲染预览、可编辑无限画布和 Markdown 阅读/编辑放在同一个工作区里。项目使用 Vite、React、TypeScript、Tailwind CSS、shadcn 风格 UI 原语、Mermaid、Milkdown、React Konva 和 Tauri 构建。

## 核心能力

- 在无限画布上编辑 Mermaid flowchart。
- 在 Mermaid 源码、内部图模型和 `%% canvas-layout:` 布局注释之间保持同步。
- 对非 flowchart 的 Mermaid 图提供只渲染模式。
- 使用 Milkdown/Crepe 阅读和编辑 Markdown 文件。
- 在 `canvas-layout` 注释里保存节点位置、节点颜色、连线路由、视口和文件级主题。
- 支持打开、保存、另存为、下载兜底、撤销、重做、复制、粘贴、节点编辑、连线编辑、创建连接和端点重连。
- 桌面端支持项目文件夹浏览，递归展示 `.mmd` / `.mermaid` / `.md` / `.markdown` 文件，并可在多个项目文档之间切换。
- Mermaid 支持无限画布、渲染视图和源码视图；Markdown 支持 Markdown 视图和源码视图。
- 应用主题会同时作用于 CSS 变量、Konva 画布 token 和 Mermaid `themeVariables`。

## 快速开始

安装依赖：

```bash
npm install
```

使用主准备命令启动：

```bash
npm run ready
```

`npm run ready` 会依次运行测试、类型检查、生产构建，然后保持前端开发服务运行：

```text
http://127.0.0.1:5173
```

如果 5173 端口已有本项目开发服务，脚本会先临时停止它，完成验收后再重新启动。它不会停止非本项目进程。

开发网页版时，在普通本地 shell 里运行 `npm run ready` 并保持该命令运行。调试桌面壳时使用 `npm run desktop:dev`。

## 桌面端与智能体桥接

浏览器构建是静态 Vite 应用，负责人工编辑、查看、导入和导出 Mermaid/Markdown 项目文档。桌面端在此基础上增加真实文件读写、项目文件夹扫描、图片资源导入和实时智能体桥接。

桌面端相关命令：

```bash
npm run desktop:dev
npm run desktop:build
npm run desktop:ship
npm run windows:run
```

本机桌面完整验收使用：

```bash
npm run desktop:ship
```

它会运行测试和类型检查，构建 Tauri 安装包，安装当前平台产物并启动应用。只想快速打包、安装、启动时可设置 `MMM_SHIP_SKIP_CHECKS=1`；只想生成安装包时可设置 `MMM_SHIP_PACKAGE_ONLY=1`。

Tauri 会为执行命令的操作系统构建产物。从 WSL 运行会得到 Linux 产物；需要 Windows 安装包时，应从 Windows PowerShell/CMD 执行同样命令。

从 WSL 做 Windows 端验收时使用：

```bash
npm run windows:run
```

该脚本会把当前工作区同步到 Windows 临时目录，执行 Windows 侧 `npm install`，构建 Windows Tauri 包，安装并启动桌面应用。默认跳过重复的 Windows 侧测试和类型检查，因为常规检查应先在 WSL 仓库完成。设置 `MMM_WINDOWS_RUN_FULL_CHECKS=1` 可包含这些检查；设置 `MMM_WINDOWS_RUN_LAUNCH_ONLY=1` 可只启动已安装应用。

桌面应用启动后，会在随机 `127.0.0.1` 端口开启带 token 的本地桥接服务，并把发现信息写入：

```text
~/.mermaid-canvas-editor/bridge.json
```

`mmm` CLI 默认读取该文件，用于 `mmm ping`、`mmm context` 和 `mmm apply` 等实时命令。静态 Web 构建不暴露实时智能体上下文。

## 界面结构

主工作区采用浮动控件，而不是固定顶栏：

- 所有标准图标按钮使用圆形点击目标。
- 控件按网格定位，临近操作组成小型浮动组。
- 浮动组基于鼠标位置、键盘焦点和菜单展开状态渐进披露；离开后延迟隐藏。
- 左上角是文件入口，左侧中部是项目文件浏览器入口。
- 右上角是窗口控制、筛选和三视图切换。
- 右侧中部是属性、主题和诊断面板入口。
- 左下角是设置和辅助操作入口。
- 右下角是选择/连接模式切换。

左侧面板是项目文件浏览器。桌面端会围绕当前文件或用户选择的文件夹递归扫描 Mermaid 和 Markdown 项目文档；面板本身保持简洁，不放筛选输入框。右侧面板承载 Mermaid 属性、主题和诊断。两个侧栏都以覆盖层形式浮在工作区上，不改变画布坐标系。

三视图切换规则：

- flowchart 文件可在无限画布、渲染视图和源码视图之间循环。
- 非 flowchart Mermaid 文件跳过无限画布，只在渲染视图和源码视图之间切换。
- Markdown 文件在 Markdown 视图和源码视图之间切换。
- 源码视图是独立工作区视图，不只是侧边栏；Mermaid 源码编辑提交后会刷新图模型、渲染结果和诊断，Markdown 源码编辑直接更新 Markdown 文本。

## 画布导航

- 选择模式下直接拖拽节点。
- 按住 Space 拖拽，或使用鼠标中键/右键拖拽，可临时平移画布。
- MacBook 触控板双指滚动用于平移无限画布和渲染视图。
- Safari 捏合手势或 Cmd/Ctrl + 滚轮会围绕指针缩放。
- 当输入设备没有横向滚动量时，Shift + 滚轮转为水平平移。

## 质量检查

重要改动前后默认使用：

```bash
npm run ready
```

局部调试命令仍然可用：

```bash
npm run lint
npm test
npm run typecheck
npm run build
npm run dev
```

浏览器验收优先使用 `npm run ready`。Tauri 验收使用 `npm run desktop:dev` 或 `npm run desktop:ship`。Windows 端从 WSL 验收使用 `npm run windows:run`。

## 持续集成与发布

推送到 `main` 或向 `main` 发起 pull request 时，GitHub Actions 会运行：

```bash
npm run lint
npm test
npm run typecheck
npm run build
```

发布桌面安装包时推送版本标签：

```bash
git tag v0.1.0
git push origin v0.1.0
```

发布工作流会构建并上传 macOS、Windows 和 Linux 安装包到对应 GitHub Release。当前首次公开版本为 `v0.1.0`。

## Mermaid 支持边界

flowchart 可在无限画布上编辑。内部模型使用 `node`、`edge` 等图结构术语；Mermaid 源码层保持 `id`、`label`、`shape` 等 Mermaid 术语。

以下 Mermaid 类型按只渲染处理：

- Sequence
- Class
- State
- ER
- Gantt
- Pie
- Mindmap
- Timeline
- Architecture
- 未识别的 Mermaid 输入

flowchart 解析器是项目内轻量解析器，不是完整 Mermaid AST 实现。它覆盖测试里的语法，并尽量保留暂不支持的源码语句。

## 项目结构

```text
src/main.tsx, src/App.tsx, src/styles/
  Vite React 应用入口和全局样式。

src-tauri/
  Tauri 桌面壳、原生文件命令和本地智能体桥接。

src/components/ui/
  共享 UI 原语。

src/features/mermaid-editor/components/
  React UI、源码视图、渲染视图、属性面板、浮动控件和 Konva 画布桥接。

src/features/mermaid-editor/lib/
  纯编辑器逻辑：解析、序列化、布局、交互状态、命中目标、
  视觉状态、几何、路由、诊断、历史记录和测试。

docs/
  后续变更需要遵守的架构、交互、主题和性能文档。
```

## 架构文档

除 `README.md` 这个平台约定入口外，`docs/` 下文档文件名使用中文。正文使用中文；命令、文件路径、代码标识符和 Mermaid 语法关键字按原文保留。

使用 [docs/系统总览.mmd](docs/系统总览.mmd) 作为紧凑系统总览。它把共享文档模型放在中心，并连接用户工作表面、React 编辑器运行层、平台能力边界、智能体/CLI 桥接和质量护栏。

专题图按问题拆分实现细节：

- [docs/文档模型.mmd](docs/文档模型.mmd)：Mermaid 源码、`canvas-layout`、图状态、只渲染兜底和源码同步。
- [docs/运行时文件与资源.mmd](docs/运行时文件与资源.mmd)：浏览器/桌面运行时适配、文件流程、项目文件夹扫描、草稿、图片资源和显示 URL。
- [docs/交互管线.mmd](docs/交互管线.mmd)：输入标准化、意图解析、命令、事务、浮动控件和视觉反馈。
- [docs/智能体桥接.mmd](docs/智能体桥接.mmd)：离线 CLI 命令和桌面实时桥接命令。
- [docs/主题系统.mmd](docs/主题系统.mmd)：主题来源优先级、编译产物和 CSS/Konva/Mermaid 适配。
- [docs/性能路径.mmd](docs/性能路径.mmd)：热路径、提交路径、重任务路径和性能观测。
- [docs/演示图谱.mmd](docs/演示图谱.mmd)：用于展示节点形状、连线语义、子图、自动布局和编辑闭环的示例图。

约束文档：

- [docs/交互设计约束.md](docs/交互设计约束.md)：画布交互状态、命中目标、命令执行、几何层、视觉反馈和连线路由。
- [docs/技术约束.md](docs/技术约束.md)：运行时边界、Mermaid 术语边界、文档命名和主题边界。
- [docs/技术选型与库使用.md](docs/技术选型与库使用.md)：技术栈、关键库用途、使用边界、脚本和新增依赖原则。
- [docs/性能设计.md](docs/性能设计.md)：输入延迟、渲染吞吐、大图验收和性能禁止项。
- [docs/主题令牌清单.md](docs/主题令牌清单.md)：主题 token、颜色、字体、尺寸、圆角、描边、控件、画布交互和 Mermaid 映射。

## 开发约束

关键边界：

- `canvas-interaction.ts` 负责画布交互状态机。
- `canvas-hit-target.ts` 负责把 Konva 图形命中转换为业务命中目标。
- `canvas-visual-state.ts` 负责节点、连线、锚点、草稿、辅助线和选择态的视觉决策。
- `node-geometry.ts` 负责节点 frame、文本、锚点、路由、对齐和命中测试几何。
- `edge-geometry.ts` 负责完成连线和草稿连线路由。
- Konva 组件只翻译事件、渲染图形、执行返回命令；不要在组件里分散业务规则。
- 浏览器和桌面平台行为必须经过 `editor-runtime.ts`；编辑器组件不要直接调用 Tauri API、浏览器文件选择 API 或智能体桥接 endpoint。
- 新节点 ID 默认使用 `N1`、`N2`、`N3` 序列，除非保留用户已有 ID。
- 新增图标按钮必须沿用圆形 `size="icon"` 规则。

## 常用文件

- `src/features/mermaid-editor/components/mermaid-editor.tsx`：顶层编辑器状态、命令、浮动控件和工作区视图。
- `src/features/mermaid-editor/components/konva-canvas.tsx`：Konva 渲染和事件桥接。
- `src/features/mermaid-editor/lib/editor-runtime.ts`：Web/desktop 文件、草稿和智能体桥接运行时适配。
- `src/features/mermaid-editor/lib/mermaid-graph.ts`：Mermaid flowchart 解析与序列化。
- `src/features/mermaid-editor/lib/mermaid-document.ts`：文档加载、构建和 `canvas-layout` 处理。
- `src/features/mermaid-editor/lib/editor-types.ts`：共享编辑器数据模型。
- `src/features/mermaid-editor/lib/floating-chrome.ts`：浮动控件渐进披露规则。
- `src/features/mermaid-editor/lib/workspace-view.ts`：三视图切换规则。
