import {type ChangeEventHandler, useRef, useState} from "react";
import {AddButton} from "./AddButton.tsx";
import {backendRouteClient, type EditableTransaction, type Tag, uiRouteClient} from "../lib/backend-clients.ts";
import {useAuth} from "../context/auth.tsx";
import {getBackendErrorResponse} from "../lib/error.ts";
import EditableTransactionsTable from "./EditableTransactionsTable.tsx";

interface AddTransactionsModalProps {
    accountId?: number;
    cardId?: number;
    tagData: Tag[]
}

export default function AddTransactionsModal({accountId, cardId, tagData}: AddTransactionsModalProps) {
    const {user} = useAuth()

    const dialogRef = useRef<HTMLDialogElement>(null)

    const [uploadError, setUploadError] = useState('')
    const [transactions, setTransactions] = useState<EditableTransaction[]>([])

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
                ...(cardId && {cardId: `${cardId}`}),
                ...(accountId && {accountId: `${accountId}`}),
                file: files[0]
            }
        })
        if (res.ok) {
            dialogRef.current?.close()
        } else {
            setUploadError(await res.text())
        }
    }

    const handleFileStatementUploadInput: ChangeEventHandler<HTMLInputElement> = async (e) => {
        const files = e.target.files
        const userId = user?.id
        const targetFile = files?.[0]
        if (!userId) throw new Error('No user id!')
        if (!targetFile) throw new Error('No file found!')

        const res = await uiRouteClient.fileUpload.$post({
            form: {
                userId,
                file: files[0]
            },
        })
        if (res.ok) {
            const resData = await res.json()
            setTransactions(resData.taggedTransactions)
        } else {
            throw await getBackendErrorResponse(res)
        }
    }

    const handleModalCloseClick = () => {
        setUploadError('')
        dialogRef.current?.close()
    }

    return (<div>
        <AddButton onClick={handleAddButtonClick}/>
        <dialog ref={dialogRef} className="modal">
            <div className="modal-box">
                <div className="tabs tabs-border">
                    <input type="radio" name="tab-group" className="tab" aria-label="Bulk" defaultChecked/>
                    <div className="tab-content border-base-300 p-6 bg-base-100">
                        <fieldset className="fieldset">
                            <legend className="fieldset-legend">Bulk Upload (only CSV)</legend>
                            <input type='file' className='file-input' accept="text/csv"
                                   onChange={handleFileBulkUploadInput}/>
                            <p className="label">CSV must be in the correct format</p>
                            {uploadError &&
                                <div className="alert alert-error">{uploadError}</div>
                            }
                        </fieldset>
                    </div>

                    <input type="radio" name="tab-group" className="tab" aria-label="Statement"/>
                    <div className="tab-content border-base-300 p-6 bg-base-100">
                        <fieldset className="fieldset">
                            <legend className="fieldset-legend">Upload a {accountId ? 'account' : 'card'} statement
                            </legend>
                            <input type='file' className='file-input' accept=".csv, .pdf, .xls, .xlsx"
                                   onChange={handleFileStatementUploadInput}/>
                            <p className="label">Upload your monthly bank statements</p>
                            {uploadError &&
                                <div className="alert alert-error">{uploadError}</div>
                            }
                        </fieldset>
                        {transactions.length > 0 &&
                            <EditableTransactionsTable transactions={transactions} setTransactions={setTransactions}
                                                       tagData={tagData}/>
                        }
                    </div>
                </div>
                <div className="modal-action">
                    <button className="btn" onClick={handleModalCloseClick}>Close</button>
                </div>
            </div>
        </dialog>
    </div>)
}