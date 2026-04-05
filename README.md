# Recommendation Agent Frontend

文学推荐 App 的移动端 Web 前端（React + Vite）。用户在这里与文学沙龙主理人对话，发现作家，约定阅读时间，最终将书目传递给实体阅读器设备。

---

## 界面流程

```
首页 / 作家列表
    ↓
与推荐 Agent 对话 → 推荐某位作家
    ↓
查看作家简介
    ↓
与 Virginia Woolf 对话 → 约定阅读时间
    ↓
reader-agent 接收书目 → 实体阅读器启动时加载
```

---

## 目录结构

```
recommendation-agent-frontend/
├── src/
│   ├── pages/
│   │   ├── Home.jsx        # 首页：朋友圈动态 + 导航
│   │   ├── Chat.jsx        # 对话界面（推荐 Agent + Woolf）
│   │   └── AgentDetail.jsx # 作家详情页
│   ├── components/
│   │   └── Avatar.jsx      # 头像组件
│   ├── api/
│   │   ├── client.js       # Axios 实例（指向 /api/*）
│   │   └── chat.js         # 流式对话函数（streamChat / woolfChat）
│   └── store/
│       └── user.jsx        # 用户 ID 管理（sessionStorage）
├── vite.config.js          # 代理配置
└── package.json
```

---

## 快速开始（新电脑）

### 前置条件

- Node.js 18+
- recommendation-agent-backend 已在 `localhost:8000` 运行
- reader-agent 已在 `localhost:8001` 运行（Woolf 对话和书目同步需要）

### 安装与启动

```bash
cd recommendation-agent-frontend

npm install
npm run dev
```

打开 `http://localhost:3000`

---

## 代理配置

`vite.config.js` 中定义了两个代理：

```js
proxy: {
  '/api': {
    target: 'http://localhost:8000',   // recommendation-agent-backend
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
  '/mobile': {
    target: 'http://localhost:8001',   // reader-agent（Woolf 对话 + 书目同步）
  },
}
```

**修改后端地址**：
- 推荐后端换地址 → 修改 `/api` 的 `target`
- reader-agent 换地址 → 修改 `/mobile` 的 `target`

生产部署时将代理替换为 Nginx 反向代理或直接修改 `src/api/client.js` 中的 `baseURL`。

---

## Woolf 对话与书目同步原理

1. 用户与 Woolf 对话时，前端检测回复里是否出现书名（`《》` 包裹或英文书名）
2. 检测到书名 → 显示"📅 和伍尔夫约一个阅读时间"按钮
3. 确认时间后，前端自动调用 `/mobile/set_book` 将书目写入 reader-agent
4. reader-agent 前端启动时调用 `/mobile/scheduled_book` 读取书目

书名 → slug 映射在 `src/pages/Chat.jsx` 的 `extractBookSlug` 函数中，如需添加新书在此扩展。

---

## 修改作家路由

- Woolf 走 reader-agent（`/mobile/*`），其他作家走 recommendation-agent-backend（`/api/*`）
- 路由逻辑在 `Chat.jsx` 的 `IS_WOOLF` 函数
- 新增需要走独立 agent 的作家，参照 `IS_WOOLF` 模式扩展即可

---

## 生产构建

```bash
npm run build
# 产物在 dist/，可部署到任意静态托管（Nginx、Vercel、Netlify 等）
# 注意：生产环境需将 vite proxy 替换为服务器端反向代理
```
