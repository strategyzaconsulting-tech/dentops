import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import cron from "node-cron";
import { healthRoutes } from "./routes/health.js";
import setupRoutes from "./routes/setup.js";
import authRoutes from "./routes/auth.js";
import timeclockRoutes from "./routes/timeClock.js";
import ptoRoutes from "./routes/pto.js";
import staffRoutes from "./routes/staff.js";
import shiftsRoutes from "./routes/shifts.js";
import userRoutes from "./routes/users.js";
import practiceRoutes from "./routes/practice.js";
import clockAdjustmentRoutes from "./routes/clockAdjustments.js";
import openShiftRoutes from "./routes/openShifts.js";
import announcementRoutes from "./routes/announcements.js";
import benefitRoutes from "./routes/benefits.js";
import onboardingRoutes from "./routes/onboarding.js";
import w4ReviewRoutes from "./routes/w4Review.js";
import occurrenceRoutes from "./routes/occurrences.js";
import reportRoutes from "./routes/reports.js";
import licenseRoutes from "./routes/licenses.js";
import adminRoutes from "./routes/admin.js";
import { requireAuth } from "./lib/auth.js";
import { sendExpoPushNotifications } from "./lib/expoPush.js";
import { prisma } from "./lib/prisma.js";

const isDev = process.env.NODE_ENV !== "production";

export async function createServer() {
  const server = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  });

  // Security headers
  await server.register(fastifyHelmet, {
    contentSecurityPolicy: false, // disabled for API-only server
  });

  // Rate limiting — 200 req/min per IP globally
  await server.register(fastifyRateLimit, {
    max: 200,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({ error: "Too many requests, slow down." }),
  });

  // CORS — only allow configured origin(s)
  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
  await server.register(fastifyCors, {
    origin: corsOrigin.split(",").map((s) => s.trim()),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });

  // JWT
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error("JWT_SECRET env var is required");
  await server.register(fastifyJwt, { secret: jwtSecret });

  // Swagger — dev only
  if (isDev) {
    await server.register(fastifySwagger, {
      openapi: {
        openapi: "3.0.0",
        info: { title: "DentOps API", description: "Multi-tenant dental practice HR SaaS API", version: "1.0.0" },
        servers: [{ url: `http://localhost:${process.env.PORT ?? 3000}`, description: "Development" }],
        components: {
          securitySchemes: {
            bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    });
    await server.register(fastifySwaggerUi, {
      routePrefix: "/docs",
      uiConfig: { deepLinking: false },
    });
  }

  // Global auth hook — enforces JWT on all routes except public ones
  server.addHook("preHandler", requireAuth);

  // Public routes (no auth required)
  await server.register(healthRoutes, { prefix: "/api" });
  await server.register(authRoutes, { prefix: "/api" });
  await server.register(setupRoutes, { prefix: "/api" });

  // Protected routes
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
  await server.register(licenseRoutes, { prefix: "/api" });
  await server.register(adminRoutes, { prefix: "/api" });

  // Jan 1 at midnight — create review records + notify all active staff
  cron.schedule("0 0 1 1 *", async () => {
    const year = new Date().getFullYear();
    try {
      const users = await prisma.user.findMany({
        where: { status: "active", practiceId: { not: null } },
        select: { id: true, practiceId: true, pushToken: true },
      });

      await Promise.all(
        users.map((u) =>
          prisma.w4AnnualReview.upsert({
            where: { userId_year: { userId: u.id, year } },
            create: { practiceId: u.practiceId, userId: u.id, year },
            update: {},
          })
        )
      );

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
