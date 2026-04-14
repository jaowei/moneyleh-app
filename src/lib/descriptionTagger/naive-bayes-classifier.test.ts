import { describe, expect, test } from 'bun:test'
import { NaiveBayesClassifier } from './naive-bayes-classifier'

describe('default naive bayes test', () => {
    test('add doc', async () => {
        const c = new NaiveBayesClassifier()
        c.learn('test-text', 'test-label')
        expect(c.docCount).toMatchObject({ 'test-label': 1 })
    })
})