import '@tensorflow/tfjs-node'
import * as tf from '@tensorflow/tfjs-node'
import * as encoderModel from '@tensorflow-models/universal-sentence-encoder'
import * as knnClassifier from '@tensorflow-models/knn-classifier'
import type { DocumentToAdd } from './base-classifier'

type KnnClassifierDataFormat = [string, number[], [number, number]]

export class KnnClassifier {
    instance
    encoder: encoderModel.UniversalSentenceEncoder | undefined
    constructor() {
        this.instance = knnClassifier.create()
    }

    public async init() {
        this.encoder = await encoderModel.load()
    }

    public async save(filePath: string) {
        const data = this.instance.getClassifierDataset()
        const transformedData = Object.entries(data).map(([label, data]): KnnClassifierDataFormat => [label, Array.from(data.dataSync()), data.shape])
        await Bun.write(filePath, JSON.stringify(transformedData))
    }

    private async encode(targetDoc: string) {
        if (!this.encoder) throw new Error('Please call init on the classifier')
        return await this.encoder.embed(targetDoc)
    }

    public async addDocument(doc: DocumentToAdd) {
        const encoded = await this.encode(doc.description)
        this.instance.addExample(encoded, doc.tag)
    }

    public async restore(filePath: string) {
        const fileData = Bun.file(filePath)
        if (await fileData.exists()) {
            const unloaded = await fileData.json() as KnnClassifierDataFormat[]
            const restored = Object.fromEntries(unloaded.map(([label, data, shape]) => [label, tf.tensor2d(data, shape)]))
            this.instance.setClassifierDataset(restored)
        }
    }

    public async predict(targetString: string) {
        const encoded = await this.encode(targetString)
        return await this.instance.predictClass(encoded)
    }
}