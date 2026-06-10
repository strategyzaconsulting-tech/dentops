import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import cron from "node-cron";
import { healthRoutes } from "./routes/health.js";
import setupRoutes from "./routes/setup.js";
import timeclockRoutes from "./routes/timeClock.js";
import ptoRoutes from "./routes/pto.js";
import staffRoutes from "./routes/staff.js";
import shiftsRoutes from "./routes/shifts.js";
import userRoutes from "./routes/users.js"
import practiceRoutes from "./routes/practice.js"
import clockAdjustmentRoutes from "./routes/clockAdjustments.js";
import openShiftRoutes from "./routes/openShifts.js";
import announcementRoutes from "./routes/announcements.js";
import benefitRoutes from "./routes/benefits.js";
import onboardingRoutes from "./routes/onboarding.js";
import w4ReviewRoutes from "./routes/w4Review.js";
import occurrenceRoutes from "./routes/occurrences.js";
import reportRoutes from "./routes/reports.js";
import { sendExpoPushNotifications } from "./lib/expoPush.js";
import { prisma } from "./lib/prisma.js";

export async function createServer() {
  const server = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  });

  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
  await server.register(fastifyCors, {
    origin: corsOrigin === "*" ? true : corsOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await server.register(fastifySwagger, {
    openapi: {
      openapi: "3.0.0",
      info: {
        title: "DentOps API",
        description: "Multi-tenant dental practice HR SaaS API",
        version: "1.0.0",
      },
      servers: [{ url: `http://localhost:${process.env.PORT ?? 3000}`, description: "Development" }],
      tags: [{ name: "health", description: "Health check" }],
    },
  });

  await server.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: { deepLinking: false },
  });

  await server.register(healthRoutes, { prefix: "/api" });
  await server.register(setupRoutes, { prefix: "/api" });
  await server.register(timeclockRoutes, { prefix: "/api" });
  await server.register(ptoRoutes, { prefix: "/api" });
  await server.register(staffRoutes, { prefix: "/api" });
  await server.register(shiftsRoutes, { prefix: "/api" });
  await server.register(userRoutes, { prefix: "/api" });
  await server.register(practiceRoutes, { prefix: "/api" });
  await server.register(clockAdjustmentRoutes, { prefix: "/api" });
  await server.register(openShiftRoutes, { prefix: "/api" });
  await server.register(announcementRoutes, { prefix: "/api" });
  await server.register(benefitRoutes, { prefix: "/api" });
  await server.register(onboardingRoutes, { prefix: "/api" });
  await server.register(w4ReviewRoutes, { prefix: "/api" });
  await server.register(occurrenceRoutes, { prefix: "/api" });
  await server.register(reportRoutes, { prefix: "/api" });

  // Jan 1 at midnight — create review records + notify all active staff
  cron.schedule("0 0 1 1 *", async () => {
    const year = new Date().getFullYear();
    try {
      const users = await prisma.user.findMany({
        where: { status: "active" },
        select: { id: true, practiceId: true, pushToken: true },
      });

      // Upsert a pending review record for each user
      await Promise.all(
        users.map((u) =>
          prisma.w4AnnualReview.upsert({
            where: { userId_year: { userId: u.id, year } },
            create: { practiceId: u.practiceId, userId: u.id, year },
            update: {},
          })
        )
      );

      // Send push notifications to users with tokens
      const tokens = users.map((u) => u.pushToken).filter(Boolean) as string[];
      await sendExpoPushNotifications(
        tokens,
        "Annual W-4 Review Required",
        "Please review your W-4 withholding in the DentOps app. Federal law requires annual review.",
        { screen: "w4-review" }
      );

      server.log.info(`W-4 annual review triggered for ${users.length} users (year ${year})`);
    } catch (err) {
      server.log.error({ err }, "W-4 annual review cron failed");
    }
  });

  return server;
}
