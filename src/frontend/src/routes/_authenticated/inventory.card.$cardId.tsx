import { createFileRoute, useRouter } from "@tanstack/react-router";
import { backendRouteClient, fetchTagData } from "../../lib/backend-clients.ts";
import { getBackendErrorResponse } from "../../lib/error.ts";
import BulkUploadModal from "../../components/BulkUploadModal.tsx";
import { AccountCardStats } from "../../components/AccountCardStats.tsx";
import { AccountCardChart } from "../../components/AccountCardChart.tsx";

export const Route = createFileRoute('/_authenticated/inventory/card/$cardId')({
    component: InventoryAccountComponent,
    loader: async ({ context, params }) => {
        const { auth } = context
        if (!auth?.user?.id) {
            throw new Error()
        }

        let cardInfo

        const res = await backendRouteClient.api.transaction[':userId']['$get']({
            param: { userId: auth.user.id },
            query: {
                type: 'card',
                cardId: params.cardId,
            }
        })

        if (res.ok) {
            cardInfo = await res.json()
        } else {
            throw await getBackendErrorResponse(res)
        }

        const tagData = await fetchTagData()

        return {
            cardInfo,
            tagData,
            crumb: cardInfo.displayName
        }
    }
})

function InventoryAccountComponent() {
    const { cardInfo, tagData } = Route.useLoaderData()
    const { cardId } = Route.useParams()
    const router = useRouter()

    return (
        <div>
            <div className="text-7xl">{cardInfo.displayName}</div>
            <AccountCardStats
                numTransactions={cardInfo.transactionCount}
                currentBalance={cardInfo.valueByCurrency}
                latestTransactionDate={cardInfo.transactions[0]?.transactionDate}
            />
            <AccountCardChart chartData={cardInfo.chartData} />
            <BulkUploadModal cardName={cardInfo.displayName} cardId={Number(cardId)} tagData={tagData} onAddSuccess={() => {
                router.invalidate()
            }} />
            {cardInfo.transactions.length > 0 && (
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
                        {cardInfo.transactions.map((t) => (
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