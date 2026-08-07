import { currencyFormatter } from "../lib/text-utils";

interface AccountCardStatsProps {
	numTransactions: number;
	currentBalance: Record<string, number>;
	latestTransactionDate?: string;
}

export const AccountCardStats = ({
	numTransactions,
	currentBalance,
	latestTransactionDate,
}: AccountCardStatsProps) => {
	return (
		<div className="bg-base-100 border-base-300 border rounded-sm">
			<table className="table table-xs">
				<thead className="bg-base-300">
					<tr>
						<th>Total transactions</th>
						<th>Latest transactions</th>
						<th>Current balance</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>{numTransactions}</td>
						<td>{latestTransactionDate || "N/A"}</td>
						<td>
							{Object.entries(currentBalance).map(([curr, value]) => (
								<div
									key={`${curr}-${value}`}
									className="text-primary text-sm fond-bold"
								>
									{curr} {currencyFormatter(value, curr)}
								</div>
							))}
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	);
};
