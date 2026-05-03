# MoreMoney 设计文档

## 概览

MoreMoney 是一个 Windows 桌面薪资可视化工具，基于 Electron + 原生 HTML/CSS/JS（无前端框架），~1200 行代码。核心思路：将上班期间的实时薪资换算为等价物（奶茶、显卡等），以挖矿风格动画在屏幕右下角展示，保护薪资隐私。

## 架构

```
┌─────────────────────────────────────────────────┐
│                   Main Process                   │
│  main.js  (200 lines)                            │
│                                                   │
│  ┌──────────┐  ┌───────────┐  ┌───────────────┐  ┌───────────────┐ │
│  │   Tray   │  │ Main Win  │  │ Settings Win  │  │  Stats Win    │ │
│  │  托盘管理  │  │ 320×220   │  │   500×560     │  │  500×580      │ │
│  │  右键菜单  │  │ 右下角置顶 │  │   屏幕居中     │  │  屏幕居中      │ │
│  └──────────┘  └───────────┘  └───────────────┘  └───────────────┘ │
│                        │              │           │
│              ┌─────────┴──────────────┴─────┐    │
│              │       IPC Handlers            │    │
│              │  load/save config              │    │
│              │  open settings / hide window   │    │
│              │  test reminder                 │    │
│              │  open stats                    │    │
│              │  load/save records             │    │
│              └───────────────────────────────┘    │
│                                                   │
│              ┌───────────────────────────────┐    │
│              │       Config Store             │    │
│              │  userData/config.json          │    │
│              │  fallback: __dirname/config    │    │
│              └───────────────────────────────┘    │
│                                                   │
│              ┌───────────────────────────────┐    │
│              │       Records Store            │    │
│              │  userData/records.json         │    │
│              │  每日打卡记录 + 自动填充         │    │
│              └───────────────────────────────┘    │
│                                                   │
│              ┌───────────────────────────────┐    │
│              │       Clock-out Reminder       │    │
│              │  scheduleReminder()            │    │
│              │  Notification API              │    │
│              └───────────────────────────────┘    │
└─────────────────────────────────────────────────┘
                         │
                    contextBridge
                    (preload.js)
                         │
┌─────────────────────────────────────────────────┐
│                 Renderer Process                 │
│                                                   │
│  ┌──────────────────┐  ┌──────────────────────┐ │
│  │   Main Panel      │  │   Settings Panel     │ │
│  │   index.html      │  │   settings.html      │ │
│  │   main-renderer   │  │   settings-renderer  │ │
│  │   style.css       │  │   (inline style)     │ │
│  └──────────────────┘  └──────────────────────┘ │
│                                                   │
│  ┌──────────────────────────────────────────────┐│
│  │             Salary Engine                    ││
│  │  calcPerSecondRate()  — 秒薪计算              ││
│  │  getTodayWorkSeconds() — 有效工作时长          ││
│  │  isWorkday()          — 工作日判断             ││
│  │  getBreakTotal()      — 休息总时长            ││
│  │  getElapsedBreakSeconds() — 已过休息时长       ││
│  │  getCurrentBreak()    — 当前是否在休息         ││
│  │  每 100ms tick 累加 + 每 60s 重校准            ││
│  └──────────────────────────────────────────────┘│
│                                                   │
│  ┌──────────────────────────────────────────────┐│
│  │             Animation Layer                  ││
│  │  Particle System (Canvas 2D, max 200)        ││
│  │  Scanline overlay (CSS ::before)             ││
│  │  Glow text-shadow pulse                      ││
│  │  Progress bar shine effect                   ││
│  │  Visibility-aware animation pause            ││
│  └──────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

### 进程模型

| 进程 | 文件 | 职责 |
|------|------|------|
| Main | `main.js` | 窗口生命周期、系统托盘、IPC 路由、配置文件读写、下班提醒 |
| Bridge | `preload.js` | 安全暴露 `electronAPI` 到渲染进程（contextBridge） |
| Renderer | `src/*` | 薪资计算、UI 渲染、动画、设置表单、工时统计 |

### 数据流

```
config.json ──→ loadConfig() ──→ calcPerSecondRate()
                                      │
                                      ▼
                               currentAmount (累加，扣除休息时间)
                                      │
                                      ▼
                               ÷ equivalent.price
                                      │
                                      ▼
                               displayAmount ──→ DOM 更新
                                              ──→ Canvas 粒子

config.json ──→ scheduleReminder() ──→ setTimeout(workEnd)
                                           │
                                           ▼
                                      showNotification()
                                      (含实际收入数字)
```

## 核心模块

### 1. 薪资引擎 (`src/main-renderer.js`)

```
秒薪 = 月薪 ÷ 21.75(月均工作日) ÷ 8(小时) ÷ 3600(秒)
有效工时 = 下班 - 上班 - 休息总时长
今日已赚 = 秒薪 × 已工作秒数（扣除已过的休息时间）
```

关键设计决策：
- **启动时不从零开始**：`resetAccumulation()` 根据当前时间直接跳到应赚金额
- **双定时器**：100ms tick 保证动画流畅，60s 重校准防止浮点误差累积
- **工作日判断**：`workDays` 数组 [1,2,3,4,5] 对应周一到周五，周日=7
- **Lerp 平滑**：`displayAmount` 以 0.08 系数向 `currentAmount` 渐进，数字不跳变
- **休息时间扣除**：`getElapsedBreakSeconds()` 计算已过的休息时间，从 elapsed 中减去
- **休息状态**：当前时间在休息时段内时，status 为 `break`，UI 显示紫色状态点和 🍵 图标

### 2. 粒子系统 (`src/main-renderer.js`)

Canvas 2D 绘制，每个粒子上升 + 水平漂移 + 渐隐：
- 工作中：青色粒子 (34,211,238)，产卵率 0.5/帧
- 非工作中（含休息）：灰色粒子 (107,114,128)，产卵率 0.05/帧
- 每个粒子有径向渐变发光，增强挖矿感
- **上限 200 个**，超过不再产卵
- **睡眠唤醒防积压**：`dt > 1s` 时跳过产卵，防止电脑休眠后粒子爆发导致卡死

### 3. 下班提醒 (`main.js`)

- 到达 `workEnd` 时间自动弹出 Windows 系统原生通知
- 通知内容包含实际已赚金额和当前等价物（如"今天已赚 3.25 🧋 奶茶"）
- 设置面板可开关、可测试
- 配置变更时自动重新调度下一个提醒

### 4. 窗口管理 (`main.js`)

三个 BrowserWindow：
- **主面板**：320×220，右下角，`alwaysOnTop`，无边框透明
- **设置面板**：500×560，屏幕居中，无边框透明
- **统计面板**：500×580，屏幕居中，无边框透明

两个窗口都采用 `transparent: true`，圆角由 CSS `border-radius` 实现。关键陷阱：`-webkit-app-region: no-drag` 不可设在 `body` 上，否则 Electron 33 会穿透所有鼠标事件。只在 `.drag-bar` 设 `drag`，其余区域默认即可点击。

### 5. 配置系统 (`main.js` + `config.json`)

双层读取：
1. 优先读 `%APPDATA%/more-money/config.json`（用户改过的配置）
2. 不存在则从打包的 `config.json` 复制到 userData（首次启动）
3. 每次设置面板保存时同步写入 userData + 主面板 focus 时重载

`config.json` 随 asar 打包分发，保证首次启动有默认值。

配置字段：
```json
{
  "monthlySalary": 25000,
  "workStart": "09:00",
  "workEnd": "17:30",
  "workDays": [1, 2, 3, 4, 5],
  "breaks": [{ "start": "12:00", "end": "13:30" }],
  "reminderEnabled": true,
  "equivalents": [...],
  "selectedEquivalent": 0
}
```

### 6. 日历 (`src/calendar.html` + `src/calendar-renderer.js`)

日历视图展示每日工时，支持手动打卡：

- **日历渲染**：按月展示，工作日格子可点击，显示上下班时间和工时
- **手动打卡**：点击日历格子弹出时间选择器，保存上下班时间
- **自动记录**：`autoRecord()` 每 60s 检查，自动为当天和过去的日子创建/补全记录
- **工时计算**：扣除休息时间，超过 8h 红色标注，不足 8h 绿色标注
- **月度统计**：工作天数、总工时、奉献工时（总工时 - 天数×8）、日均工时
- **持久化**：`userData/records.json` 存储每日打卡记录

### 7. 主题系统（规划中）

采用 CSS 自定义变量 + `body` class 切换方案：

1. 定义主题色变量集（如 `--bg-primary`, `--border`, `--text`, `--accent` 等）
2. 当前 RPG 像素风作为默认主题（`body.theme-rpg`）
3. 未来可添加 `body.theme-mining`（挖矿风）、`body.theme-light`（亮色）等
4. 主题切换只需 `document.body.className = 'theme-xxx'`

优势：一套 HTML + JS，CSS 变量自动跟随主题切换，扩展性好。

## 性能优化

| 优化点 | 说明 |
|--------|------|
| 粒子上限 | `MAX_PARTICLES = 200`，超过不再产卵 |
| 睡眠防积压 | `dt > 1s` 时跳过产卵，防止休眠后粒子爆发 |
| 状态缓存 | `getTodayWorkSeconds()` 每帧只算一次，结果传给粒子函数 |
| 动画暂停 | 窗口隐藏时 `.paused` 类暂停所有 CSS `infinite` 动画 |
| 配置重载 | focus 时直接 `reloadConfig()`，不再 `JSON.stringify` 比较 |

## 扩展方向

### 短期（低复杂度）

- **多语言/国际化**：文案集中管理，支持英文。目前硬编码中文
- **开机自启**：写入 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`，设置面板加开关
- **多个等价物同时显示**：主面板展示多行，如"3.2 杯奶茶 + 0.06 个手办"
- **主题切换**：CSS 变量 + body class，见「主题系统」章节
- **通知提醒**：上班/下班时 Windows 通知，午休倒计时 ← 已实现下班提醒

### 中期（中等复杂度）

- **月/年累计统计**：已实现日历 + 工时统计页，可扩展年度视图和 Chart.js 图表
- **自定义工作日/节假日**：支持法定节假日配置、调休标记、弹性工作制
- **多任务计时**：支持计时计费模式（如"项目 A 已耗时 3h，计入 ¥xxx"），适合自由职业者
- **数据导出**：CSV/JSON 导出历史记录，供外部分析
- **窗口吸附**：主面板吸附到屏幕边缘，鼠标靠近时滑出，类似 QQ 面板
- **等价物市场价联动**：通过网络 API 获取实时价格（如显卡价格波动），薪资换算更真实

### 长期（架构级）

- **跨平台支持**：macOS/Linux 适配（托盘 API 不同，需 `detectPlatform()` 分支）
- **插件系统**：等价物来源可插拔（本地 JSON → 自定义函数 → 远程 API），开放自定义计费规则
- **远程配置同步**：WebDAV/GitHub Gist 同步配置，多机共享
- **PWA/Web 版**：核心逻辑抽离为纯 JS 库，不依赖 Electron，浏览器也能跑
- **桌面小组件标准**：适配 Windows Widgets / macOS Sonoma 小组件

## 技术债务

| 项 | 说明 |
|----|------|
| 全局变量 | `main-renderer.js` 中 config/state 挂在模块作用域，可封装为 class |
| 硬编码色值 | CSS 中颜色散落各处，主题切换需 CSS 变量化（规划中） |
| 内联样式 | 设置页和统计页样式写在 `<style>` 标签内，可考虑抽到共享 CSS |
| 无测试 | 纯手工验证，薪资引擎可单独抽离做单元测试 |
| 错误处理 | IPC 失败静默忽略，可加 Toast 提示 |

## 目录结构

```
MoreMoney/
├── main.js              # Electron 主进程（窗口、托盘、IPC、提醒、记录管理）
├── preload.js           # IPC 安全桥接
├── package.json         # 依赖 + electron-builder 配置
├── config.json          # 默认配置（打包进 asar）
├── DESIGN.md            # 架构设计文档
├── assets/
│   ├── icon.png         # 托盘图标 (256×256)
│   ├── zpix.ttf         # Zpix 中文像素字体
│   └── PressStart2P.ttf # Press Start 2P 英文像素等宽字体
└── src/
    ├── index.html       # 主面板 DOM
    ├── style.css        # 全局样式 + RPG 像素风主题
    ├── main-renderer.js # 薪资引擎 + 粒子 + UI 逻辑
    ├── settings.html    # 设置面板 DOM + 内联样式
    ├── settings-renderer.js # 设置面板逻辑
    ├── calendar.html       # 日历 DOM
    └── calendar-renderer.js # 日历渲染 + 打卡逻辑
```
