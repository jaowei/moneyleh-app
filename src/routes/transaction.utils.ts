import { appLogger } from ".."
import type { DocumentToAdd } from "../lib/descriptionTagger/base-classifier"
import WorkerPool from "../lib/descriptionTagger/classifier-trainer-worker-pool"

export const runTrainer = (documentsToAdd: DocumentToAdd[], transactionIds: number[], logInfo: {
    transactionsInserted: number
    userId: string
}) => {
    const pool = new WorkerPool(1)

    pool.runTask({ documentsToAdd }, async (err) => {
        if (err) {
            appLogger(`Training failed for user ${logInfo.userId}, ${logInfo.transactionsInserted} transactions to be trained, 
                please look for json file in root, for transactions to train`)
            await Bun.write(`./${new Date().toISOString()}_${logInfo.userId}_failed_training.json`, JSON.stringify(transactionIds))
        }
        pool.close()
    })

}