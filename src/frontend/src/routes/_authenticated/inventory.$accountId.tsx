import {createFileRoute} from "@tanstack/react-router";
import {backendRouteClient} from "../../lib/backend-clients.ts";
import {getBackendErrorResponse} from "../../lib/error.ts";
import AddTransactionsModal from "../../components/AddTransactionsModal.tsx";

export const Route = createFileRoute('/_authenticated/inventory/$accountId')({
    component: InventoryAccountComponent,
    loader: async ({context, params}) => {
        const {auth} = context
        if (!auth?.user?.id) {
            return
        }
        const res = await backendRouteClient.api.transaction[':userId']['$get']({
            param: {userId: auth.user.id},
            query: {
                type: 'account',
                accountId: params.accountId
            }
        })
        if (res.ok) {
            return {
                accountTransactions: await res.json()
            }
        } else {
            throw await getBackendErrorResponse(res)
        }
    }
})

function InventoryAccountComponent() {
    const data = Route.useLoaderData()
    const {accountId} = Route.useParams()

    if (!data?.accountTransactions || !data?.accountTransactions.transactions.length) {
        return (
            <>
                <div>No transactions, add some here</div>
                <AddTransactionsModal accountId={Number(accountId)}/>
            </>
        )
    }

    return (
        <table className="table table-zebra table-xs">
            <thead>
            <tr>
                <th>Transaction Date</th>
                <th>Amount</th>
                <th>Currency</th>
                <th>Description</th>
                <th>Tag</th>
            </tr>
            </thead>
            <tbody>
            {data.accountTransactions.transactions.map((t) => (
                <tr>
                    <td>{t.transactionDate}</td>
                    <td>{t.amount}</td>
                    <td>{t.currency}</td>
                    <td>{t.description}</td>
                    {/* TODO: Implement tag display refactor table or tag picker in components */}
                </tr>
            ))}
            </tbody>
        </table>
    )
}