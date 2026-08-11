import type { FastifyInstance } from "fastify";
import { nowIso } from "@meowcode/shared";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    ok: true,
    service: "meow-api",
    timestamp: nowIso()
  }));
}
