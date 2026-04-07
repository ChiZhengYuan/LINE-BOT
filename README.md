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

## AI Settings

AI is optional. If you want a no-AI deployment, keep these values as-is:

```env
AI_PROVIDER="heuristic"
AI_API_KEY=""
```

If you want Gemini later, use these values:

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

## New Modules Added

The project now extends the existing LINE Group Manager architecture with the following modules:

### Group Settings Center

- Group-level switches for:
  - auto enforcement
  - AI moderation
  - blacklist filtering
  - spam detection
  - welcome message
  - scheduled announcements
  - keyword auto-reply
  - lottery
  - missions
  - daily check-ins
  - rankings
- Per-group thresholds for violation score and spam detection
- Operation logging for every settings change

### Members

- Member list and detail pages
- Search, filter, sort, and pagination
- Manual blacklist / whitelist toggle
- Notes per member

### Operation Logs

- Track login, moderation actions, settings changes, announcements, lotteries, missions, auto-replies, and check-ins
- Filter by time, admin, group, and event type

### Notifications

- In-app notification center
- Unread badge in the top bar
- Mark as read / mark all as read
- Types include violations, new members, high risk alerts, announcements, lottery results, mission due, system errors, and welcome events

### Welcome Settings

- Welcome message and group rules message
- Optional Flex Message template
- Automatic sending when a member joins

### Announcements

- One-time, daily, weekly, and monthly scheduled announcements
- Target one or more groups
- Preview, edit, delete, and send now

### Auto Reply Rules

- Exact match, contains match, and regex match
- Text or Flex response
- Cooldown support
- Hit count tracking

### Community Interaction

- Daily check-ins
- Missions
- Lotteries
- Rankings based on active score

## Important Notes

- The frontend is mobile-friendly and uses the same visual style as the existing dashboard, violations, lists, and AI pages.
- All new modules persist to PostgreSQL through Prisma.
- The backend uses service and route layers, with Zod validation on the new endpoints.
- Notifications can be surfaced in LINE, Telegram, and the in-app notification center.
- If you are using Render, the API service will run `prisma db push` before startup so the schema stays synchronized.

## New API Routes

- `GET /api/members`
- `GET /api/members/:memberId`
- `POST /api/members`
- `PATCH /api/members/:memberId`
- `GET /api/operation-logs`
- `GET /api/notifications`
- `GET /api/notifications/unread-count`
- `POST /api/notifications/:notificationId/read`
- `POST /api/notifications/read-all`
- `GET /api/welcome/groups/:groupId`
- `PUT /api/welcome/groups/:groupId`
- `GET /api/announcements`
- `POST /api/announcements`
- `GET /api/announcements/:announcementId`
- `PATCH /api/announcements/:announcementId`
- `DELETE /api/announcements/:announcementId`
- `POST /api/announcements/:announcementId/send`
- `GET /api/auto-replies`
- `GET /api/auto-replies/groups/:groupId`
- `POST /api/auto-replies`
- `PATCH /api/auto-replies/:ruleId`
- `DELETE /api/auto-replies/:ruleId`
- `GET /api/checkins`
- `POST /api/checkins`
- `GET /api/missions`
- `POST /api/missions`
- `PATCH /api/missions/:missionId`
- `DELETE /api/missions/:missionId`
- `POST /api/missions/:missionId/progress`
- `GET /api/lotteries`
- `POST /api/lotteries`
- `PATCH /api/lotteries/:lotteryId`
- `DELETE /api/lotteries/:lotteryId`
- `POST /api/lotteries/:lotteryId/enter`
- `POST /api/lotteries/:lotteryId/draw`
- `GET /api/rankings`
- `GET /api/dashboard/overview`

## Prisma Models Added

- `GroupSetting`
- `Member`
- `MemberStats`
- `OperationLog`
- `Notification`
- `WelcomeSetting`
- `Announcement`
- `AnnouncementJob`
- `AutoReplyRule`
- `Checkin`
- `Mission`
- `MissionProgress`
- `Lottery`
- `LotteryEntry`
- `LotteryWinner`
- `Ranking`

## Migration / Sync

To sync the schema locally:

```bash
npm run prisma:validate --workspace @line-group-manager/api
npm run prisma:generate --workspace @line-group-manager/api
npm run prisma:push --workspace @line-group-manager/api
```

If your local `DATABASE_URL` points to a remote Render database, `prisma db push` may fail from your PC because the database host is not reachable from your local network. In that case, run the push from the deployed environment or use an accessible database connection string.
