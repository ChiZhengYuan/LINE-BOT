# LINE Group Manager

這是一套以官方 LINE Messaging API 為核心的群組管理系統，採用：

- Frontend: Next.js + Tailwind CSS
- Backend: Node.js + Express
- Database: PostgreSQL + Prisma
- Cache: Redis
- Auth: JWT + bcrypt

## 主要功能

- LINE webhook 接收群組訊息
- 解析 `groupId`、`userId`、`message content`
- 網址保護、邀請連結保護、黑名單詞保護、洗版偵測
- AI 違規判斷模組
- 違規計分與門檻處置
- 後台登入、儀表板、違規紀錄、黑白名單、規則設定、AI 紀錄、管理員管理
- LINE 與 Telegram 通知

## 專案結構

- `apps/api`：Express API
- `apps/web`：Next.js 後台

## 本機啟動

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

確認：

- `apps/api/.env`
- `apps/web/.env.local`

### 3. 建立資料表

```bash
npm run db:push
```

### 4. 啟動開發環境

```bash
npm run dev
```

前端：

- `http://localhost:3000`

API：

- `http://localhost:4000/health`

## API Routes

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dashboard/summary`
- `GET /api/dashboard/groups`
- `GET /api/groups`
- `POST /api/groups`
- `GET /api/groups/:groupId`
- `PATCH /api/groups/:groupId`
- `DELETE /api/groups/:groupId`
- `GET /api/groups/:groupId/rules`
- `PUT /api/groups/:groupId/rules`
- `POST /api/groups/:groupId/blacklist`
- `POST /api/groups/:groupId/whitelist`
- `GET /api/admins`
- `POST /api/admins`
- `PATCH /api/admins/:adminId`
- `DELETE /api/admins/:adminId`
- `GET /api/lists`
- `DELETE /api/lists/:kind/:id`
- `GET /api/violations`
- `GET /api/violations/export`
- `GET /api/violations/ai`
- `GET /api/violations/messages`
- `POST /api/webhooks/line`

## 環境變數

### API

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_ADMIN_USER_IDS`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_IDS`
- `AI_PROVIDER`
- `AI_API_URL`
- `AI_API_KEY`
- `AI_MODEL`
- `AI_SYSTEM_PROMPT`

### Frontend

- `NEXT_PUBLIC_API_BASE_URL`

## Telegram 通知

在 `.env` 或後台規則設定頁填入：

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_IDS`

違規進入管理員通知門檻時，系統會同時送出 LINE 與 Telegram 通知。

## 部署建議

如果要讓機器人電腦關機也持續運作，請部署到雲端。

推薦組合：

- API：Render 或 Fly.io
- PostgreSQL：Render Postgres / Fly Managed Postgres
- Redis：Upstash
- Frontend：Render / Vercel / Fly.io

### Render 部署

專案根目錄已提供 `render.yaml`。

Render 會建立：

- API web service
- PostgreSQL
- 前端 web service

注意：

- Render free web service 會在閒置後 sleep
- 要即時 webhook，建議使用 paid starter

### Fly.io 部署

API 已支援 `PORT` 環境變數，適合 Fly 的常駐機器。

部署時可設定：

- `auto_stop_machines = "off"`
- `min_machines_running = 1`

## LINE Webhook

部署完成後，把 LINE Developers 的 Webhook URL 改成你的 API 網址：

```text
https://your-domain/api/webhooks/line
```

## 初始化管理員

可執行：

```bash
npm run seed
```

會依 `.env` 裡的預設值建立初始管理員帳號。

