import {createFileRoute} from '@tanstack/react-router'
import {backendRouteClient, type Transaction, uiRouteClient} from "../../lib/backend-clients.ts";
import {type ChangeEventHandler, useState} from "react";
import TransactionsTable from "../../components/TransactionsTable.tsx";
import {getBackendErrorResponse} from "../../lib/error.ts";

export const Route = createFileRoute('/_authenticated/dashboard')({
    component: DashboardComponent,
    loader: async () => {
        const res = await backendRouteClient.api.tag.$get()
        if (res.ok) {
            return (await res.json()).data
        } else {
            throw await getBackendErrorResponse(res)
        }
    }
})

function DashboardComponent() {
    const {auth} = Route.useRouteContext()
    const [transactions, setTransactions] = useState<Transaction[]>([])

    const handleFileUploadInput: ChangeEventHandler<HTMLInputElement> = async (e) => {
        const files = e.target.files
        const userId = auth?.user?.id
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
            const transactionsWithUserId = resData.taggedTransactions.map((t) => ({
                ...t,
                userId
            }))
            setTransactions(transactionsWithUserId)
        } else {
            throw await getBackendErrorResponse(res)
        }
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <button
                    onClick={auth.logout}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                >
                    Sign Out
                </button>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-2">Welcome back!</h2>
                <p className="text-gray-600">
                    Hello, <strong>{auth.user?.name}</strong>! You are successfully
                    authenticated.
                </p>
                <p className="text-sm text-gray-500 mt-2">Email: {auth.user?.email}</p>
            </div>

            <input type='file' className='file-input' onChange={handleFileUploadInput}/>

            <TransactionsTable transactions={transactions} setTransactions={setTransactions}/>
        </div>
    )
}
