# WinWin 個股資產管理

個人股票進出紀錄與資產分析網頁，可追蹤：

- **進出資料**：買進／賣出紀錄（價格、股數、手續費、證交稅）
- **資產獲利**：未實現損益、已實現損益、總損益
- **資產報酬率**：總損益 ÷ 累計投入本金
- **資產配置**：持股市值占比、集中度、損益貢獻圖表

## 功能特色

- 移動平均成本法計算持股成本
- 台股手續費／證交稅自動建議（可手動調整）
- 手動更新現價，即時重算損益與配置
- 資料儲存於瀏覽器 LocalStorage
- 支援 JSON 匯出／匯入備份

## 線上使用

目標網址：

**https://mein227.github.io/winwin/**

### 第一次啟用（只需做一次）

部署 workflow 已就緒，但 GitHub Pages 需由你在網頁上開啟：

1. 打開：https://github.com/mein227/winwin/settings/pages
2. **Build and deployment → Source** 選擇 **GitHub Actions**
3. 再到：https://github.com/mein227/winwin/actions  
   打開最新的 **Deploy to GitHub Pages**，點 **Re-run all jobs**
4. 約 1 分鐘後即可透過上方網址瀏覽

之後每次推送到 `main`，網站會自動重新部署。

> 提醒：資料存在你瀏覽器的 LocalStorage，換裝置或清快取後不會自動同步；可用總覽頁的「匯出／匯入」備份。

## 本機開發

```bash
npm install
npm run dev
```

開啟終端機顯示的網址（預設 `http://localhost:5173`）。

## 建置

```bash
npm run build
npm run preview
```

## 使用流程建議

1. 到「進出紀錄」新增買進／賣出
2. 到「持股明細」更新目前市價
3. 在「總覽」查看總資產、獲利與報酬率
4. 在「資產配置」檢視持股比例與集中度

## 技術棧

- React + TypeScript + Vite
- Tailwind CSS
- Recharts
