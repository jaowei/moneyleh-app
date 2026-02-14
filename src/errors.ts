export const alreadyExistsResponse = new Response('Already Exists', {
    status: 409,
})

export const ParsingErrors = {
    statementDate: new Error('Format error: Unable to parse statement date'),
    dueDate: new Error('Format error: Unable to parse due date'),
    page: new Error('Unknown format: Page not found'),
    transactionDate: new Error('Format error: Unable to parse transaction date')
}