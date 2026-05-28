import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (server) => {
  server.get(
    "/health",
    {
      schema: {
        description: "Health check",
        tags: ["health"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              timestamp: { type: "string" },
              uptime: { type: "number" },
            },
          },
        },
      },
    },
    async () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }),
  );
};
