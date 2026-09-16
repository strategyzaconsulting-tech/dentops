import { defineRailway, project, service } from "railway/iac";

// Last resort for a per-service CaC repo. Prefer one .railway file for the
// project and drop this if you later combine services into that file.
export const partial = "dentops";

export default defineRailway(() => {
  const dentops = service("dentops", {
    build: "pnpm install --frozen-lockfile && cd apps/api && npx prisma generate && echo 'build-ok'",
    start: "cd apps/api && npx tsx src/index.ts",
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    // builder from CaC: "nixpacks"
  });
  return project("fabulous-respect", {
    resources: [dentops],
  });
});
