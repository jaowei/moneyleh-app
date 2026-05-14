import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AccountCardChart } from "../../components/AccountCardChart.tsx";
import { AccountCardStats } from "../../components/AccountCardStats.tsx";
import { AccountCardTransactionRow } from "../../components/AccountCardTransactionRow.tsx";
import BulkUploadModal from "../../components/BulkUploadModal.tsx";
import { TagPickerModal, type UiTag } from "../../components/TagPicker.tsx";
import { EditableTransactionsTableHeader } from "../../components/TransactionsTableHeader.tsx";
import { useTagModal } from "../../hooks/useTagModal.ts";
import {
	backendRouteClient,
	fetchTagData,
	type GetTransactionDataRes,
} from "../../lib/backend-clients.ts";
import { getBackendErrorResponse } from "../../lib/error.ts";

export const Route = createFileRoute("/_authenticated/inventory/$type/$id")({
	component: InventoryDataComponent,
	loader: async ({ context, params }) => {
		const { auth } = context;
		if (!auth?.user?.id) {
			throw new Error();
		}

		let data: GetTransactionDataRes;

		const queryParamsId =
			params.type === "account"
				? { type: params.type, accountId: params.id }
				: { type: params.type, cardId: params.id };

		const res = await backendRouteClient.api.transaction[":userId"].$get({
			param: { userId: auth.user.id },
			query: queryParamsId,
		});

		if (res.ok) {
			data = await res.json();
		} else {
			throw await getBackendErrorResponse(res);
		}

		const tagData = await fetchTagData();

		return {
			data,
			tagData,
			crumb: data.displayName,
			userId: auth.user.id,
		};
	},
});

function InventoryDataComponent() {
	const { data, tagData, userId } = Route.useLoaderData();
	const { id, type } = Route.useParams();
	const router = useRouter();
	const {
		tagModalRef,
		indexEditing,
		selectedTags,
		handleTagEditorClose,
		handleTagEditorOpen,
		handleTagEditorChange,
	} = useTagModal();
	const [editableTransactions, setEditableTransactions] = useState(
		data.transactions,
	);

	const handleTagChange = (tags: UiTag[]) => {
		setEditableTransactions((existing) =>
			existing.map((txn, idx) => {
				if (indexEditing === idx) {
					return {
						...txn,
						tags,
					};
				} else {
					return txn;
				}
			}),
		);
		handleTagEditorChange(tags);
	};

	return (
		<div className="flex flex-col gap-3 items-center">
			<div className="text-7xl">{data.displayName}</div>
			<div className="flex flex-row justify-center gap-5 w-full items-center">
				<div className="flex flex-col items-center gap-5">
					<AccountCardStats
						numTransactions={data.transactionCount}
						currentBalance={data.valueByCurrency}
						latestTransactionDate={data.transactions[0]?.transactionDate}
					/>
					<BulkUploadModal
						accountName={type === "account" ? data.displayName : undefined}
						accountId={type === "account" ? Number(id) : undefined}
						tagData={tagData}
						onAddSuccess={() => {
							router.invalidate();
						}}
						cardName={type === "card" ? data.displayName : undefined}
						cardId={type === "card" ? Number(id) : undefined}
					/>
				</div>
				<AccountCardChart chartData={data.chartData} />
			</div>
			<div className="w-[85vw] max-h-[45vh] overflow-auto border rounded-sm border-neutral-content">
				{data.transactions.length > 0 && (
					<table className="table table-zebra table-xs table-pin-rows">
						<EditableTransactionsTableHeader />
						<tbody>
							{editableTransactions.map((t, idx) => (
								<AccountCardTransactionRow
									key={t.id}
									userId={userId}
									transaction={t}
									transactionIndex={idx}
									onTagEditorOpen={handleTagEditorOpen}
									setTransactions={setEditableTransactions}
								/>
							))}
						</tbody>
					</table>
				)}
			</div>
			<TagPickerModal
				ref={tagModalRef}
				availableTags={tagData}
				selectedTags={selectedTags}
				onModalClose={handleTagEditorClose}
				onTagChange={handleTagChange}
			/>
		</div>
	);
}
