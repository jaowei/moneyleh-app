import { backendRouteClient, type Tag, type FileUploadRes } from "../lib/backend-clients.ts";
import { TagPicker, type UiTag } from "./TagPicker.tsx";
import { type Dispatch, type SetStateAction, useState } from "react";
import { useAuth } from "../context/auth.tsx";

interface TransactionViewerProps {
    fileUploadRes: FileUploadRes;
    tagData: Tag[]
}

interface TransactionsTableProps {
    transactions: FileUploadRes['taggedTransactions'][0];
    statementInfo: FileUploadRes['statementInfo'];
    accountInfo?: FileUploadRes['accountInfo'][0];
    cardInfo?: FileUploadRes['cardInfo'][0]
    onSaveSuccess?: () => void;
    tagData: Tag[];
}

interface TransactionRowProps {
    transaction: FileUploadRes['taggedTransactions'][0][0];
    transactionIndex: number;
    canEdit: boolean;
    tagData: Tag[]
    setTransactions: Dispatch<SetStateAction<FileUploadRes['taggedTransactions'][0]>>
}

const TransactionRow = ({ transaction, tagData, setTransactions, transactionIndex, canEdit }: TransactionRowProps) => {
    const date = new Date(transaction.transactionDate)
    const handleTagChange = (selectedTags: UiTag[]) => {
        setTransactions((existing) => existing.map((txn, idx) => {
            if (transactionIndex === idx) {
                return {
                    ...txn,
                    tags: selectedTags,
                }
            } else {
                return txn
            }
        }))
    }
    return (
        <tr>
            <td>{transaction.accountName}</td>
            <td>{date.toLocaleDateString()}</td>
            <td>{transaction.description}</td>
            <td>{transaction.currency}</td>
            <td>{transaction.amount}</td>
            <td><TagPicker availableTags={tagData} selectedTags={transaction.tags} onTagChange={handleTagChange} canEdit={canEdit} /></td>
        </tr>
    )
}

export const EditableTransactionsTable = ({
    transactions, statementInfo, accountInfo, cardInfo, tagData, onSaveSuccess
}: TransactionsTableProps) => {
    const { user } = useAuth()
    const [editableTransactions, setEditableTransactions] = useState(transactions);
    const [saved, setSaved] = useState(false)
    const [saveError, setSaveError] = useState('')
    const userId = user?.id
    const name = accountInfo?.accountName || cardInfo?.cardName
    const handleSaveTransactionsClick = async () => {
        setSaveError('')
        try {
            const res = await backendRouteClient.api.transaction.$post({
                json: {
                    transactions: editableTransactions,
                    statementInfo,
                    cardInfo,
                    accountInfo
                }
            })
            if (!res.ok) {
                setSaveError(await res.text())
            } else {
                onSaveSuccess?.()
                setSaved(true)
            }
        } catch (e) {
            if (e instanceof Error) {
                setSaveError(`${e.name}: ${e.message}`)
            } else {
                setSaveError(JSON.stringify(e))
            }
        }
    }
    if (!userId) {
        return <div>Please sign in again</div>
    }
    return (
        <div className="flex flex-col w-full h-full items-center justify-center">
            <button className="btn btn-primary" disabled={saved}
                onClick={handleSaveTransactionsClick}>Save transactions for {name}
            </button>
            {saveError &&
                <div role="alert" className="alert alert-error">
                    <span>{saveError}</span>
                </div>
            }
            <table className="table table-zebra table-xs">
                <thead>
                    <tr>
                        <th>Account</th>
                        <th>Transaction Date</th>
                        <th>Description</th>
                        <th>Currency</th>
                        <th>Amount</th>
                        <th>Tag</th>
                    </tr>
                </thead>
                <tbody>
                    {editableTransactions.map((t, idx) => {
                        return <TransactionRow transaction={t} tagData={tagData} setTransactions={setEditableTransactions}
                            transactionIndex={idx} canEdit={!saved} />
                    })}
                </tbody>
            </table>
        </div>
    )
}

export default function TransactionsViewer({ fileUploadRes, tagData }: TransactionViewerProps) {
    return (
        <div className="tabs tabs-border">
            {fileUploadRes.taggedTransactions.map((transactionsPerAccount, idx) => {
                const { statementInfo, accountInfo, cardInfo } = fileUploadRes
                const name = accountInfo[idx]?.accountName || cardInfo[idx]?.cardName
                return (
                    <>
                        <input type="radio" name="transactions-tabs"
                            className="tab" aria-label={`${name}`} defaultChecked={idx === 0} />
                        <div className="tab-content border-base-300 bg-base-100 p-10">
                            <EditableTransactionsTable
                                transactions={transactionsPerAccount}
                                statementInfo={statementInfo}
                                accountInfo={accountInfo[idx]}
                                cardInfo={cardInfo[idx]}
                                tagData={tagData}
                            />
                        </div>
                    </>
                )
            })}
        </div>
    )
}