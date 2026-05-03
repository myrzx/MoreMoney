# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MoreMoney is a Windows Electron desktop salary visualization widget (v1.2.0). It sits in the bottom-right corner and converts real-time work earnings into equivalents (milk tea, figurines, etc.) using an RPG pixel-art aesthetic. Pure vanilla HTML/CSS/JS, no framework.

## Commands

- `npm install` — install dependencies
- `npm start` — run in development (`electron .`)
- `npm run build` — build Windows portable exe to `dist/`

## Architecture

Three-process Electron model with contextIsolation enabled and nodeIntegration disabled:

**Main process** (`main.js`): Window management (3 frameless BrowserWindows), system tray, 9 IPC handlers, config/records file I/O, auto-record timer, clock-out reminder scheduler.

**Preload** (`preload.js`): contextBridge exposes `window.electronAPI` with 9 promise-based IPC methods (all invoke/handle, no send/on).

**Renderers** (`src/`): Three separate HTML pages, each with its own JS:
- `main-renderer.js` — salary engine (per-second rate calculation, break deduction), particle system (Canvas 2D, max 200 particles), UI update loop (100ms display, 60ms recalibration)
- `settings-renderer.js` — config form (salary, hours, breaks, equivalents, workday checkboxes)
- `stats-renderer.js` — monthly calendar with manual clock-in/out popup, summary stats

Shared CSS: `src/style.css` (RPG pixel theme, Zpix + Press Start 2P fonts, scanline overlay).

## Data storage

- **Config**: `%APPDATA%/more-money/config.json` (user copy), falls back to bundled `config.json` on first launch
- **Records**: `%APPDATA%/more-money/records.json` — daily `{clockIn, clockOut, multiplier, breaks, workHours, earned}`
- **Holidays**: `data/holidays.json` — bundled, keyed by year, entries have `{name, type}` where type is `"holiday"` or `"workday"` (tiaoxiu)

## Salary calculation

```
perSecond = monthlySalary / 21.75 / 8 / 3600 * overtimeMultiplier
earned = perSecond * (workSeconds - breakSeconds)
equivalent count = earned / equivalent.price
```

The `isWorkday()` function exists in three places (main.js, main-renderer.js, stats-renderer.js) — all must accept holidays parameter and check holidays first, then fall back to `workDays` config array.

## Key conventions

- All windows are frameless, transparent, with custom drag bars (`-webkit-app-region: drag`)
- Closing main window hides to tray (does not quit); settings/stats windows close normally
- Multiplier cycles 1x/2x/3x on click, resets daily
- Calendar uses Monday-first layout (`getDay() - 1`, with -1 mapped to 6)
- Holiday data must be updated manually each year in `data/holidays.json`
