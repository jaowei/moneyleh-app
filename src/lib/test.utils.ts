import {expect} from "bun:test";
import {extendedDayjs} from "./dayjs.ts";
import type {TransactionsInsertSchema} from "../db/schema.ts";

export const jsonHeader = {
    headers: new Headers({"Content-Type": "application/json"}),
};

export const testATransaction = (t: TransactionsInsertSchema) => {
    expect(extendedDayjs(t.transactionDate).isValid()).toBe(true)
    expect(t.description).toBeString()
    expect(t.amount).toBeNumber()
}

export const testUser = {
    id: 'testUser1Id',
    name: 'testUser1',
    email: 'testUser1@test.com'
}

export const testTag = {
    description: 'test-tag'
}