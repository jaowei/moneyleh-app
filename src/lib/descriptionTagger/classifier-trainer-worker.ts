import { parentPort } from 'node:worker_threads'
import { addDocuments, type DocumentToAdd, initClassifier, saveAndTrainClassifier } from "./descriptionTagger.ts";
import { appLogger } from '../../index.ts';

export type WorkerTaskObj = {
    documentsToAdd: DocumentToAdd[]
}

parentPort?.on('message', async (task: WorkerTaskObj) => {
    appLogger('initialising classifier')
    const c = await initClassifier()
    appLogger('classifier initialised')

    appLogger(`adding ${task.documentsToAdd.length} docs`)
    for (const doc of task.documentsToAdd) {
        addDocuments(c, doc)
    }
    appLogger('docs added')

    appLogger('training...')
    await saveAndTrainClassifier(c)
    appLogger('done training and saved')

    parentPort?.postMessage('training complete')
})