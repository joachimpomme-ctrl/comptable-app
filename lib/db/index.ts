import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var __dbClient: ReturnType<typeof postgres> | undefined;
}

function makeClient() {
  const url = env().DATABASE_URL_POOLED ?? env().DATABASE_URL;
  return postgres(url, {
    max: 10,
    idle_timeout: 30,
    prepare: false, // safer with PgBouncer transaction pooling
  });
}

const client = global.__dbClient ?? makeClient();
if (env().NODE_ENV !== "production") {
  global.__dbClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
