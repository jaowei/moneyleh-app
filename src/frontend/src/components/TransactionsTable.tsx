import {backendRouteClient, type Tag, type Transaction} from "../lib/backend-clients.ts";
import {getRouteApi} from "@tanstack/react-router";
import {TagPicker, type UiTag} from "./TagPicker.tsx";
import {type Dispatch, type SetStateAction, useState} from "react";
import {Route} from "../routes/_authenticated/dashboard.tsx";

interface TransactionsTableProps {
    transactions: Transaction[];
    setTransactions: Dispatch<SetStateAction<Transaction[]>>
}

interface TransactionRowProps {
    transaction: Transaction;
    transactionIndex: number;
    tagData?: Tag[]
    setTransactions: Dispatch<SetStateAction<Transaction[]>>
    userId: string
}

const TransactionRow = ({transaction, tagData, setTransactions, transactionIndex}: TransactionRowProps) => {
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
            <td><TagPicker availableTags={tagData} tags={transaction.tags} onTagChange={handleTagChange}/></td>
        </tr>
    )
}

export default function TransactionsTable({transactions, setTransactions}: TransactionsTableProps) {
    const {auth} = Route.useRouteContext()
    const [saveError, setSaveError] = useState('')
    const userId = auth?.user?.id
    const route = getRouteApi('/_authenticated/dashboard')
    const {tagData} = route.useLoaderData()
    const handleSaveTransactionsClick = async () => {
        setSaveError('')
        try {
            const res = await backendRouteClient.api.transaction.$post({
                json: {transactions}
            })
            if (res.ok) {
                setTransactions([])
            } else {
                setSaveError(await res.text())
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
            <button className="btn btn-primary" disabled={!transactions.length}
                    onClick={handleSaveTransactionsClick}>Save transactions
            </button>
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
                {transactions.map((t, idx) => {
                    return <TransactionRow transaction={t} tagData={tagData} setTransactions={setTransactions}
                                           transactionIndex={idx} userId={userId}/>
                })}
                </tbody>
            </table>
            {/*TODO: Get popper js to handle toast*/}
            {saveError && <div className="toast toast-top toast-center">
                <div role="alert" className="alert alert-error">
                    <span>{saveError}</span>
                </div>
            </div>}
        </div>
    )
}