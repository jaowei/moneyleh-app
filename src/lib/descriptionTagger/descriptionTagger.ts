import {WordTokenizer, LogisticRegressionClassifier} from "natural";
import {db} from "../../db/db.ts";
import {tags, type TransactionsInsertSchema} from "../../db/schema.ts";
import {like} from "drizzle-orm";
import {appLogger} from "../../index.ts";

export type DocumentToAdd = {
    description: string,
    tag: string
}
export const testClassifierPath = 'classifier-test.json'
const classifierDataFilePath = process.env.NODE_ENV === 'production' ? 'classifier.json' : testClassifierPath

export const initClassifier = async (initialDataPath = classifierDataFilePath) => {
    const initData = Bun.file(initialDataPath)
    if (!(await initData.exists())) {
        const c = new LogisticRegressionClassifier()
        await Bun.write(initialDataPath, JSON.stringify(c))
        return c
    } else {
        const data = await initData.json()
        return LogisticRegressionClassifier.restore(data)
    }
}

export const addDocuments = (classifier: LogisticRegressionClassifier, targetDoc: DocumentToAdd) => {
    const res = tokeniseWord(targetDoc.description)
    classifier.addDocument(res, targetDoc.tag)
}

export const saveAndTrainClassifier = async (classifier: LogisticRegressionClassifier, filePath = classifierDataFilePath) => {
    classifier.train()
    const serialised = JSON.stringify(classifier)
    await Bun.write(filePath, serialised)
}

const tokeniseWord = (word: string) => {
    const tokeniser = new WordTokenizer()
    return tokeniser.tokenize(word)
}

export interface TaggedTransaction extends TransactionsInsertSchema {
    tags?: {
        id: number;
        description: string;
    }[]
}

export const tagTransactions = async (classifier: LogisticRegressionClassifier | undefined, transactions: TransactionsInsertSchema[]) => {
    const c = classifier || await initClassifier()
    const classificationThreshold = 0.75

    const tagged: TaggedTransaction[] = []
    for (const t of transactions) {
        if (t.description && c.docs.length) {
            try {
                const res = tokeniseWord(t.description)

                const classificationRes = c.getClassifications(res)

                if (!classificationRes.length) {
                    tagged.push(t)
                }

                const filteredRes = classificationRes.filter((result) => result.value > classificationThreshold).sort((a, b) => {
                    // descending order
                    return b.value - a.value
                })

                // skip if inference confidence is lower than threshold
                if (!filteredRes[0]) {
                    tagged.push(t)
                    continue
                }
                console.log(filteredRes[0])

                // TODO: We only return the top result for now, see if there is a use case to return top X results
                const queryRes = await db.select({
                    id: tags.id,
                    description: tags.description
                }).from(tags).where(like(tags.description, filteredRes[0].label))

                if (!queryRes[0]) {
                    tagged.push(t)
                    continue
                }

                tagged.push({
                    ...t,
                    tags: [queryRes[0]],
                })
            } catch (e) {
                appLogger(`WARN: There was an error tagging for description: ${t.description} - ${e}`)
                tagged.push(t)
            }
        } else {
            tagged.push(t)
        }
    }
    return tagged
}

