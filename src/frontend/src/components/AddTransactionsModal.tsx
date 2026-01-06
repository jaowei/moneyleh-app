import { type ChangeEventHandler, useRef, useState } from "react";
import { AddButton } from "./AddButton.tsx";
import { backendRouteClient, type Tag } from "../lib/backend-clients.ts";
import { useAuth } from "../context/auth.tsx";

interface AddTransactionsModalProps {
    accountId?: number;
    cardId?: number;
    tagData: Tag[]
}

export default function AddTransactionsModal({ accountId, cardId }: AddTransactionsModalProps) {
    const { user } = useAuth()

    const dialogRef = useRef<HTMLDialogElement>(null)

    const [uploadError, setUploadError] = useState('')

    const handleAddButtonClick = () => {
        dialogRef.current?.showModal()
    }

    const handleFileBulkUploadInput: ChangeEventHandler<HTMLInputElement> = async (e) => {
        setUploadError('')
        const files = e.target.files

        if (!user?.id || !files || !files[0]) return

        const res = await backendRouteClient.api.transaction.csv.$post({
            form: {
                userId: user.id,
                ...(cardId && { cardId: `${cardId}` }),
                ...(accountId && { accountId: `${accountId}` }),
                file: files[0]
            }
        })
        if (res.ok) {
            dialogRef.current?.close()
        } else {
            setUploadError(await res.text())
        }
    }


    const handleModalCloseClick = () => {
        setUploadError('')
        dialogRef.current?.close()
    }

    const tabGroupName = `tab-group-${accountId || cardId}`

    return (<div>
        <AddButton onClick={handleAddButtonClick} />
        <dialog ref={dialogRef} className="modal">
            <div className="modal-box">
                <div className="tabs tabs-border">
                    <input type="radio" name={tabGroupName} className="tab" aria-label="Bulk" defaultChecked />
                    <div className="tab-content border-base-300 p-6 bg-base-100">
                        <fieldset className="fieldset">
                            <legend className="fieldset-legend">Bulk Upload (only CSV)</legend>
                            <input type='file' className='file-input' accept="text/csv"
                                onChange={handleFileBulkUploadInput} />
                            <p className="label">CSV must be in the correct format</p>
                            {uploadError &&
                                <div className="alert alert-error">{uploadError}</div>
                            }
                        </fieldset>
                    </div>
                </div>
                <div className="modal-action">
                    <button className="btn" onClick={handleModalCloseClick}>Close</button>
                </div>
            </div>
        </dialog>
    </div>)
}