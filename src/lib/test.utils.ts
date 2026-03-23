import { expect } from "bun:test";
import { extendedDayjs } from "./dayjs.ts";
import type { TransactionsInsertSchema } from "../db/schema.ts";

export const jsonHeader = {
    headers: new Headers({ "Content-Type": "application/json" }),
};

export const testATransaction = (t: TransactionsInsertSchema) => {
    expect(extendedDayjs(t.transactionDate).isValid()).toBe(true)
    expect(t.description).toBeString()
    expect(t.amount).toBeNumber()
    expect(t.currency).toBeString()
    expect(t.currency).toHaveLength(3)
}

export const testUser = {
    id: 'testUser1Id',
    name: 'testUser1',
    email: 'testUser1@test.com',
    password: 'testUser1pw',
}

export const testTag = {
    description: 'test-tag'
}

export const getFile = async (path: string): Promise<File> => {
    const file = Bun.file(path)
    const buf = await file.arrayBuffer()
    return new File([buf], 'file')
}