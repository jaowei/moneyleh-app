import {parentPort} from 'node:worker_threads'
import {addDocuments, type DocumentToAdd, initClassifier, saveAndTrainClassifier} from "./descriptionTagger.ts";

export type WorkerTaskObj = {
    documentsToAdd: DocumentToAdd[]
}

parentPort?.on('message', async (task: WorkerTaskObj) => {
    console.log('initialising classifier')
    const c = await initClassifier()
    console.log('classifier initialised')

    console.log(`adding ${task.documentsToAdd.length} docs`)
    for (const doc of task.documentsToAdd) {
        addDocuments(c, doc)
    }
    console.log('docs added')

    console.log('training...')
    await saveAndTrainClassifier(c)
    console.log('done training and saved')

    parentPort?.postMessage('training complete')
})