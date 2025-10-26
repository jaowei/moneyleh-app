import {describe, expect, test} from "bun:test";
import app from "../index.ts";

describe('/api/transaction', () => {
    describe('create', () => {
        test('file upload', async () => {
            const formData = new FormData()
            // const testFile = Bun.file('./src/lib/test-files/sample.pdf')
            const testFile = Bun.file('./test-files/dbsCard.pdf')
            formData.append('file', testFile)
            formData.append('userId', 'testUser1Id')
            const res = await app.request("/api/transaction/fileUpload", {
                method: "POST",
                body: formData
            });
            expect(res.status).toBe(200);
            expect(await res.text()).toInclude('processed')
        })
    })
})