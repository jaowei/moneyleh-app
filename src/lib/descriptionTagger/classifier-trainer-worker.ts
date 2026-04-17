import { parentPort } from 'node:worker_threads'
import { appLogger } from '../../index.ts';
import { BaseClassifier, type DocumentToAdd } from './base-classifier.ts';

export type WorkerTaskObj = {
    workerIdx?: number;
    documentsToAdd: DocumentToAdd[]
}

parentPort?.on('message', async (task: WorkerTaskObj) => {
    const { workerIdx = 1 } = task
    const logMsgTemplate = `Worker[${workerIdx}]`
    appLogger(`${logMsgTemplate}-initialising classifier`)
    const defaultBayesC = new BaseClassifier('default-bayes')
    const naturalBayesC = new BaseClassifier('natural-bayes')
    const knnC = new BaseClassifier('default-knn')
    await defaultBayesC.init()
    await naturalBayesC.init()
    await knnC.init()
    appLogger(`${logMsgTemplate}-classifier initialised`)

    appLogger(`${logMsgTemplate}-adding ${task.documentsToAdd.length} docs`)
    for (const doc of task.documentsToAdd) {
        await defaultBayesC.addDocument(doc)
        await naturalBayesC.addDocument(doc)
        await knnC.addDocument(doc)
    }
    appLogger(`${logMsgTemplate}-docs added`)

    appLogger(`${logMsgTemplate}-training...`)
    await defaultBayesC.saveAndTrain()
    await naturalBayesC.saveAndTrain()
    await knnC.saveAndTrain()
    appLogger(`${logMsgTemplate}-done training and saved`)

    parentPort?.postMessage(`${logMsgTemplate}-training complete`)
})