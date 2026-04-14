import { getBackendErrorResponse } from "../lib/error.ts";
import TransactionsViewer from "./TransactionsViewer.tsx";
import { type FileUploadRes, type Tag, uiRouteClient } from "../lib/backend-clients.ts";
import { useState, type ChangeEventHandler } from "react";
import { useAuth } from "../context/auth";

interface StatementUploaderProps {
    tagData: Tag[]
    onStatementUploaded?: () => void;
    onStatementUploadError?: () => void;
}

export const StatementUploader = ({ tagData, onStatementUploaded, onStatementUploadError }: StatementUploaderProps) => {
    const { user } = useAuth()

    const [uploadInfo, setUploadInfo] = useState<FileUploadRes | undefined>()
    const [uploadError, setUploadError] = useState('')

    const handleClearClick = () => {
        setUploadInfo(undefined)
    }

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
                setUploadInfo(resData)
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
        <div className="flex flex-col items-center gap-4">
            <div className="flex flex-row items-center gap-4 content-center">
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
                <button className="btn" onClick={handleClearClick}>Clear data</button>
            </div>
            {uploadInfo && uploadInfo.taggedTransactions?.length > 0 && (
                <div>
                    <h2 className="text-2xl">Statement Date: {uploadInfo.statementInfo.statementDate}</h2>
                    <TransactionsViewer fileUploadRes={uploadInfo}
                        tagData={tagData} />
                </div>
            )
            }
        </div>
    )
}