# 记账本 · Taro + 微信云开发

一个轻量的个人记账小程序：记流水账、按月/年/全部统计、微信静默登录。前端使用 Taro 4 + React + TypeScript，数据与聚合全部跑在微信云开发（云数据库 + 云函数）上。

## 功能

| 模块 | 说明 |
| --- | --- |
| 明细 | 按月查看流水，按天分组，每条显示记账时刻（HH:mm）与备注，顶部展示本月支出/收入/结余/笔数，**左滑单条露出删除按钮，二次确认后删除**。**骨架屏只在冷启动首屏出现一次**，切 tab 返回 / 记账返回 / 切月都是静默刷新（顶部细进度条），不打断已渲染内容 |
| 记一笔 | 支出/收入切换、16 个固定分类、自定义数字键盘、日期 / 时间 / 备注；记账时刻**精确到秒且可手动修改**（三列选择器，页面不实时走秒），保存时写库 |
| 统计 | 本月 / 本年 / 全部三段切换；分类汇总 + 占比进度条；支出趋势柱状图（本月按天、本年按月） |
| 我的 | 自定义无导航栏页面；**渐变只铺顶部**（导航 + 个人信息 + 四列概览），下方回归浅灰底卡片。头像 + 昵称 + 徽章 + 设置入口，四列数字（今日支出 / 本月支出 / 本月收入 / 累计笔数），深色「本月结余」卡，常用服务入口 |
| 登录 | 微信静默登录：云函数 `getWXContext()` 直接取 openid，无弹窗、无授权页 |

金额在数据库中以**分（整数）**存储，展示时格式化，避免浮点误差。
每条账目除 `date`（YYYY-MM-DD）外还存 `time`（HH:mm:ss），列表按 `date desc, time desc` 排序，同一天内即按记账先后排列。

## 目录

```
config/                Taro 构建配置
cloudfunctions/        云函数（需在开发者工具中上传部署）
  login/               静默登录 + users 记录
  stats/               统计聚合（分类汇总 + 趋势分桶）
preview/index.html     纯 HTML 设计预览：明细 / 记一笔 / 统计
preview/profile.html   个人中心设计预览（浏览器直接打开，不参与小程序构建）
scripts/               构建补丁与产物体检（patch-taro-raf / check-dist）
src/
  app.tsx / app.config.ts / app.scss
  config/cloud.ts      云开发环境 ID、集合名、云函数名
  constants/categories.ts  收支分类定义
  services/            cloud / auth / bill / stats
  pages/index          明细
  pages/add            记一笔
  pages/stats          统计
  pages/profile        我的（个人中心）
  styles/_vars.scss    设计变量
```

## 运行前必须做的三件事

### 1. 确认 AppID 是你的

`project.config.json` 里的 `appid` 是构建时写入的值（当前为 `wxf3dabfe233a259b7`）。如果不是你的小程序 AppID，请在微信开发者工具「详情 → 基本信息」里改成本人的，否则云开发无法使用（游客 AppID 不支持云开发）。

### 2. 开通云开发（集合会自动创建）

微信开发者工具 → 顶部「云开发」→ 开通环境（按量付费有免费额度）。

部署完云函数后，首次静默登录会自动创建 `bills`、`users` 两个集合（`cloudfunctions/login` 里调了 `createCollection`，已存在则跳过）。

如果自动创建失败（例如账号无建集合权限），手工建两个集合：

| 集合 | 权限设置 |
| --- | --- |
| `bills` | **仅创建者可读写** |
| `users` | **仅创建者可读写**（仅云函数使用，客户端不直连） |

`bills` 建议加索引：`date` 降序 + `time` 降序（组合索引，明细按天分组、同一天内按记账时刻倒序）。

`bills` 的一条记录长这样：

```json
{
  "_id": "自动生成",
  "_openid": "自动写入（客户端新增时）",
  "type": "expense",
  "categoryId": "food",
  "amount": 2850,
  "note": "午饭",
  "date": "2026-11-03",
  "createdAt": "服务端时间",
  "updatedAt": "服务端时间"
}
```

### 3. 部署两个云函数

在开发者工具左侧目录 `cloudfunctions` 上右键 →「当前环境」选择刚创建的环境 → 分别右键 `login`、`stats` →「上传并部署：云端安装依赖」。

如果账号下有多个环境，把环境 ID 填到 `src/config/cloud.ts` 的 `CLOUD_ENV` 中；只有一个环境时留空即可（使用默认环境）。

> **本项目已固定环境**：`CLOUD_ENV = 'cloud1-d0g8ykn52bc4b36f2'`（体验版环境，云函数部署在此）。
> 该账号下还有一个 `prod-d6g6j3p677ff26615`，不传 env 时会连到默认环境，导致 `-501000 the resource is not found`。
> 换环境时只需改这一行并重新构建。

> 判断依据：`-501000` 表示「环境里找不到这个资源」，**不是函数写错了**。云开发控制台「概览」页点环境 ID 旁的复制按钮，
> 与 `src/config/cloud.ts` 的值逐字符比对（重点看 `l` / `1` / `0` / `O`）。

## 开发与构建

```bash
npm install
npm run dev:weapp      # 监听编译，产物在 dist/
npm run build:weapp    # 生产构建
```

然后用微信开发者工具「导入项目」，**目录选择本仓库根目录 `记账/`（不要选 `dist/`）**：

- 根目录的 `project.config.json` 里 `miniprogramRoot: "./dist"`、`cloudfunctionRoot: "cloudfunctions/"`，工具会自动把 `dist` 当小程序代码目录、`cloudfunctions` 当云函数目录；
- 如果误选了 `dist/`，工具读到的是 `dist/project.config.json`，左侧只有打包产物、**不会出现 `cloudfunctions`**，云函数也就无法上传部署，界面会一直提示「云函数 stats 未部署」。
- 判断是否导入正确：左侧资源管理器里应该能看到带云朵图标的 `cloudfunctions` 节点。

> **改完 node_modules 后务必重新构建**：`npm run build:weapp` / `dev:weapp` 会先执行 `scripts/patch-taro-raf.mjs` 再编译。

> **JS 压缩器是 esbuild 而非 terser**：`config/index.ts` 里 `jsMinimizer: 'esbuild'`。terser 会起一组并行 worker，每个进程几十 MB 堆，本机 commit 内存紧张时构建会直接 OOM（V8 报 `young object promotion failed`，或 Rust 侧 `memory allocation of 56 bytes failed`）。esbuild 是单进程原生实现，`target: es5` 还会把 webpack 生成的对象简写等 ES6 语法降级，产物（541 KB）同样能通过 `check-dist`。

## 上传为体验版（内部测试）

代码侧已就绪，流程上**不需要审核、不需要备案、不需要配服务器域名**——体验版不走审核，备案只约束线上版本，数据全部走云开发不占合法域名。真正要做的只有下面四步，外加一项必须核对的数据库权限。

### 1. 构建最新产物

```bash
npm run build:weapp
```

必须看到末尾 `[check-dist] ✓ N 个产物通过 ES5 解析`。带 `--watch` 的产物不要拿去上传。

### 2. 在开发者工具里上传

右上角「上传」→ 版本号填 `1.0.0`、项目备注写清本版内容。上传前确认工具打开的是**仓库根目录**（左侧能看到 `cloudfunctions` 节点），否则打包进去的是残缺产物。

### 3. 后台「选为体验版」

小程序后台 → 管理 → 版本管理 → 开发版本 → 目标版本右侧「选为体验版本」。首次设置时平台可能要求先补齐主营类目，按实际功能选。

同一版本号重复上传会覆盖开发版本，**覆盖后必须重新「选为体验版本」**，否则体验二维码仍指向旧包。

### 4. 添加体验成员

管理 → 成员管理 → 体验成员 → 添加微信号（个人主体上限 15 人，企业主体 90 人）。体验成员扫码即用；未添加的人扫码会提示「没有体验权限」。

### 必须核对：数据库权限

体验版会把小程序给到别人，集合权限写错就会串数据：

| 集合 | 必须是 |
| --- | --- |
| `bills` | **仅创建者可读写** |
| `users` | **仅创建者可读写** |

若被设成「所有用户可读」，体验成员之间会互相看到账目。

### 其它注意事项

- **数据不隔离**：体验版与开发者工具共用 `CLOUD_ENV`（`cloud1-...`），测试数据会留在同一集合里，不会自动分开。要隔离就再开一个环境并改 `src/config/cloud.ts`。
- **基础库**：代码用到 `getWindowInfo`（2.20.1+）、`getMenuButtonBoundingClientRect`（2.1.0+）、`wx.cloud`（2.2.3+）；`src/utils/system.ts` 对 `getWindowInfo` 缺失有兜底。若后台设置最低基础库，建议 ≥ 2.20.1。
- **隐私保护指引**：本项目未调用任何隐私接口（无 `getUserProfile`、相册、定位、剪贴板），不需要隐私授权弹窗；若后台提审时提示补充，按「仅用于 openid 标识账目归属」填写即可。
- **版本号同步**：后台填的版本号与 `src/pages/profile/index.tsx` 的 `APP_VERSION` 保持一致，「关于」里显示的才是当前版本。
- **调试信息只在开发版出现**：`src/config/env.ts` 读取 `envVersion`，体验版/正式版的「我的 → 云开发环境」入口与 `[cloud] 已初始化` 日志会自动隐藏。

## 构建产物的语法目标（预览二维码报 `Unexpected token .` 就是这个原因）

`package.json` 的 `browserslist` 决定 Babel 把代码降级到哪一代语法，Taro 模板默认给的是：

```json
"browserslist": ["defaults and fully supports es6-module", "maintained node versions"]
```

这个目标认为运行环境原生支持可选链，Babel 就不会降级，于是 `?.`、`??` 原样进产物。
开发者工具「预览 / 上传」用的解析器只认到 ES2015，读到 `a?.b` 直接报：

```
invalid file: common.js, 1:41477 SyntaxError: Unexpected token .
```

小程序端应改为：

```json
"browserslist": ["ios >= 9", "android >= 4.4", "chrome >= 53"]
```

`npm run build:weapp` 末尾会自动执行 `scripts/check-dist.mjs`，用 acorn 以 **ES5** 解析 `dist` 下所有 js，
有任何现代语法都会失败并打印文件名与行列号。手动检查：`npm run check:dist`。

## 构建补丁：修复空白页 / `Cannot access 'c' before initialization`

`@tarojs/runtime@4.3.2` 的 `dist/bom/raf.js` 里写了裸的 `requestAnimationFrame` / `cancelAnimationFrame`：

```js
const _raf = _hasNativeRaf ? requestAnimationFrame : function (callback) { /* setTimeout 兜底 */ }
```

而 Taro 的 `MiniWebpackPlugin` 用 `ProvidePlugin` 把所有裸标识符重定向到 `@tarojs/runtime` 自己的导出：

```js
requestAnimationFrame: ['@tarojs/runtime', 'requestAnimationFrame']
```

打包后这段代码就变成「模块初始化时读取自己尚未赋值的导出」，`const` 处于 TDZ，运行即抛
`ReferenceError: Cannot access 'c' before initialization`，表现为开发者工具报 `app.js` / `WAServiceMainContext` 错误、页面全白。

小程序环境本来就没有原生 raf（`TARO_PLATFORM=mini`，`_hasNativeRaf` 恒为 `false`），所以
`scripts/patch-taro-raf.mjs` 直接把这一分支删掉、保留 `setTimeout` 实现，行为完全等价。脚本幂等，
已挂在 `postinstall` 上，`npm install` 后自动生效；同时会清理 Taro 预打包缓存 `node_modules/.taro`。

等 Taro 上游修复后（检查 `node_modules/@tarojs/runtime/dist/bom/raf.js` 是否还含裸标识符），
删掉该脚本与 `package.json` 里的 `postinstall` 即可。

## 图标

全部图标来自开源图标库 [Lucide](https://lucide.dev)（ISC License），通过 `lucide-react-taro` 以 React 组件形式使用，不再预生成 PNG：

- 界面图标：`import { Calendar, ChevronRight } from 'lucide-react-taro'`，直接传 `size` / `color`
- 分类图标：`src/components/CatIcon.tsx` 维护 `key → 组件` 注册表，颜色随分类色或选中态实时切换
- 图标色板：`src/constants/icons.ts`（与 `styles/_vars.scss` 的文本层级对齐）
- 默认头像：纯 CSS 渐变 + `UserRound` 图标，见 `src/pages/profile/index.scss`

渲染方式：小程序端由组件把 SVG 转成 `data:image/svg+xml` 交给 `<Image>`，因此**颜色只能靠 `color` 属性传**，
无法继承 CSS 的 `currentColor`；尺寸同样由 `size` 决定（组件输出内联 `width/height`，优先级高于 scss 里同名 class），
`className` 只用于布局、外边距与 `opacity`。

新增图标只需 `import` 后使用；分类图标还需在 `CatIcon` 的注册表里补一行。`lucide-react-taro` 的产物含
`??` 等 ES2020 语法，已在 `config/index.ts` 的 `mini.compile.include` 中纳入 babel 处理，保证通过
`scripts/check-dist.mjs` 的 ES5 体检。

## 常见报错对照

界面上的错误提示会把云开发原始错误翻译成可执行的步骤（见 `src/utils/error.ts`）：

| 界面提示 | 原始错误 | 怎么修 |
| --- | --- | --- |
| 云函数 stats 未部署 | `-501000 the resource is not found` | 右键 `cloudfunctions/stats` → 上传并部署（云端安装依赖）；`login` 同理 |
| 集合 bills 不存在 | `-502005 database collection not exists` | 云开发控制台建集合，或先部署 `login` 让它自动建 |
| 没有读写权限 | `-502003 permission denied` | 集合权限改为「仅创建者可读写」 |
| 云开发环境未就绪 | `请先初始化` / `invalid env` | 确认已开通云开发；多环境时填 `src/config/cloud.ts` 的 `CLOUD_ENV` |

## 说明与限制

- 第一版只做「记一笔 / 看明细 / 看统计」，暂不支持账目编辑、多账本、预算与自定义分类。
- 统计走云函数聚合，明细列表走客户端直连数据库分页（每页 20 条），兼顾速度与安全。
- 删除为明细左滑露出按钮触发，二次确认后物理删除，无回收站。

## 交互细节

- **明细侧滑删除**：单条左滑露出「删除」，滑过按钮宽度一半即吸附打开，否则回弹；同时只允许一行处于打开态，点其他位置自动收回。滑开本身不写库，点删除后再弹二次确认。
  位移用 `transform` 实现，删除按钮宽度在 scss（rpx）与 tsx（真机 px，按 `windowWidth / 750` 换算）两处定义，改动时需同步。
- **记账时间**：页面不再实时走秒，默认显示进入页面时的时刻；点击时间行唤起三列选择器（时 / 分 / 秒）可手动改。没改过时间则保存瞬间取当前时刻，改过则以选中的值为准。
