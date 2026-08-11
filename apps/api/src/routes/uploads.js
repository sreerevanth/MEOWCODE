import { createWriteStream, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { randomBytes } from "node:crypto";
import { prisma } from "@meowcode/database";
import { requireAuth } from "./auth.js";
const uploadRoot = process.env.MEOW_UPLOAD_DIR ?? join(process.cwd(), ".uploads");
export async function uploadRoutes(app) {
    app.post("/v1/uploads", async (request, reply) => {
        const principal = await requireAuth(request, reply);
        if (!principal)
            return;
        const workspaceId = request.query.workspaceId || principal.workspaceId;
        if (!workspaceId)
            return reply.status(400).send({ error: "No workspace selected" });
        const membership = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: principal.userId, workspaceId } }
        });
        if (!membership)
            return reply.status(403).send({ error: "Forbidden" });
        const data = await request.file();
        if (!data)
            return reply.status(400).send({ error: "file is required" });
        if (!existsSync(uploadRoot))
            mkdirSync(uploadRoot, { recursive: true });
        const workspaceDir = join(uploadRoot, workspaceId);
        if (!existsSync(workspaceDir))
            mkdirSync(workspaceDir, { recursive: true });
        const safeName = data.filename.replace(/[^\w.\-]+/g, "_");
        const storedName = `${Date.now()}_${randomBytes(6).toString("hex")}_${safeName}`;
        const storagePath = join(workspaceDir, storedName);
        await pipeline(data.file, createWriteStream(storagePath));
        const statSize = data.file.bytesRead || 0;
        const upload = await prisma.upload.create({
            data: {
                workspaceId,
                userId: principal.userId,
                filename: data.filename,
                mimeType: data.mimetype,
                sizeBytes: statSize,
                storagePath
            }
        });
        return reply.status(201).send({
            id: upload.id,
            filename: upload.filename,
            mimeType: upload.mimeType,
            sizeBytes: upload.sizeBytes,
            createdAt: upload.createdAt.toISOString()
        });
    });
    app.get("/v1/uploads", async (request, reply) => {
        const principal = await requireAuth(request, reply);
        if (!principal)
            return;
        const workspaceId = request.query.workspaceId || principal.workspaceId;
        if (!workspaceId)
            return reply.status(400).send({ error: "No workspace selected" });
        const membership = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: principal.userId, workspaceId } }
        });
        if (!membership)
            return reply.status(403).send({ error: "Forbidden" });
        const uploads = await prisma.upload.findMany({
            where: { workspaceId },
            orderBy: { createdAt: "desc" },
            take: 100
        });
        return uploads.map((u) => ({
            id: u.id,
            filename: u.filename,
            mimeType: u.mimeType,
            sizeBytes: u.sizeBytes,
            createdAt: u.createdAt.toISOString()
        }));
    });
}
