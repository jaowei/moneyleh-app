import { parentPort } from 'node:worker_threads'
import { addDocuments, type DocumentToAdd, initClassifier, saveAndTrainClassifier } from "./descriptionTagger.ts";
import { appLogger } from '../../index.ts';

export type WorkerTaskObj = {
    workerIdx?: number;
    documentsToAdd: DocumentToAdd[]
}

parentPort?.on('message', async (task: WorkerTaskObj) => {
    const { workerIdx = 1 } = task
    appLogger(`${workerIdx}-initialising classifier`)
    const c = await initClassifier()
    appLogger(`${workerIdx}-classifier initialised`)

    appLogger(`${workerIdx}-adding ${task.documentsToAdd.length} docs`)
    for (const doc of task.documentsToAdd) {
        addDocuments(c, doc)
    }
    appLogger(`${workerIdx}-docs added`)

    appLogger(`${workerIdx}-training...`)
    await saveAndTrainClassifier(c)
    appLogger(`${workerIdx}-done training and saved`)

    parentPort?.postMessage('training complete')
})