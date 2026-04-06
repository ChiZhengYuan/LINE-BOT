# LINE Group Manager

LINE 群組管理系統，採用官方 LINE Messaging API，可做群組訊息監控、規則攔截、AI 違規判斷、計分、後台管理與 Telegram 通知。

## Tech Stack

- Frontend: Next.js + Tailwind CSS
- Backend: Node.js + Express
- Database: PostgreSQL + Prisma
- Cache: Redis
- Auth: JWT + bcrypt
- AI: Gemini 2.5 Flash-Lite

## Core Features

- LINE webhook 接收群組訊息
- 解析 `groupId` / `userId` / `message content`
- 網址保護、邀請連結保護、黑名單詞保護、洗版偵測
- AI 違規判斷回傳 `risk_score` / `category` / `reason` / `confidence`
- 違規計分、警告、待審、待踢
- 多群組管理
- 後台登入、儀表板、違規紀錄、黑白名單、規則設定、AI 判斷紀錄
- LINE 與 Telegram 通知

## Local Setup

1. Install dependencies

```bash
npm install
```

2. Configure environment files

- `apps/api/.env`
- `apps/web/.env.local`

3. Push Prisma schema

```bash
npm run db:push
```

4. Start the app

```bash
npm run dev
```

- Frontend: `http://localhost:3000`
- API health: `http://localhost:4000/health`

## Gemini AI Settings

This project defaults to Gemini.

Recommended values:

```env
AI_PROVIDER="gemini"
AI_API_URL="https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
AI_MODEL="gemini-2.5-flash-lite"
AI_API_KEY="your-gemini-api-key"
AI_SYSTEM_PROMPT="You are a LINE group moderation classifier. Return strict JSON only with keys: risk_score, category, reason, confidence."
```

If the Gemini API call fails, the service falls back to the built-in heuristic analyzer.

## Telegram Notifications

Set these values to enable Telegram alerts:

```env
TELEGRAM_BOT_TOKEN="..."
TELEGRAM_CHAT_IDS="123456789,-1001234567890"
```

## Render Deployment

Recommended production setup:

- API: Render Web Service
- PostgreSQL: Render PostgreSQL
- Frontend: Render Web Service

The repo includes `render.yaml` for Blueprint deployment.

Important:

- Render free web services can sleep after inactivity.
- For always-on LINE webhook processing, use a paid plan.

## LINE Webhook URL

Set your LINE Developers webhook to:

```text
https://your-domain/api/webhooks/line
```

## Default Admin

The seed script creates an admin account from:

- `DEFAULT_ADMIN_EMAIL`
- `DEFAULT_ADMIN_PASSWORD`

Run:

```bash
npm run seed
```

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

## Environment Variables

API:

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

Frontend:

- `NEXT_PUBLIC_API_BASE_URL`

