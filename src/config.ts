import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  BOT_TOKEN: z.string().min(20, "BOT_TOKEN 未配置"),
  BOT_USERNAME: z.string().default("JuyuCheckBot").transform(stripAt),
  CHANNEL_USERNAME: z.string().default("JUYU007").transform(stripAt),
  CHANNEL_URL: z.url().default("https://t.me/JUYU007"),
  CHANNEL_NAME: z.string().default("JUYU 聚域｜域名情报局"),
  COMMERCE_BOT_USERNAME: z.string().default("JuyuDomainBot").transform(stripAt),
  JUCHA_URL: z.url().default("https://www.jucha.com/juhe/"),
  WEBHOOK_URL: z.string().optional().transform((value) => emptyToUndefined(value)?.replace(/\/$/, "")),
  WEBHOOK_SECRET: z
    .string()
    .optional()
    .transform(emptyToUndefined)
    .pipe(z.string().min(16).max(256).regex(/^[A-Za-z0-9_-]+$/, "WEBHOOK_SECRET 只能包含字母、数字、_ 和 -").optional()),
  PORT: z.coerce.number().int().positive().default(3000),
  CHECK_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  GOOGLE_CRUX_API_KEY: z.string().optional().transform(emptyToUndefined),
  AHREFS_API_KEY: z.string().optional().transform(emptyToUndefined),
  SUPABASE_URL: z.string().optional().transform(emptyToUndefined),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().transform(emptyToUndefined),
});

function stripAt(value: string): string {
  return value.replace(/^@/, "");
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = schema.safeParse(env);
  if (!result.success) {
    const details = result.error.issues.map((issue) => issue.message).join("；");
    throw new Error(`环境配置错误：${details}`);
  }
  if (result.data.WEBHOOK_URL && !result.data.WEBHOOK_SECRET) {
    throw new Error("启用 WEBHOOK_URL 时必须配置 WEBHOOK_SECRET");
  }
  if (result.data.WEBHOOK_URL) {
    try {
      const url = new URL(result.data.WEBHOOK_URL);
      if (url.protocol !== "https:") throw new Error();
    } catch {
      throw new Error("WEBHOOK_URL 必须是有效的 HTTPS 地址");
    }
  }
  if (Boolean(result.data.SUPABASE_URL) !== Boolean(result.data.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY 必须同时配置");
  }
  return result.data;
}
