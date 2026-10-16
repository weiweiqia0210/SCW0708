# 🐰 塔可 (Taco) - AI 互动文游

清透水色像素风与蓝白设计风格的沉浸式 AI 互动文游与小说创作平台。支持角色档案、世界书、预设、多轮剧情分支与动态数值追踪，支持直接安装至安卓与 iOS 手机桌面。

---

## 📱 手机桌面 PWA 安装指南 (Install to Home Screen)

本项目已全面满足 Progressive Web App (PWA) 安装标准，并深度适配 GitHub Pages 子路径：

### 1. 安卓手机 (Android Chrome / Edge / 微信内置浏览器)
- **方式一（推荐）**：使用手机 Chrome 打开网页，进入底栏「我的」页面，点击「一键安装」；
- **方式二**：点击浏览器右上角三个点菜单（`⋮`） ➡️ 选择 **「安装应用」** 或 **「添加到主屏幕」**。
- **验证与效果**：
  - 手机桌面将生成以「塔可」命名、携带专属像素水色兔子头像的桌面图标；
  - 点击启动后，自动以独立原生全屏模式运行（隐藏浏览器地址栏与底部工具栏），享受无干扰沉浸体验。

### 2. 苹果手机 (iPhone iOS Safari)
- 使用 Safari 打开网页；
- 点击 Safari 底部居中的 **「分享」按钮**（带箭头的方框）；
- 向上滑动菜单，点击 **「添加到主屏幕」**；
- 确认名称为「塔可」，点击右上角「添加」即可。

---

## 🚀 GitHub Pages 自动化部署指南

本项目内置**客户端直连双模引擎**（Dual-Mode AI Engine），支持直接在 GitHub Pages 纯静态环境下运行，无需购买或配置任何 Node.js 服务器！

1. **推送到 GitHub 仓库**：
   将代码推送到您的 GitHub 仓库 `main` 或 `master` 分支。
2. **开启 GitHub Pages**：
   - 进入仓库页面的 **Settings** -> **Pages**。
   - 在 **Build and deployment** -> **Source** 中选择 **GitHub Actions**。
3. **自动发布**：
   - 仓库内已内置 `.github/workflows/static.yml` 工作流。推送代码后，GitHub Actions 会自动编译并发布。
   - 部署完成后，在 Pages 页面即可获得专属访问网址（如 `https://<你的用户名>.github.io/<仓库名>/`）。
4. **游玩配置**：
   - 用手机或电脑打开该网页，进入底栏「设置」，输入您的 **Gemini API Key** 或 **第三方 OpenAI 兼容 API Key**（如 DeepSeek、SiliconFlow、OpenRouter、Kimi 等）。
   - 浏览器会自动直接向官方模型发送请求，数据完全保存在本地浏览器 LocalStorage 中，隐私安全。

---

## 🛠️ PWA 验证方法 (How to Verify)

1. **Chrome DevTools (桌面端检查)**：
   - 按 `F12` 打开开发者工具，切换到 **Application**（应用）面板；
   - 点击左侧 **Manifest**：
     - 确认 `Name` 与 `Short name` 为「塔可」；
     - 确认 `Start URL` 与 `Scope` 解析正确；
     - 确认包含 192×192、512×512 及 maskable 图标，且像素兔子图片预览正常；
   - 点击左侧 **Service Workers**：确认 `sw.js` 处于 `activated and is running` 激活运行状态。
2. **手机端验证**：
   - 打开网站后，安卓 Chrome 地址栏右侧会出现安装图标，或者在菜单中高亮显示「安装应用」选项。
