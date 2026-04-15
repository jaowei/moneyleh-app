import { db } from "../../db/db.ts";
import { tags, type TransactionsInsertSchema } from "../../db/schema.ts";
import { like } from "drizzle-orm";
import { appLogger } from "../../index.ts";
import { BaseClassifier } from "./base-classifier.ts";

export interface TaggedTransaction extends TransactionsInsertSchema {
    tags: {
        id: number;
        description: string;
    }[]
}

export const tagTransactions = async (transactions: TransactionsInsertSchema[]) => {
    const c = new BaseClassifier('default-bayes')
    await c.init()

    const tagged: TaggedTransaction[] = []
    for (const t of transactions) {
        const emptyTransaction = {
            ...t,
            tags: []
        }
        if (t.description && c.isValid()) {
            try {
                const classificationRes = await c.predict(t.description)

                if (!classificationRes.length) {
                    tagged.push(emptyTransaction)
                }

                const sortedRes = classificationRes.sort((a, b) => {
                    // descending order
                    return b.value - a.value
                }).slice(0, 2)

                const foundTags = []
                for (const prediction of sortedRes) {
                    const queryRes = await db.select({
                        id: tags.id,
                        description: tags.description
                    }).from(tags).where(like(tags.description, prediction.label))
                    if (!queryRes[0]) {
                        tagged.push(emptyTransaction)
                        continue
                    } else {
                        foundTags.push(queryRes[0])
                    }
                }


                if (foundTags.length) {
                    tagged.push({
                        ...t,
                        tags: foundTags,
                    })
                }
            } catch (e) {
                appLogger(`WARN: There was an error tagging for description: ${t.description} - ${e}`)
                tagged.push(emptyTransaction)
            }
        } else {
            tagged.push(emptyTransaction)
        }
    }
    return tagged
}

