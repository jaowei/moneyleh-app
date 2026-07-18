import { expect } from "bun:test";
import type { TransactionsInsertSchema } from "../db/schema.ts";
import { extendedDayjs } from "./dayjs.ts";
export const jsonHeader = {
	headers: new Headers({ "Content-Type": "application/json" }),
};

export const testATransaction = (t: TransactionsInsertSchema) => {
	expect(extendedDayjs(t.transactionDate).isValid()).toBe(true);
	expect(t.description).toBeString();
	expect(t.amount).toBeNumber();
	expect(t.currency).toBeString();
	expect(t.currency).toHaveLength(3);
};

export const testUser = {
	id: "testUser1Id",
	name: "testUser1",
	email: "testUser1@test.com",
	password: "testUser1pw",
	createdAt: new Date(),
	role: "admin",
};

export const testUser2 = {
	id: "testUser2Id",
	name: "testUser2",
	email: "testUser2@test.com",
	password: "testUser2pw",
	createdAt: new Date(),
	role: "admin",
};

export const getFile = async (path: string): Promise<File> => {
	const file = Bun.file(path);
	const buf = await file.arrayBuffer();
	return new File([buf], "file");
};
