import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";

const sqlite = new Database(process.env.DATABASE_NAME);
export const db = drizzle(sqlite);
