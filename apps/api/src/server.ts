import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { healthRoutes } from "./routes/health.js";

export async function createServer() {
  const server = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  });

  await server.register(fastifyCors, {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
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

  return server;
}
