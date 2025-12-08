import {type ChangeEventHandler, useRef, useState} from "react";
import {AddButton} from "./AddButton.tsx";
import {backendRouteClient} from "../lib/backend-clients.ts";
import {useAuth} from "../context/auth.tsx";

interface AddTransactionsModalProps {
    accountId?: number;
    cardId?: number;
}

export default function AddTransactionsModal({accountId, cardId}: AddTransactionsModalProps) {
    const {user} = useAuth()

    const dialogRef = useRef<HTMLDialogElement>(null)

    const [uploadError, setUploadError] = useState('')

    const handleAddButtonClick = () => {
        dialogRef.current?.showModal()
    }

    const handleFileUploadInput: ChangeEventHandler<HTMLInputElement> = async (e) => {
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

    const handleModalCloseClick = () => {
        setUploadError('')
        dialogRef.current?.close()
    }

    return (<div>
        <AddButton onClick={handleAddButtonClick}/>
        <dialog ref={dialogRef} className="modal">
            <div className="modal-box">
                <fieldset className="fieldset">
                    <legend className="fieldset-legend">Upload a csv with transactions</legend>
                    <input type='file' className='file-input' onChange={handleFileUploadInput}/>
                    <p className="label">CSV must be in the correct format</p>
                    {uploadError &&
                        <div className="alert alert-error">{uploadError}</div>
                    }
                </fieldset>
                <div className="modal-action">
                    <button className="btn" onClick={handleModalCloseClick}>Close</button>
                </div>
            </div>
        </dialog>
    </div>)
}