import express from "express";
import cors from "cors";
import helmet from "helmet";
import { adminsRouter } from "./routes/admins.js";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { groupsRouter } from "./routes/groups.js";
import { membersRouter } from "./routes/members.js";
import { listsRouter } from "./routes/lists.js";
import { notificationsRouter } from "./routes/notifications.js";
import { operationsRouter } from "./routes/operations.js";
import { welcomeRouter } from "./routes/welcome.js";
import { announcementsRouter } from "./routes/announcements.js";
import { autoRepliesRouter } from "./routes/autoReplies.js";
import { checkinsRouter } from "./routes/checkins.js";
import { missionsRouter } from "./routes/missions.js";
import { lotteriesRouter } from "./routes/lotteries.js";
import { rankingsRouter } from "./routes/rankings.js";
import { settingsRouter } from "./routes/settings.js";
import { violationsRouter } from "./routes/violations.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { errorHandler, notFound } from "./middleware/error.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));

  app.get("/", (req, res) => {
    res.json({
      ok: true,
      service: "line-group-manager-api",
      health: "/health",
      webhook: "/api/webhooks/line"
    });
  });

  app.get("/health", (req, res) => {
    res.json({ ok: true, service: "line-group-manager-api" });
  });

  app.use("/api/webhooks", webhooksRouter);
  app.use(express.json({ limit: "2mb" }));

  app.use("/api/auth", authRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/groups", groupsRouter);
  app.use("/api/members", membersRouter);
  app.use("/api/admins", adminsRouter);
  app.use("/api/lists", listsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/operation-logs", operationsRouter);
  app.use("/api/welcome", welcomeRouter);
  app.use("/api/announcements", announcementsRouter);
  app.use("/api/auto-replies", autoRepliesRouter);
  app.use("/api/checkins", checkinsRouter);
  app.use("/api/missions", missionsRouter);
  app.use("/api/lotteries", lotteriesRouter);
  app.use("/api/rankings", rankingsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/violations", violationsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
