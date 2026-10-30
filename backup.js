import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const bucket = process.env.BACKUP_BUCKET?.trim();
const prefix = (process.env.BACKUP_PREFIX || "backups").replace(/\/+$/, "");
const latestKey = `${prefix}/site-latest.db`;
const client = bucket ? new S3Client({}) : null;

export const backupsEnabled = Boolean(client);

// Se o servidor subir sem banco (instância nova na AWS), baixa o último backup do S3.
// Qualquer erro que não seja "backup inexistente" impede a inicialização: subir com um banco
// vazio faria o próximo backup sobrescrever os dados bons.
export async function restoreIfMissing(file) {
  if (!client || existsSync(file)) return;
  try {
    const { Body } = await client.send(new GetObjectCommand({ Bucket: bucket, Key: latestKey }));
    await writeFile(file, await Body.transformToByteArray());
    console.log(`Banco restaurado de s3://${bucket}/${latestKey}.`);
  } catch (error) {
    if (error.name !== "NoSuchKey") {
      console.error(`Não foi possível ler o backup em s3://${bucket}/${latestKey}. Confira o bucket e a permissão do servidor.`);
      throw error;
    }
    console.log("Nenhum backup encontrado no S3; um banco novo será criado.");
  }
}

// Cópia consistente do banco, segura mesmo com o servidor gravando ao mesmo tempo.
export async function snapshot(db) {
  const file = join(tmpdir(), `fa-gu-${randomUUID()}.db`);
  db.prepare("VACUUM INTO ?").run(file);
  try {
    return await readFile(file);
  } finally {
    await rm(file, { force: true });
  }
}

let lastBackedUpChanges = -1;

export async function backupToS3(db, { force = false } = {}) {
  if (!client) return false;
  const { changes } = db.prepare("SELECT total_changes() AS changes").get();
  if (!force && changes === lastBackedUpChanges) return false;

  const body = await snapshot(db);
  const day = new Date().toISOString().slice(0, 10);
  for (const key of [latestKey, `${prefix}/daily/site-${day}.db`]) {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ServerSideEncryption: "AES256" }));
  }
  lastBackedUpChanges = changes;
  return true;
}
