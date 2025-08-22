// TODO: Experimenting with new PDF library
import mupdf from 'mupdf'

const doc = mupdf.PDFDocument.openDocument(await Bun.file("/mnt/c/Users/97300125/Documents/jaowei/Finance/DBS/2025-6-CC.pdf").arrayBuffer())

const allText: any[] = []
for (let i = 0; i < doc.countPages(); i++) {
const page = doc.loadPage(i)
const res = page.toStructuredText().asText()
const data = res.split('\n')
let line: any[] = []
data.forEach((str) => {
    if (str) {
        line.push(str)
    } else {
        allText.push(line)
        line = []
    }
})
}
console.log(allText)