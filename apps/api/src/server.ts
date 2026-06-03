import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
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

  return server;
}
