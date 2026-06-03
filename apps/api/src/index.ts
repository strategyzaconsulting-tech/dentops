import { createServer } from "./server.js";

const start = async () => {
  const server = await createServer();
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "::";

  await server.listen({ port, host });
};

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
