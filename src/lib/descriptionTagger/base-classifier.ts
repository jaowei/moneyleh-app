import { BayesClassifier, WordTokenizer } from "natural";
import { NaiveBayesClassifier } from "./naive-bayes-classifier";
import { KnnClassifier } from "./knn-classifier";

export type DocumentToAdd = {
    description: string;
    tag: string
}
type NaturalBayesClassifier = {
    type: 'natural-bayes';
    classifier: BayesClassifier;
}
type DefaultBayesClassifier = {
    type: 'default-bayes';
    classifier: NaiveBayesClassifier
}
type DefaultKnnClassifier = {
    type: 'default-knn';
    classifier: KnnClassifier
}
type Classifier = NaturalBayesClassifier | DefaultBayesClassifier | DefaultKnnClassifier

export class BaseClassifier {
    public classifierInstance: Classifier
    public classifierDataPath: string

    constructor(classifierType: Classifier['type'] = 'default-bayes', testFileName = 'test') {
        switch (classifierType) {
            case "natural-bayes":
                this.classifierInstance = {
                    type: classifierType,
                    classifier: new BayesClassifier()
                }
                this.classifierDataPath =
                    process.env.NODE_ENV === 'production' ? 'natural-bayes-classifier.json' : `natural-bayes-classifier-${testFileName}.json`;
                break;
            case "default-bayes":
                this.classifierInstance = {
                    type: classifierType,
                    classifier: new NaiveBayesClassifier()
                }
                this.classifierDataPath =
                    process.env.NODE_ENV === 'production' ? 'default-bayes-classifier.json' : `default-bayes-classifier-${testFileName}.json`;
                break;
            case "default-knn":
                this.classifierInstance = {
                    type: classifierType,
                    classifier: new KnnClassifier
                }
                this.classifierDataPath =
                    process.env.NODE_ENV === 'production' ? 'default-knn-classifier.json' : `default-knn-classifier-${testFileName}.json`;
                break;
        }
    }

    public async init() {
        switch (this.classifierInstance.type) {
            case 'natural-bayes': {
                const initData = Bun.file(this.classifierDataPath)
                if (!(await initData.exists())) {
                    const c = this.classifierInstance.classifier
                    await Bun.write(this.classifierDataPath, JSON.stringify(c))
                } else {
                    const data = await initData.json()
                    this.classifierInstance.classifier = BayesClassifier.restore(data)
                }
                break;
            }
            case 'default-bayes': {
                const initData = Bun.file(this.classifierDataPath)
                if (!(await initData.exists())) {
                    const c = this.classifierInstance.classifier
                    await Bun.write(this.classifierDataPath, c.toJson())
                } else {
                    const data = await initData.json()
                    this.classifierInstance.classifier = new NaiveBayesClassifier(data.state, data.options)
                }
                break;
            }
            case "default-knn": {
                const initData = Bun.file(this.classifierDataPath)
                await this.classifierInstance.classifier.init()
                if (!(await initData.exists())) {
                    await this.classifierInstance.classifier.save(this.classifierDataPath)
                } else {
                    await this.classifierInstance.classifier.restore(this.classifierDataPath)
                }
            }

        }
    }

    public async addDocument(doc: DocumentToAdd) {
        switch (this.classifierInstance.type) {
            case 'natural-bayes': {
                const res = this.naturalTokeniseWord(doc.description)
                this.classifierInstance.classifier.addDocument(res, doc.tag)
                break;
            }
            case 'default-bayes': {
                this.classifierInstance.classifier.learn(doc.description, doc.tag)
                break;
            }
            case 'default-knn': {
                await this.classifierInstance.classifier.addDocument(doc)
                break;
            }
        }
    }

    public async saveAndTrain() {
        switch (this.classifierInstance.type) {
            case "natural-bayes": {
                this.classifierInstance.classifier.train()
                const serialised = JSON.stringify(this.classifierInstance.classifier)
                await Bun.write(this.classifierDataPath, serialised)
                break;
            }
            case "default-bayes": {
                const serialised = this.classifierInstance.classifier.toJson()
                await Bun.write(this.classifierDataPath, serialised)
                break;
            }
            case "default-knn": {
                await this.classifierInstance.classifier.save(this.classifierDataPath)
                break;
            }
        }
    }

    public isValid() {
        switch (this.classifierInstance.type) {
            case "natural-bayes":
                return !!this.classifierInstance.classifier.docs.length
            case "default-bayes":
                return !!this.classifierInstance.classifier.docCount
            case "default-knn":
                return !!this.classifierInstance.classifier.instance.getNumClasses()
        }
    }

    public async predict(target: string) {
        switch (this.classifierInstance.type) {
            case "natural-bayes": {
                const tokenised = this.naturalTokeniseWord(target)
                const res = this.classifierInstance.classifier.getClassifications(tokenised)
                return res.map((r) => ({ label: r.label, value: r.value }))
            }
            case "default-bayes": {
                const res = await this.classifierInstance.classifier.categorise(target)
                return res.map((r) => ({ label: r.label, value: r.value }))
            }
            case "default-knn": {
                const res = await this.classifierInstance.classifier.predict(target)
                return Object.entries(res.confidences).map(([label, value]) => ({ label, value }))
            }
        }
    }

    private naturalTokeniseWord(word: string) {
        const tokeniser = new WordTokenizer()
        return tokeniser.tokenize(word)
    }
}