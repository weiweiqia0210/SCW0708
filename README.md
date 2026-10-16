# 📖 AI 互动文游 (AI Interactive Text Adventure)

清透蓝白设计风格的沉浸式 AI 互动文游与小说创作平台。支持角色档案、世界书、预设、多轮剧情分支与动态数值追踪，兼容手机端与桌面端。

---

## 🚀 部署指南 (Deployment Guide)

### 选项一：GitHub Pages 纯前端静态部署（推荐，0服务器费用）

本项目现已内置**客户端直连双模引擎**（Dual-Mode AI Engine），支持直接在 GitHub Pages 纯静态环境下运行，无需购买或配置任何 Node.js 服务器！

1. **推送到 GitHub 仓库**：
   将代码推送到您的 GitHub 仓库 `main` 或 `master` 分支。
2. **开启 GitHub Pages**：
   - 进入仓库页面的 **Settings** -> **Pages**。
   - 在 **Build and deployment** -> **Source** 中选择 **GitHub Actions**。
3. **自动发布**：
   - 仓库内已内置 `.github/workflows/deploy.yml` 工作流。推送代码后，GitHub Actions 会自动编译并发布。
   - 部署完成后，在 Pages 页面即可获得专属访问网址（如 `https://<你的用户名>.github.io/<仓库名>/`）。
4. **游玩配置**：
   - 用手机或电脑打开该网页，进入底栏「设置」，输入您的 **Gemini API Key** 或 **第三方 OpenAI 兼容 API Key**（如 DeepSeek、SiliconFlow、OpenRouter、Kimi 等）。
   - 浏览器会自动直接向官方模型发送请求，数据完全保存在本地浏览器 LocalStorage 中，隐私安全。

---

### 选项二：全栈部署（Vercel / Render / Railway / Zeabur / Docker）

如果您希望将 API Key 统一配置在服务器环境变量中（用户免填 Key 即可游玩），可以直接进行全栈部署：

- **启动命令**：`npm start` (即 `tsx server.ts`)
- **构建命令**：`npm run build`
- **环境变量**：
  - `GEMINI_API_KEY`: 您的 Gemini API 密钥
  - `PORT`: 服务端口（默认 3000）

---

## 📱 手机端打开与游玩说明

本项目专为移动端进行了深度适配：
- **自适应视口**：采用 `100dvh` 动态视口高度与 `safe-area` 安全区适配，全面适配 iPhone 灵动岛、刘海屏及底部横条（Home Indicator）。
- **防键盘缩放**：输入框自动适配 16px 规则，聚焦时 iOS Safari 不会产生页面变形抖动。
- **添加至主屏幕（强烈推荐）**：
  - **iPhone (Safari)**：点击底部分享按钮 ➡️ 选择 **“添加到主屏幕”**。
  - **Android (Chrome / 微信浏览器)**：点击右上角菜单 ➡️ 选择 **“添加至主屏幕 / 安装应用”**。
  - 启动后将以**原生无边框独立全屏 App** 模式运行，沉浸感倍增！

---

## ✨ 核心特性

- **文游创作中心**：角色卡（可 AI 智能润色）、世界书设定条目、系统提示词预设、玩家面具切换。
- **智能剧情引擎**：
  - 支持**自由字数**与**严格字数区间控制**（如 300~600 字）。
  - 支持**人称代词**（第一人称、第二人称、第三人称）。
  - 支持**对话模式**与**导演模式**（导演模式下玩家输入视为舞台场景指导）。
  - 支持**防抢话开关**（严格禁止 AI 代替玩家发言与作决策）。
  - 支持**本场写作指导**（随时输入文风、行文侧重）。
  - 支持**消息双向删除**（玩家和 AI 回复下方均有一键删除确认）。
  - 支持**多分支剧情回溯**与**角色多维数值追踪**。
