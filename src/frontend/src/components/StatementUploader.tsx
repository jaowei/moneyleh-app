import { getBackendErrorResponse } from "../lib/error.ts";
import EditableTransactionsTable from "./EditableTransactionsTable.tsx";
import { type EditableTransaction, type Tag, uiRouteClient } from "../lib/backend-clients.ts";
import { useState, type ChangeEventHandler } from "react";
import { useAuth } from "../context/auth";

interface StatementUploaderProps {
    tagData: Tag[]
    onStatementUploaded?: () => void;
    onStatementUploadError?: () => void;
}

export const StatementUploader = ({ tagData, onStatementUploaded, onStatementUploadError }: StatementUploaderProps) => {
    const { user } = useAuth()

    const [transactions, setTransactions] = useState<EditableTransaction[]>([])
    const [uploadError, setUploadError] = useState('')

    const handleFileStatementUploadInput: ChangeEventHandler<HTMLInputElement> = async (e) => {
        setUploadError('')
        const files = e.target.files
        const userId = user?.id
        const targetFile = files?.[0]

        if (!userId) throw new Error('No user id!')
        if (!targetFile) throw new Error('No file found!')

        try {
            const res = await uiRouteClient.fileUpload.$post({
                form: {
                    userId,
                    file: files[0]
                },
            })
            if (res.ok) {
                const resData = await res.json()
                setTransactions(resData.taggedTransactions)
                onStatementUploaded?.()
            } else {
                throw await getBackendErrorResponse(res)
            }
        } catch (error) {
            if (error instanceof Error) {
                setUploadError(`${error}`)
            } else {
                setUploadError(JSON.stringify(error))
            }
            onStatementUploadError?.()
        }
    }

    return (
        <div>
            <fieldset className="fieldset">
                <legend className="fieldset-legend">Upload a statement
                </legend>
                <input type='file' className='file-input' accept=".csv, .pdf, .xls, .xlsx"
                    onChange={handleFileStatementUploadInput} />
                <p className="label">Upload your monthly bank/account statements</p>
                {uploadError &&
                    <div className="alert alert-error">{uploadError}</div>
                }
            </fieldset>
            {transactions.length > 0 &&
                <EditableTransactionsTable transactions={transactions} setTransactions={setTransactions}
                    tagData={tagData} />
            }
        </div>
    )
}