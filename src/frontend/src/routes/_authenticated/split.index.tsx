import { createFileRoute, Link } from "@tanstack/react-router";
import {
	fetchTransactionSplitSummary,
	fetchTransactionSplitTransactions,
	type SplitSummary,
	type TransactionSplit,
} from "../../lib/backend-clients";
import { ERROR_MESSAGES } from "../../lib/error";
import { currencyFormatter } from "../../lib/text-utils";

type SplitSearch = {
	offset: number;
	limit: number;
};

export const Route = createFileRoute("/_authenticated/split/")({
	component: SplitComponent,
	validateSearch: (search: Record<string, unknown>): SplitSearch => {
		return {
			offset: Number(search?.offset ?? 0),
			limit: Number(search?.limit ?? 100),
		};
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { auth }, deps: { offset, limit } }) => {
		const user = auth?.user;
		if (!user?.id || !user?.name) {
			throw new Error(ERROR_MESSAGES.NOT_AUTHORISED);
		}
		const splits = await fetchTransactionSplitSummary(user.id);
		const transactions = await fetchTransactionSplitTransactions(
			user.id,
			offset,
			limit,
		);
		return {
			user: {
				id: user.id,
				name: user.name,
			},
			splits,
			transactions,
		};
	},
});

const TableHeaders = () => {
	return (
		<thead>
			<tr>
				<th>Transaction Date</th>
				<th>Description</th>
				<th>Transaction Amount</th>
				<th>Your share</th>
				<th>Amount Owed</th>
			</tr>
		</thead>
	);
};

const TransactionRow = ({ transaction }: { transaction: TransactionSplit }) => {
	return (
		<tr>
			<td>{transaction.transactionDate}</td>
			<td>{transaction.description}</td>
			<td>{transaction.transactionAmount}</td>
			<td>{transaction.share}</td>
			<td>{transaction.amountOwed}</td>
		</tr>
	);
};

const SplitStats = ({ splits }: { splits: SplitSummary }) => {
	const netAmount = splits.totalAmountToReceive - splits.totalAmountToPay;
	const textColour = netAmount < 0 ? "text-error" : "text-success";
	return (
		<div className="flex flex-row gap-4 w-full justify-center">
			<div className="stats shadow">
				<div className="stat">
					<div className="stat-title">Total Amount To Pay</div>
					<div className={`stat-value ${textColour}`}>
						{currencyFormatter(splits.totalAmountToPay, "SGD")}
					</div>
				</div>
			</div>
			<div className="stats shadow">
				<div className="stat">
					<div className="stat-title">Total Amount To Receive</div>
					<div className={`stat-value ${textColour}`}>
						{currencyFormatter(splits.totalAmountToReceive, "SGD")}
					</div>
				</div>
			</div>
			<div className="stats shadow">
				<div className="stat">
					<div className="stat-title">
						{netAmount < 0 ? "To Pay" : "To Receive"}
					</div>
					<div className={`stat-value ${textColour}`}>
						{currencyFormatter(
							splits.totalAmountToReceive - splits.totalAmountToPay,
							"SGD",
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

function SplitComponent() {
	const { splits, transactions } = Route.useLoaderData();
	const { offset, limit } = Route.useSearch();
	return (
		<div className="flex flex-col p-6 gap-6">
			<SplitStats splits={splits} />
			<div className="flex flex-col gap-2">
				<div>
					<h1 className="text-xl font-bold text-primary">Your transactions</h1>
					<table className="table table-zebra table-xs">
						<TableHeaders />
						<tbody>
							{transactions.transactionsToReceive.map((t) => {
								return <TransactionRow key={t.id} transaction={t} />;
							})}
						</tbody>
					</table>
				</div>
				<div>
					<h1 className="text-xl font-bold text-primary">
						Transactions from others
					</h1>
					<table className="table table-zebra table-xs">
						{transactions.transactionsToPayByUser.map(
							(transactionsForUser, idx) => {
								return (
									<>
										<TableHeaders />
										<thead>
											<tr>
												<th>{transactions.relatedUsers[idx].name}</th>
											</tr>
										</thead>
										<tbody>
											{transactionsForUser.map((t) => {
												return <TransactionRow key={t.id} transaction={t} />;
											})}
										</tbody>
									</>
								);
							},
						)}
					</table>
				</div>
				<div className="join grid grid-cols-2">
					<button
						type="button"
						className="join-item btn btn-outline"
						disabled={offset === 0}
					>
						<Link
							from={Route.fullPath}
							search={(prev) => ({ ...prev, offset: prev.offset - prev.limit })}
						>
							Previous 100
						</Link>
					</button>
					<button
						type="button"
						className="join-item btn btn-outline"
						disabled={
							transactions.totalTransactionsToPay < limit &&
							transactions.totalTransactionsToReceive < limit
						}
					>
						<Link
							from={Route.fullPath}
							search={(prev) => ({ ...prev, offset: prev.offset + prev.limit })}
						>
							Next 100
						</Link>
					</button>
				</div>
			</div>
		</div>
	);
}
