import { db } from "../../db/db";
import { eq } from 'drizzle-orm'
import { tags, transactions, transactionTags } from "../../db/schema";
import { BaseClassifier } from "./base-classifier";

export const getTrainingData = async () => {
    const query = await db.select({
        txnId: transactions.id,
        desc: transactions.description,
        tagName: tags.description
    }).from(transactionTags)
        .leftJoin(transactions, eq(transactions.id, transactionTags.transactionId))
        .leftJoin(tags, eq(tags.id, transactionTags.tagId))

    const txnToLabelMap = new Map<number, [string, string[]]>()
    const uniqueTags = new Set<string>()
    for (const result of query) {
        const { txnId, tagName, desc } = result
        if (!txnId || !tagName || !desc) continue
        const existing = txnToLabelMap.get(txnId)
        if (existing) {
            txnToLabelMap.set(txnId, [existing[0], existing[1].concat(tagName)])
        } else {
            txnToLabelMap.set(txnId, [desc, [tagName]])
        }

        uniqueTags.add(tagName)
    }

    const csvDataArr = [['description', 'labels']]
    for (const data of txnToLabelMap.values()) {
        csvDataArr.push([data[0].replace(',', ' '), data[1].join('_')])
    }
    const csvData = csvDataArr.map((data) => data.join(',')).join('\n')
    const allLabels = Array.from(uniqueTags).join('\n')

    await Bun.write('label.txt', allLabels)
    await Bun.write('training-data.csv', csvData)
}

const debugClassifier = async () => {
    const defaultBayes = new BaseClassifier('default-bayes')
    await defaultBayes.init()
    if (defaultBayes.classifierInstance.type === 'default-bayes') {
        const res = Object.entries(defaultBayes.classifierInstance.classifier.wordFrequencyCount).find(([label]) => label === 'subscription')
        // console.log(res)
        const pred = await defaultBayes.predict('SPOTIFY P3E5A84CAF STOCKHOLM SWE')
        // console.log(pred.sort((a, b) => b.value - a.value).slice(0, 10))
    }
}
debugClassifier()