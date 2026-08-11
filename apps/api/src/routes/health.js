import { nowIso } from "@meowcode/shared";
export async function healthRoutes(app) {
    app.get("/health", async () => ({
        ok: true,
        service: "meow-api",
        timestamp: nowIso()
    }));
}
