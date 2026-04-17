import { type ChangeEventHandler, useRef, useState } from "react";
import { backendRouteClient, type Tag } from "../lib/backend-clients.ts";
import { useAuth } from "../context/auth.tsx";

interface BulkUploadModalProps {
    accountName?: string;
    accountId?: number;
    cardName?: string;
    cardId?: number;
    tagData: Tag[];
    onAddSuccess?: (name?: string) => void;
}

export default function BulkUploadModal({ accountId, accountName, cardName, cardId, onAddSuccess }: BulkUploadModalProps) {
    const { user } = useAuth()
    const userId = user?.id

    const dialogRef = useRef<HTMLDialogElement>(null)

    const [uploadError, setUploadError] = useState('')
    const [targetFile, setTargetFile] = useState<File | undefined>()

    if (!userId) {
        return <div>Please sign in!</div>
    }

    const handleModalTriggerClick = () => {
        dialogRef.current?.showModal()
    }

    const handleFileBulkUploadInput: ChangeEventHandler<HTMLInputElement> = async (e) => {
        setUploadError('')
        const files = e.target.files

        if (!files || !files[0]) {
            setUploadError('No file detected!')
            return
        }

        setTargetFile(files[0])
    }

    const handleUploadConfirmClick = async () => {
        if (!targetFile) {
            setUploadError('No file detected!')
            return
        }

        const res = await backendRouteClient.api.transaction.csv.$post({
            form: {
                userId,
                ...(cardId && { cardId: `${cardId}` }),
                ...(accountId && { accountId: `${accountId}` }),
                file: targetFile
            }
        })
        if (res.ok) {
            onAddSuccess?.(accountName || cardName)
            dialogRef.current?.close()
        } else {
            setUploadError(await res.text())
        }
    }

    const handleModalCloseClick = () => {
        setUploadError('')
        dialogRef.current?.close()
    }

    return (<div>
        <button className="btn btn-xs btn-primary truncate" onClick={handleModalTriggerClick}>
            Bulk Upload
        </button>
        <dialog ref={dialogRef} className="modal">
            <div className="modal-box">
                <fieldset className="fieldset">
                    <legend className="fieldset-legend">Bulk Upload (only CSV) for {accountName || cardName}</legend>
                    <input type='file' className='file-input' accept="text/csv"
                        onChange={handleFileBulkUploadInput} />
                    <p className="label">CSV must be in the correct format</p>
                    {uploadError &&
                        <div className="alert alert-error">{uploadError}</div>
                    }
                </fieldset>
                <div className="modal-action">
                    {targetFile && <button className="btn btn-active" onClick={handleUploadConfirmClick}>Confirm upload</button>}
                    <button className="btn" onClick={handleModalCloseClick}>Close</button>
                </div>
            </div>
        </dialog>
    </div>)
}