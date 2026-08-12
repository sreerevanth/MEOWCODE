import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { authRoutes } from "./routes/auth.js";
import { chatRoutes } from "./routes/chats.js";
import { healthRoutes } from "./routes/health.js";
import { modelRoutes } from "./routes/models.js";
import { providerRoutes } from "./routes/providers.js";
import { providerService } from "./services/providerService.js";
import { uploadRoutes } from "./routes/uploads.js";
import { usageRoutes } from "./routes/usage.js";
import { workspaceRoutes } from "./routes/workspaces.js";
const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(rateLimit, { max: 600, timeWindow: "1 minute" });
await app.register(multipart, {
    limits: {
        fileSize: 25 * 1024 * 1024
    }
});
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(workspaceRoutes);
await app.register(providerRoutes);
await app.register(modelRoutes);
await app.register(chatRoutes);
await app.register(usageRoutes);
await app.register(uploadRoutes);
const port = Number(process.env.PORT ?? 4000);
setInterval(() => {
    void providerService.runPeriodicHealthChecks().catch(() => { });
}, 5 * 60 * 1000);
await app.listen({ port, host: "0.0.0.0" });
