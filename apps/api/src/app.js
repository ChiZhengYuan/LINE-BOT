import express from "express";
import cors from "cors";
import helmet from "helmet";
import { adminsRouter } from "./routes/admins.js";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { groupsRouter } from "./routes/groups.js";
import { listsRouter } from "./routes/lists.js";
import { violationsRouter } from "./routes/violations.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { errorHandler, notFound } from "./middleware/error.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));

  app.get("/health", (req, res) => {
    res.json({ ok: true, service: "line-group-manager-api" });
  });

  app.use("/api/webhooks", webhooksRouter);
  app.use(express.json({ limit: "2mb" }));

  app.use("/api/auth", authRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/groups", groupsRouter);
  app.use("/api/admins", adminsRouter);
  app.use("/api/lists", listsRouter);
  app.use("/api/violations", violationsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
