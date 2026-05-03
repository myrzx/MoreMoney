# 💰 MoreMoney — 今天能喝多少杯奶茶？

一个蹲在屏幕右下角、实时帮你算钱的桌面小部件。**绝不暴露真实工资**，只告诉你"已赚 12.345678 杯奶茶"。

## ✨ 特点

- 🕘 **只在上班时间计费** — 默认 9:00–17:30，周末自动停
- 🍵 **休息时间扣除** — 午休、晚饭时间不计工时，配置灵活
- 🧋 **等价物换算** — 奶茶 20 块？手办 1000？显卡 15000？金额全藏起来
- ⛏ **挖矿风 UI** — 荧光数字、粒子特效、扫描线、进度条流光滑杆
- 📌 **置顶右下角** — always-on-top，随时瞥一眼
- 🔒 **系统托盘** — 关了不退出，点托盘图标随时唤出
- 🔔 **下班提醒** — 到点自动弹通知，告诉你今天赚了多少
- 🔐 **薪资隐私** — 输入框默认隐藏，点眼睛才显示
- ⚙ **设置面板** — 月薪、工时、休息、等价物随心改

## 🚀 快速开始

```bash
# 安装
npm install

# 开发运行
npm start

# 打包（输出到 dist/）
npm run build
```

> Windows 打包如遇 GitHub 下载慢，设镜像：
> ```cmd
> set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
> set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
> npm run build
> ```
> winCodeSign 需要管理员权限的符号链接，用管理员 cmd 执行。

## ⌨ 操作

| 操作 | 方式 |
|------|------|
| 移动窗口 | 拖拽顶部区域 |
| 切换等价物 | 点击 🧋 图标 |
| 打开设置 | 点击 ⚙ 按钮 |
| 最小化到托盘 | 点击 ━ 或关闭窗口 |
| 真正退出 | 右键托盘 → 退出 |

## 📁 配置

配置文件位于 `%APPDATA%\more-money\config.json`，首次启动自动生成：

```json
{
  "monthlySalary": 25000,
  "workStart": "09:00",
  "workEnd": "17:30",
  "workDays": [1, 2, 3, 4, 5],
  "breaks": [
    { "start": "12:00", "end": "13:30" }
  ],
  "reminderEnabled": true,
  "equivalents": [
    { "name": "辣条", "icon": "🌶️", "price": 2 },
    { "name": "奶茶", "icon": "🧋", "price": 20 },
    { "name": "手办", "icon": "👾", "price": 1000 },
    { "name": "显卡", "icon": "🎮", "price": 15000 }
  ],
  "selectedEquivalent": 0
}
```

| 字段 | 说明 |
|------|------|
| `monthlySalary` | 月薪（元） |
| `workStart` / `workEnd` | 上下班时间 |
| `workDays` | 工作日，1=周一 ... 7=周日 |
| `breaks` | 休息时间段，不计工时 |
| `reminderEnabled` | 下班提醒开关 |
| `equivalents` | 等价物列表（名称、图标、单价） |
| `selectedEquivalent` | 当前选中的等价物索引 |

## 🧮 计薪逻辑

```
秒薪 = 月薪 ÷ 21.75（月均工作日）÷ 8（小时）÷ 3600（秒）
有效工时 = 下班时间 - 上班时间 - 休息总时长
今日已赚 = 秒薪 × 已工作秒数（扣除已过的休息时间）
```

启动时根据当前时间自动算好已赚金额，**不从零开始**。休息时间段内不计费，进度条和金额实时同步。

## 🛠 技术栈

Electron + 原生 HTML/CSS/JS，无前端框架，electron-builder 打包。

## 📄 License

MIT
