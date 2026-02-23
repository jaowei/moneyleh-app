import { createFileRoute, useRouter } from "@tanstack/react-router";
import { backendRouteClient, fetchTagData } from "../../lib/backend-clients.ts";
import { getBackendErrorResponse } from "../../lib/error.ts";
import BulkUploadModal from "../../components/BulkUploadModal.tsx";
import { AccountCardStats } from "../../components/AccountCardStats.tsx";

export const Route = createFileRoute('/_authenticated/inventory/account/$accountId')({
    component: InventoryAccountComponent,
    loader: async ({ context, params }) => {
        const { auth } = context
        if (!auth?.user?.id) {
            throw new Error()
        }

        let accountInfo

        const res = await backendRouteClient.api.transaction[':userId']['$get']({
            param: { userId: auth.user.id },
            query: {
                type: 'account',
                accountId: params.accountId,
            }
        })

        if (res.ok) {
            accountInfo = await res.json()
        } else {
            throw await getBackendErrorResponse(res)
        }

        const tagData = await fetchTagData()

        return {
            accountInfo,
            tagData,
            crumb: accountInfo.displayName
        }
    }
})

function InventoryAccountComponent() {
    const { accountInfo, tagData } = Route.useLoaderData()
    const { accountId } = Route.useParams()
    const router = useRouter()

    return (
        <div>
            <div className="text-7xl">{accountInfo.displayName}</div>
            <AccountCardStats
                numTransactions={accountInfo.transactionCount}
                currentBalance={accountInfo.valueByCurrency}
                latestTransactionDate={accountInfo.transactions[0]?.transactionDate}
            />
            <BulkUploadModal accountId={Number(accountId)} tagData={tagData} onAddSuccess={() => {
                router.invalidate()
            }} />
            {accountInfo.transactions.length > 0 && (
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
                        {accountInfo.transactions.map((t) => (
                            <tr>
                                <td>{t.transactionDate}</td>
                                <td>{t.amount}</td>
                                <td>{t.currency}</td>
                                <td>{t.description}</td>
                                <td>
                                    {t.tags.map((tag) => (
                                        <div>{tag.description}</div>
                                    ))}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )
}