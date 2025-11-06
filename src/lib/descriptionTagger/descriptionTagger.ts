import {WordTokenizer, LogisticRegressionClassifier} from "natural";
import {db} from "../../db/db.ts";
import {tags, type TransactionsInsertSchema} from "../../db/schema.ts";
import {like} from "drizzle-orm";
import {appLogger} from "../../index.ts";
import path from 'node:path'

const classifierDataFilePath = path.resolve('../../../', import.meta.path, 'classifier.json')

export const initClassifier = async (initialDataPath = classifierDataFilePath) => {
    const initData = Bun.file(initialDataPath)
    if (!(await initData.exists())) {
        return new LogisticRegressionClassifier()
    } else {
        const data = await initData.json()
        return LogisticRegressionClassifier.restore(data)
    }
}

export const trainClassifier = (classifier: LogisticRegressionClassifier, targetDoc: {
    description: string,
    tag: string
}) => {
    const res = tokeniseWord(targetDoc.description)
    classifier.addDocument(res, targetDoc.tag)
    classifier.train()
}

export const saveClassifier = async (classifier: LogisticRegressionClassifier, filePath = classifierDataFilePath) => {
    const serialised = JSON.stringify(classifier)
    await Bun.write(filePath, serialised)
}

const tokeniseWord = (word: string) => {
    const tokeniser = new WordTokenizer()
    return tokeniser.tokenize(word)
}

export const tagTransactions = async (classifier: LogisticRegressionClassifier | undefined, transactions: TransactionsInsertSchema[]) => {
    const c = classifier || await initClassifier()
    const classificationThreshold = 0.75

    const tagged = []
    for (const t of transactions) {
        if (t.description && c.docs.length) {
            try {
                const res = tokeniseWord(t.description)

                const classificationRes = c.getClassifications(res)

                // skip if inference confidence is lower than threshold
                if (!(classificationRes.length && classificationRes[0] && classificationRes[0].value > classificationThreshold)) {
                    tagged.push(t)
                    continue
                }

                const queryRes = await db.select({
                    id: tags.id,
                    description: tags.description
                }).from(tags).where(like(tags.description, classificationRes[0].label))

                if (!queryRes.length && !queryRes[0]) {
                    tagged.push(t)
                    continue
                }

                tagged.push({
                    ...t,
                    tag: queryRes[0]
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

