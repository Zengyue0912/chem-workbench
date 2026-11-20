# 高中化学 3D 考点工作台（商业化重构版 v2.2.0）

面向高中生的化学备考工具：3D 化学实验工作室、考点导航、元素周期表、分子与晶体 3D 演示、
高考真题、SOP 解题法、错题本与 AI 化学助教。本版本由原静态站重构为商业化水准产品：
营销落地页 + 定价订阅 + 本地账号 + PWA + SEO，可直接部署到 Netlify。

v2.1.0（2026-11-20）专注工作台本身：按真实浏览器审计逐项修复 7 类体验问题
（3D 预览误导、下沿截断、对比度、测验页、导航、搜索重复、移动端），并融入
AI 教育标杆做法（分步动画、闪卡 FSRS、苏格拉底助教、游戏化、概念图谱）。
商业化外壳（落地页、定价、账号、付费墙）本轮未动。

v2.2.0（2026-11-20）重做 AI 解题板块为“引擎算得准 + AI 讲得清”的解题工作台：
确定性化学计算引擎（配平、pH、物质的量、守恒，有理数精确运算，57 项单元测试）
先算出正确答案与推导步骤，再由分步交互流程讲解；另有错因诊断、变式训练、
修复后的拍照 OCR（Tesseract.js 走 jsdelivr CDN，图片本地处理不上传）与方程式
渲染器。商业化外壳本轮未动；原有核心 JS 零改动，全部为新增 `workbench-solve-*`
模块 + `app.html` 引入 + `sw.js` 预缓存同步。

> 原站：https://playful-salamander-f0038b.netlify.app
> 本仓库为重构后的完整可部署站点（`optimized/`）。原始站点的只读副本不在此目录内。

## 快速部署（Netlify，零构建）

本站是纯静态文件 + 1 个 Netlify Function，**无需构建命令**，`netlify.toml` 已配好
（`publish = "."`）。

**方式一：拖放部署（最快）**

1. 把本目录整个拖到 [Netlify Drop](https://app.netlify.com/drop)；
2. 等部署完成，得到 `https://xxx.netlify.app` 域名；
3. 在 Netlify 后台 **Site settings → Functions** 确认 `chat` 函数已识别
   （未配置大模型 Key 时函数返回 501，前端自动降级为演示模式，不影响使用）。

**方式二：Git 持续部署**

1. 把本目录推到 GitHub/GitLab 仓库；
2. Netlify → Add new site → Import an existing project，选该仓库；
3. Build command 留空，Publish directory 填 `.`（`netlify.toml` 已声明，留空也可）；
4. Deploy。以后每次 push 自动重新部署。

**方式三：Netlify CLI**

```bash
npm i -g netlify-cli
netlify deploy --dir=. --prod
```

本地预览：`python3 -m http.server 8933`，打开 http://localhost:8933
（本地无 `/api/chat`，AI 助手会 404 并自动降级为演示模式，属预期行为）。

## 目录结构

```
├── index.html            营销落地页（默认首页：Hero / 卖点 / 功能 / 评价 / 定价 / FAQ / 反馈）
├── app.html              工作台（原 index.html 重构后改名）
├── about.html / privacy.html / terms.html   关于 / 隐私政策 / 用户协议
├── offline.html          PWA 离线兜底页
├── manifest.json / sw.js  PWA 清单与 Service Worker（根目录）
├── sitemap.xml / robots.txt
├── netlify.toml / _headers    部署配置（缓存、安全头、CSP、Functions、重定向）
├── netlify/functions/chat.js  AI 问答函数占位（Key 放环境变量，未配返回 501）
├── css/                  12 组样式（源码 + .min）：W1 首屏 2 组 + 懒加载 3 组
│                         + commerce（商业化外壳）+ landing（落地页）
│                         + enhance（视觉 token）+ mobile（移动端）
│                         + workbench-*（W4 工作台改版 5 组：layout / quiz /
│                           controls / learn / fx）
├── js/                   59 组脚本（源码 + .min）：工作台核心 + 懒加载 bundle
│                         + loader.js（懒加载器）+ plan/auth/ai-config/onboarding
│                         + analytics/mobile/a11y/share/pwa
│                         + workbench-*（W4 工作台改版 9 组：nav / quiz / search /
│                           3d-preview / vibe / flashcards / socratic /
│                           gamify / conceptmap）
├── assets/               jxnu-emblem.jpg（校徽）+ PWA 图标（192/512/maskable/180）
├── PERF_NOTES.md         工作流 1：性能数据、文件映射、懒加载策略（内部文档）
├── COMMERCE_NOTES.md     工作流 2：商业化外壳完整说明（内部文档）
├── INTEGRATION.md        工作流 3：集成说明与插入点记录（内部文档）
├── README.md / CHANGELOG.md
└── 教案SOP技术路线与子流程.md   原站自带文档（原样保留）
```

> `PERF_NOTES.md` / `COMMERCE_NOTES.md` / `INTEGRATION.md` 是内部工作文档，
> 部署后可公开访问；如不希望公开，上线前删除这三个文件即可（不影响站点运行）。

## 本次重构改了什么

### 工作流 1：性能与工程重构
- 718KB / 6546 行单体 `index.html` 拆分：内联 CSS/JS 全部抽到 `css/` / `js/`，
  入口页瘦身至 6.8KB（-99.1%）。
- 24 个同步脚本改为 `defer` + 按依赖排序；SOP 数据、真题、3D 空间等改为
  `js/loader.js` 按需懒加载（6 个 bundle，串行加载保证依赖顺序，Promise 缓存）。
- CSS/JS 全部提供 `.min` 压缩版（页面引用 .min，可读源码保留）。
- `netlify.toml`：静态资源 `immutable` 长缓存（1 年）+ HTML 不缓存；安全头
  （CSP / X-Frame-Options / nosniff 等，Bilibili iframe 已放行 `frame-src`）。
- 首屏 Loading 骨架屏，不再白屏等待脚本。

### 工作流 2：商业化产品外壳
- 营销落地页 `index.html`（新默认首页）+ 工作台移至 `app.html`。
- 定价三档：免费版 ¥0 / Pro ¥19/月（或 ¥149/年）/ 学校版联系洽谈；
  `js/plan.js` 权限模块真实门控（真题解析免费 3 次/天、AI 5 次/天、错题导出与
  3D 解析卡为 Pro 专属），未开通弹出演示级付费墙（不真扣费，留有支付接入 TODO）。
- `js/auth.js` 本地账号（注册/登录/退出，SHA-256 加盐哈希存 localStorage，
  界面与注释均标注“演示级”）；登录后学习进度、收藏、错题按账号命名空间隔离；
  预留 `AuthProvider` 抽象层，可替换为 Supabase / 自有 API。
- 首次进入工作台的 3 步新手引导（`js/onboarding.js`）。
- AI 助手降级：`/api/chat` 不可用时自动进入演示模式（内置 20 条考点知识库 +
  明确提示）；`js/ai-config.js` 设置面板支持自定义 OpenAI 兼容接口
  （Key 只存 localStorage，绝不进代码）；`netlify/functions/chat.js` 服务端占位函数。
- 意见反馈入口（mailto + 表单占位）、关于页、隐私政策与用户协议页（简版）。

### 工作流 3：体验、移动端与增长
- 移动端适配：`css/mobile.css`（768px / 1024px 断点，侧边栏抽屉、单列布局、
  ≥44px 触控尺寸）+ `js/mobile.js`（抽屉手势、双击复位；旋转/缩放复用原有实现）。
- PWA：`manifest.json` + `sw.js`（版本化缓存、导航网络优先、离线页兜底）+
  `js/pwa.js`（安装横幅）；图标由校徽真实派生（192/512/maskable/180）。
- SEO：每页 title / description / OG / Twitter 卡片、JSON-LD
  （EducationalApplication / WebPage）、`sitemap.xml`、`robots.txt`。
- 无障碍：`js/a11y.js`（跳过链接、aria-label 补全、焦点陷阱、Esc 关闭）+ 焦点样式。
- 视觉升级：`css/enhance.css` 设计 token（浅/深两套），统一圆角/阴影/状态样式。
- 增长：`js/analytics.js` 事件上报抽象（默认仅 console，零真实追踪 ID，预留
  Plausible/GA 适配器）+ `js/share.js`（一键复制链接、Canvas 学习打卡卡片下载）。

### 协调员集成
- 按 `INTEGRATION.md` 落位 10 个插入点（已做去重：落地页与信息页沿用工作流 2 的
  title/description 定稿，不重复写 meta）。
- `sw.js` 预缓存清单同步到最终结构（新增 W2 首屏文件、落地页资源、三个信息页），
  缓存版本升级到 `w3-2`。
- `netlify.toml` / `_headers` 增加 `/sw.js` 与 `/manifest.json` 不缓存规则
  （保证 SW 与清单更新及时生效）。
- 埋点接线：落地页“开通 Pro”、付费墙 CTA、登录/注册提交按钮均已加
  `data-analytics` 属性（`auth.js` / `plan.js` 因此改动，版本串升为 `?v=w2-2`）。

### 工作流 4：工作台改版（v2.1.0，本轮重点；商业化外壳未动）
按真实浏览器审计（13 张截图）逐项修复，全部实现为覆盖层/包装模块，
**零改动原有核心 JS**（只改了 `css/mobile.css` + 新增 `workbench-*` 文件 +
`app.html` 引入 + `sw.js` 预缓存同步）：

- **3D 预览误导（最严重）**：核对发现预览图全是静态 `<img>`，且 `assets/spatial/`
  目录根本不存在、所有预览图 404。修复为真正可拖拽旋转的小画布
  （`js/workbench-3d-preview.js`，复用 E3 引擎：惯性、自动慢转、悬停暂停、
  视口内懒触发、同时最多 1 个自动转）；SIM 驱动的 7 项实验用引导占位层 + 拖拽
  toast 兜底。
- **下沿截断**：滚动区加渐变遮罩 +“向下滚动”提示；弹窗自适应高度（左栏恢复
  内部滚动）；周期表限高收紧（整表约 490px，768px 视口可同屏）；另根治了审计
  之外的导航 `.subnav` 900px 上限截断（改 grid 0fr→1fr 动画）。
- **字号与对比度**：元素格字号上调；原子轨道线加粗提亮（实例级 canvas 拦截）；
  浅色次要文字 3.78:1 → 5.52:1、深色 5.98:1 → 7.89:1（WCAG AA），选项边框
  3.95:1 / 3.48:1（达非文本 3:1）。注：审计称“深色对比下降”不准确，实测深色
  原本已达 AA，真正不达标的是浅色。
- **测验页重做**：弹窗 720px → 860px 两栏（题干 + sticky 答题卡侧栏）、吸顶
  进度条 +“第 x/N 题”+ 已答/答对数、上一题/下一题（+ 方向键）、可开关计时、
  答题卡点击跳转、单题/列表双模式；真题空间单题页一并增强。注：“60 题”不
  存在（全库 11 个实验共 48 题），实现为通用第 x/N 题。
- **导航**：默认只展开当前分册、选中项自动滚动定位、副标题两行显示、
  收起/展开全部控制条；考点掌握状态（已掌握/学习中/薄弱，仅 11 个有 quiz
  的实验考点显示，无测验考点不编造标记，含同名 id 防误标）。
- **搜索与按钮**：两搜索框语料不同（顶栏搜物品、首页搜考点），改为双向联动
  不删除；按钮统一 hover/active（下压 1px）/focus-visible 三态。
- **移动端**：修复 721–768px 断点空隙（导航变抽屉但汉堡按钮不显示）；
  3D 工具条单行横向滚动；周期表冻结首列 + ≤480px 紧凑模式；375px 顶栏溢出修复。
  **移动端需真机复核**（本机无 headless chrome，未截图验证）。
- **视觉动效系统**：`css/workbench-fx.css` 设计系统覆盖层（字阶/动效 token、
  卡片 hover 浮起、视图切换淡入、导航选中态左侧色条、搜索框聚焦展开、
  3D 画布加载骨架）；深色模式与 `prefers-reduced-motion` 全程可用。
- **Vibe 知识分步动画**：3 个精品动画（VSEPR 排斥 94s、滴定曲线绘制 88s、
  电子云形成 84s），各 5 步、可播放/拖进度/键盘操作；首页“3 分钟讲透一个
  考点”卡片区，移动端 ≤760px 为竖屏 scroll-snap 卡片流；SOP 步骤逐步高亮
  呈现。文案全部取自现有数据，来源逐条标注在代码注释中。
- **学习科学新模块**（D 组，全部纯前端，演示功能界面明确标注“演示”）：
  闪卡复习 + FSRS 间隔重复（122 张卡由真实考点数据派生）；助教苏格拉底式
  回答结构（引导提问 + 分步提示 + 答案）+ 模式切换（问答/解题/测验/可视化）
  +“讲给 AI 听”费曼入口（关键词要点反馈，非真实 AI 判断）；游戏化（连胜/
  今日目标进度环/XP 等级，与现有进度系统打通）；概念图谱迷你导航（前置/
  关联考点，同章节 + 同标签推断，界面已标注非教材指定顺序）。
- **自适应测验推荐**：提交/答错后按薄弱点推荐下一题（同场错题优先 → 同章节
  未掌握测验），可跨实验跳转；题目无考点标签，以实验为考点单位。

### 协调员集成（v2.1.0）
- `app.html` 统一接入 5 组新 CSS + 9 组新 JS（`?v=w4-1`），按各组依赖顺序排布：
  layout 在 inline-head 之后；quiz/controls/learn/fx 在 mobile 之后；
  nav 在 student-study-stub 之后；socratic 在 ai-config 之后（包装顺序有依赖）；
  quiz/search/3d-preview/vibe 在 body 末尾。
- `sw.js` 预缓存同步新增 14 个资源，缓存版本升至 `w4-1`（`sw.min.js` 同步重生成）。
- 冲突核查：B 组 token 用 `body` 选择器（与 inline-head 同优先级、后加载胜出，
  enhance/mobile/commerce 未重定义这些 token）；C 组与 A 组动效作用于不同属性；
  新 localStorage 键（`chem3d_v2_flash_v1` / `chem3d_v2_gamify_v1` /
  `chem3d_v2_socratic_mode` / `chem_wb4_*`）与旧键零冲突。

### v2.2.0 AI 解题升级（本轮重点；商业化外壳未动）
- **架构：引擎优先、AI 讲解第二**。能确定性算对的题先由本地引擎算出答案与
  推导步骤，再由讲解层生成讲解；大模型只负责讲明白，不负责算答案。引擎算不
  出的题走原有 SOP/助教链路，并明确标注置信度三档（引擎精确计算 / 规则模板
  解析 / 资料检索参考）。
- **A 组：确定性化学计算引擎**（`js/workbench-solve-engine.js`，+ `.min`）。
  化学式解析器（括号/电荷/结晶水/状态符号）；方程式配平（线性代数法，自研
  分数类有理数精确运算，配不平明确报错，最后一步必为原子守恒检验）；pH 计算
  （强酸强碱/稀释/混合/一元弱酸碱）；物质的量与化学计量（互换/浓度/按量计算/
  过量判断/产率）；守恒列式辅助。测试集 `tests/solve-engine.test.js`
  （`node tests/solve-engine.test.js`，不进首屏与预缓存）：**57/57 通过**。
- **B 组：分步交互解题 + 错因诊断 + 变式训练**（`js/workbench-solve-flow.js` +
  `css/workbench-solve.css`，各 + `.min`）。Photomath 式流程：第 0 步只给审题，
  后续步骤逐条展开，每步可点“为什么这样算”，“没懂”给更细拆分；错因诊断 6 类
  确定性规则（未配平/离子拆错/单位/有效数字/漏条件/守恒），定位到行；变式题
  4 类 × 3 模板，答案全部由引擎算出；做对变式更新掌握状态（复用 v2.1 的
  `chem3d_quiz_<id>` 键，未新增键）。
- **C 组：拍照 OCR 修复 + 方程式渲染 + 联动**（`js/workbench-solve-ocr.js` +
  `js/workbench-chem-render.js`，各 + `.min`）。原 OCR 本地资源缺失，改用访问器
  覆盖 `window.ChemQuestionOCR`，Tesseract.js@5.1.1 走 jsdelivr CDN 按需懒加载
  （`chi_sim + eng`，语言包走库内建 jsdelivr 默认）；识别结果须编辑确认后才解题；
  CDN 失败时中文提示 + 手动输入兜底；图片只本地处理。渲染器零依赖（上下标/
  电荷/箭头条件/↓↑），自动监听助教消息、测验解析与闪卡卡面。解题历史新键
  `chem3d_v2_solve_history_v1`（上限 100 条）；错题复用现有 `chem_mistakes_v1`。
  CSP 两处（`netlify.toml` / `_headers`）同步放行 `https://cdn.jsdelivr.net`
  （script-src / connect-src / worker-src）。
- **协调员集成**：`app.html` 接入 1 组 CSS + 4 组 JS（`?v=w5-1`；engine/render/ocr
  在 nav 之后、flow 在 socratic 之后）；解题面板提问区补“拍照解题”按钮
  （接 `ChemSolveOCR.openPhotoSolve()`，OCR 弹窗 z-index 10000 高于解题面板 300）；
  `sw.js` 预缓存新增 5 个资源，缓存版本升至 `w5-1`（`sw.min.js` 同步重生成）；
  集成时只动了 B 组新文件的两处（按钮 + 分发 case），原有核心 JS 零改动。

## 性能对比

| 指标 | 原站 | 重构后（W1） | 最终集成（W1+W2+W3） | v2.1.0（+W4 工作台改版） |
|---|---|---|---|---|
| 默认首页首屏 | index.html 718KB 单体 | 6.8KB | **落地页 26.1KB**（CSS 13.6 + JS 12.5） | 落地页 26.1KB（未动） |
| 工作台首屏 JS | 1,101 KB（24 外部 + 13 内联） | 418.8 KB（**-62.0%**） | 475.5 KB（**-56.8%** vs 原站） | 574.5 KB（**-47.8%** vs 原站） |
| 工作台首屏 CSS | 119.3 KB | 104.2 KB | 116.8 KB | 149.2 KB |
| 工作台首屏合计 | ~1,220 KB | ~523 KB | 592.3 KB | ~724 KB |
| 懒加载（按需） | — | 545 KB | 约 530 KB JS（30 文件） | 约 530 KB + viewer3d 约 74KB（首次预览进视口时加载） |
| 同步阻塞脚本 | 24 个 | 0 个（全部 defer） | 0 个 | 0 个（W4 新增 9 组全部 defer） |

> 说明：W1 单独达成首屏 JS -62.0%；W2 商业化外壳与 W3 的 PWA/增长模块新增约
> 70KB 首屏代码（账号、付费墙、AI 配置、引导、埋点、分享、PWA），最终净减少
> 56.8%。用户最先打开的落地页首屏仅 26.1KB。详见 `PERF_NOTES.md`。
> v2.1.0 的 W4 新增约 134.5KB 首屏下载（JS 99.0KB + CSS 32.4KB，.min 实测），
> 全部为 defer 非阻塞脚本/覆盖层样式，换取 3D 预览、动画、闪卡、测验重做等
> 功能；首屏 JS 仍比原站少 47.8%。
> v2.2.0 的 AI 解题新增约 117.5KB 首屏下载（JS 111.9KB + CSS 5.7KB，.min 实测：
> 引擎 38.2KB、流程 54.5KB、OCR 15.7KB、渲染 6.1KB、样式 5.8KB），全部 defer；
> 工作台首屏 JS 约 686KB，仍比原站少约 37.7%；OCR 的 Tesseract 引擎与语言包
> 只在用户拍照时才从 CDN 加载，不进首屏。

## 功能与配置说明

- **定价/门控**：改价只改 `index.html` 定价区文案与 `js/plan.js` 的 `PLANS`
  定义；门控点见 `plan.js` 的 `GATES` 数组。
- **账号**：演示级本地账号，数据在 `localStorage`（`chem3d_acct_<userId>_v1`
  命名空间）；接后端时实现 `js/auth.js` 中的 `AuthProvider` 接口。
- **AI 助手**：默认演示模式；用户在助教面板 → AI 设置可填自定义接口；
  服务端方式见 `netlify/functions/chat.js`（在 Netlify 后台配大模型 API Key
  到环境变量）。注意 CSP `connect-src 'self'` 会拦截跨域自定义接口，
  推荐走同源 `/api/chat`。
- **埋点**：`js/analytics.js` 默认只 `console` 输出；接入 Plausible/GA 时在页面
  引入官方脚本后调用 `ChemAnalytics.use(...)`，并在 `netlify.toml` 的 CSP 中
  放行对应域名。**不要把追踪 ID 写进 `analytics.js`。**
- **分享卡片**：打卡卡片的二维码区目前是占位框，需上线前在 `js/share.js` 的
  `makeCheckinCard` 中替换为真实二维码绘制（坐标 x=140, y=880, 260×260）。
- **缓存版本规则**：全部 CSS/JS 引用带 `?v=w1-1` / `?v=w2-1` / `?v=w2-2` /
  `?v=w3-1` / `?v=w4-1` 查询串（immutable 长缓存）；**改动任何静态资源后必须升级对应
  版本串**，否则用户会拿到旧文件。改动预缓存清单时同步升级 `sw.js` 的
  `CACHE_VERSION`。
- **W4 新模块**：`workbench-*` 全部是运行时挂载的覆盖层/包装模块，不改原有核心
  JS；新 localStorage 键：`chem3d_v2_flash_v1`（闪卡 FSRS 状态）、
  `chem3d_v2_gamify_v1`（连胜/XP）、`chem3d_v2_socratic_mode`（助教模式）、
  `chem_wb4_quiz_hist` / `chem_wb4_exam_done` / `chem_wb4_quiz_timer` 等
  （测验增强状态）。`chem3d_v2_` 前缀的键自动享受 `auth.js` 的按账号隔离。
- **拍照解题 OCR（v2.2.0，C 组）**：`js/workbench-solve-ocr.js` 用访问器覆盖
  原 `student-question-ocr.js` 的加载逻辑（原文件未改动），Tesseract.js 5.1.1
  与语言包（chi_sim + eng）按需从 jsdelivr CDN 加载，CSP 已同步放行
  `https://cdn.jsdelivr.net`（见 `netlify.toml` / `_headers` 的“v2.2.0 OCR CDN
  放行”注释）。准确率限制：印刷体题目较好；手写体、复杂结构式、有机结构简式
  识别率低，化学式上下标、电荷容易错，识别后须在确认框里核对再解题。图片只
  在本机经 Tesseract.js 本地运算，不上传任何服务器；CDN 不可达时给出中文
  提示并可手动输入题目。解题历史存 `chem3d_v2_solve_history_v1`（上限 100 条）；
  错题复用现有错题本 `chem_mistakes_v1`。方程式渲染见
  `js/workbench-chem-render.js`（`ChemRender.renderFormula` /
  `renderInto`，零依赖）。

## 如何接支付（下一步）

付费墙目前是演示级（`js/plan.js` 的 `demoActivate` 仅本地切换状态）。
正式接支付的推荐路径（已在 `plan.js` 文件头留 TODO）：

1. 后端（或 Netlify Function）创建订单：调用微信支付 / 支付宝统一下单 API，
   返回支付参数；
2. 前端拉起收银台（JSAPI / H5 支付 / 扫码）；
3. 支付平台异步通知到后端回调接口，后端校验签名后把订单置为已支付；
4. 前端轮询订单状态，支付成功后调用后端接口把账号 plan 置为 Pro。
5. **门控必须以后端校验为准**：当前端门控仅为体验层，正式版需在服务端
   校验会员状态后再返回 Pro 内容（如完整解析、AI 无限次）。

> 注意：微信支付 / 支付宝商户号需要营业执照或个体工商户资质；
> 个人开发者可先用“赞赏码 + 人工开通”过渡（用户付款后凭截图联系站长手动开通）。

## 如何接后端（账号云端同步）

1. `js/auth.js` 已预留 `AuthProvider` 抽象层：实现 `register/login/logout/
   getSession` 后替换本地实现即可（注释中有 Supabase / 自有 API 的接法）。
2. 学习数据同步：现有 `js/data-collector.js` 已有 `/api/data/*` 上传队列
   （课堂模式用），可复用其队列机制做通用同步。
3. 部署后端后，把 `netlify.toml` 的 CSP `connect-src` 放行后端域名。

## 上线前检查清单

- [ ] 替换反馈邮箱占位符 `feedback@chem-workbench.example`（5 处：`index.html`×2、
      `about.html`、`privacy.html`、`terms.html`，均有 `TODO` 注释）。
- [ ] 自定义域名上线后，全局替换占位域名 `playful-salamander-f0038b.netlify.app`
     （`sitemap.xml`、`robots.txt`、各页 OG/JSON-LD/canonical）。
- [ ] 在 Netlify 后台配置 AI 函数的环境变量（大模型 API Key），或确认保持演示模式。
- [ ] 打卡卡片二维码替换为真实二维码（`js/share.js`）。
- [ ] 真机验证：移动端抽屉左滑关闭、双击画布复位、PWA 安装横幅、SW 离线打开。
- [ ] 真实浏览器验证：Canvas 渲染、真实 CSP 生效、Netlify Function 与
      `/api/chat` 重写（本地验收用 jsdom，未用真实浏览器全量验证）。
- [ ] 评价区 3 条“示例”评价替换为真实用户反馈（取得授权后）。
- [ ] （如面向国内用户备案）域名 ICP 备案、公安备案号展示；Netlify 海外部署
      不可备案，如需备案请部署到国内云厂商并做相应调整。

## 已知限制

1. 3D 空间空闲加载时，首页会在首屏后约 1 秒刷新一次（W1 懒加载引入的时序变化）。
2. “学习数据”按钮晚约 1 秒出现（data-collector 改为空闲加载所致）。
3. ~~OCR 资源 `assets/question-ocr/` 不在仓库副本中（原站已有问题），OCR 功能
   在原站与本站均不可用；本重构仅修正了路径解析。~~
   **（v2.2.0 已修复）**：拍照 OCR 改走 jsdelivr CDN 的 Tesseract.js@5.1.1
   （按需懒加载，图片本地处理不上传）；首次识别需访问 jsdelivr，国内个别
   网络可能较慢；印刷体识别较好，手写体、复杂结构式、有机结构简式识别率低，
   上下标/电荷易错，识别结果须编辑确认后才解题。
4. 付费墙与账号均为演示级：无真实扣费、无云端同步、无找回密码；门控为前端
   演示级，正式计费须以后端校验为准。
5. 首屏 JS 仍有 475.5KB，主要由 Studio（171KB）与 UI（99KB）构成，未做内部分拆。
6. 512px PWA 图标由 367×367 校徽轻度放大，如需更锐可用高清校徽原图重制。
7. 触摸手势（双击复位、抽屉左滑关闭）仅代码级检查，未真机验证。
8. **（v2.1.0）移动端需真机复核**：721–768px 断点修复、3D 工具条横向滚动、
   周期表冻结首列、竖屏卡片流均未在真实手机上验证；本机无 headless chrome，
   未截图验证。
9. **（v2.1.0）未做真实浏览器端到端验证**：3D 预览拖拽、Vibe 动画播放器、
   闪卡/游戏化/概念图谱注入均只经 jsdom / Node vm 冒烟验证，需部署后在真实
   浏览器里点一遍（首页预览拖拽、考点页动画、助教抽屉模式切换与费曼面板、
   任一考点详情页顶部的概念图谱）。
10. **（v2.1.0）`assets/spatial/` 预览图缺失是原站已有问题**：原站预览图
    全部 404，本轮用可交互小画布替代了静态图引用；如未来补齐 webp 图片，
    需同步检查 `workbench-3d-preview.js` 的替换逻辑。
11. **（v2.1.0）掌握状态覆盖面小**：仅 11 个实验考点有 quiz 数据可显示掌握
    状态；同步练习按 topic 组织，与导航条目 id 无映射，未纳入。
12. **（v2.1.0）演示级功能**：苏格拉底回答重组与费曼评估均为前端演示
    （关键词匹配，不理解语义/同义词/错别字），界面已明确标注；FSRS 为简化
    实现（仅 Again/Good 两档）；概念图谱“前置”按数据顺序推断，非教材指定顺序。
13. **（v2.1.0）通用分隔线边框仍未达 3:1**（1.68:1 / 2.07:1，刻意保持纤细）；
    仅交互控件边框做到 3:1+。轨道线提亮拦截依赖原站 `atomDraw` 的两个精确
    颜色字符串，若后续改动该处颜色值需同步更新 `workbench-nav.js` 的
    `ORBIT_BOOST`。
14. **（v2.2.0）计算引擎不支持的题型**：弱酸/弱碱仅一元，不含缓冲溶液与水解
    平衡；浓度极低（<10⁻⁶ mol/L）时忽略水的电离（步骤中注明为近似）；气体体积
    仅标准状况（22.4 L/mol）；相对原子质量表约 60 种常见元素，稀有元素会明确
    报错；不支持电子 e⁻ 参与的半反应配平；配平零空间维数 > 3（严重欠定）时报错
    请补充条件；无空格单 `+` 离子方程式（如 `Fe2+MnO4-`）有歧义，请用空格或
    `++` 写法。
15. **（v2.2.0）错因诊断覆盖范围**：仅 6 类确定性规则，未覆盖的错误类型无法
    识别，界面已标注“请向老师确认”；“未发现规则可识别的错误”不代表过程完全
    正确。自由文本守恒题目前只解析“溶液电荷守恒”格式；离子方程式不走引擎配平
    校验（由离子/电荷规则覆盖）；弱酸碱未给 Ka/Kb 时仅对醋酸/氨水用教材值。
16. **（v2.2.0）未做真实浏览器端到端验证**：分步解题面板、拍照 OCR 真实识别、
    真机摄像头、CDN 加载均只经 jsdom / Node vm 冒烟验证，需部署后在真实浏览器
    与真机上点一遍（拍一道印刷体题目走完整流程、点“拍照解题”按钮、变式题核对）。

## 验收记录（2026-11-20，协调员终验）

### v2.2.0 AI 解题升级（协调员终验）
- `node --check`：127 个 JS 文件（源码 + .min + sw.js + 函数 + 测试）全部通过。
- 引擎单元测试：`node tests/solve-engine.test.js` **57/57 通过**（退出码 0；
  配平 20、pH 10、计量 8、解析器 11、守恒 6、.min 一致性 2）。
- B 组冒烟：124 项断言 0 失败（jsdom，加载真实 A 组引擎 + 真实 C 组文件，
  含引擎缺失 / C 组缺失的降级场景）。
- C 组冒烟：渲染 19 个样例精确匹配 + XSS + 幂等 + 三处观察者；OCR 访问器
  两种加载顺序、Abort 取消、CDN 失败分支、历史 100 条上限、错题两种写入
  路径——源码版与 `.min` 版全部通过。
- 协调员集成冒烟（`/tmp/w22-smoke/integration.test.js`，jsdom）：**25/25 通过**——
  解题面板“拍照解题”按钮存在且点击调 `ChemSolveOCR.openPhotoSolve()`、
  OCR 缺席时报错不崩溃（源码与 `.min` 各跑一遍）；4 个 v2.2.0 `.min` 模块
  联合加载无报错，各全局挂载齐全，引擎配平与渲染器联动正常。
- curl：app.html 及 5 个新增 `.min` 资源 + sw.js/sw.min.js 全部 200；
  CSP 两处字符串经脚本校验完全一致，jsdelivr 在 script/connect/worker-src
  各出现一次。
- `original/` 未改动（v2.2.0 开始后零写入）；原有核心 JS 零改动（集成只动了
  B 组新文件的按钮 + 分发 case 两处，`.min` 已用 terser 同步重生成并校验）。

### v2.1.0 工作台改版（工作流 4，协调员终验）
- `node --check`：116 个 JS 文件（源码 + .min + sw.js + 函数）全部通过。
- jsdom 集成冒烟（`smoke-app.mjs`，原站与优化站同一套交互流程对比）：
  优化站 **30/30 通过，0 错误**（原站 21/21）。注：首屏等待需放宽到 4.5s
  （原 2.5s）：jsdom 逐个拉取新增的 9 个 defer 脚本，骨架屏撤掉时机晚于
  2.5s 检查点；A/B 对照证实无 W4 时 2.5s 即撤掉、有 W4 时 4s 内撤掉，
  机制本身正常。真实浏览器中骨架屏由 stub 的 `markReady()` 触发撤掉，
  W4 脚本排在 stub 之后执行，不影响撤掉时机。
- 各组冒烟：B 组 jsdom 30/30、C 组 jsdom 行为测试 51/51（源码与 .min 各跑
  一遍）、A 组 Node vm 功能冒烟 78/78、D 组沙箱单测 25/25（源码与 .min 各跑
  一遍）+ 真实数据冒烟（122 张卡派生、图谱、费曼要点）。
- curl：app.html 全部 39 个引用 + 11 个关键页面全部 200，零 404；
  SW 预缓存清单 49 个 URL 与页面引用一致。
- 冲突核查：新 CSS 括号平衡（64/125/74/24/95 对）；.min 文件关键标记抽查
  全部存在；新 localStorage 键与旧键零冲突；`original/` 未改动；
  `index.html` 与商业化外壳文件未改动。
- 未用真实浏览器验证（本机无 headless chrome）；移动端需真机复核
  （见“已知限制”第 8、9 条）。

### v2.0.0 商业化重构（协调员终验）

- `node --check`：101 个 JS 文件（源码 + .min + sw.js + 函数）全部通过。
- jsdom 冒烟：W2 套件 58/58 通过（引导、付费墙、门控、AI 降级、账号隔离、
  落地页联动）；协调员集成冒烟 31/31 通过（W3 资源引用、分享按钮、埋点属性、
  各页无错误；首次 2 项失败为测试脚本调用了未导出的 API，修正后 10/10 通过）。
- curl：12 个页面/文件全部 200；34 个页面引用 0 失败；35 个 SW 预缓存 URL 0 失败；
  懒加载 bundle 全部 200；manifest / sitemap 格式合法。
- 合规检查：零可执行内联脚本、零内联事件属性（CSP `script-src 'self'` 合规）；
  无真实 API Key / 密码 / 追踪 ID；评价区均标注“示例”；`original/` 未改动。
- 未用真实浏览器验证（本机无 headless chrome）；Canvas 渲染、真实 CSP、
  Netlify 头部与函数行为需部署后复核。

## 许可证与出处

本站内容仅供高中化学学习参考；图形为教学示意，结构与数值为参考值。
由江西师范大学相关师生团队制作与维护，校徽与出处链接保留于各页页眉/页脚。
站内练习与真题改编题目主要依据公开的高考真题与人教版高中化学教材知识范围编写。
