interface AccountCardStatsProps {
	numTransactions: number;
	currentBalance: Record<string, number>;
	latestTransactionDate?: string;
}

const currencyFormatter = (value: number, currencyCode: string) => {
	return new Intl.NumberFormat("en-sg", {
		style: "currency",
		currency: currencyCode,
	}).format(value);
};

export const AccountCardStats = ({
	numTransactions,
	currentBalance,
	latestTransactionDate,
}: AccountCardStatsProps) => {
	return (
		<div className="stats bg-base-100 border-base-300 border max-h-[10vh]">
			<div className="stat">
				<div className="stat-title text-sm">Total transactions</div>
				<div className="stat-value text-sm text-secondary">
					{numTransactions}
				</div>
			</div>
			<div className="stat">
				<div className="stat-title text-sm">Latest Transaction</div>
				<div className="stat-value text-secondary text-sm">
					{latestTransactionDate || "N/A"}
				</div>
			</div>
			{Object.entries(currentBalance).map(([curr, value]) => (
				<div key={value} className="stat">
					<div className="stat-title text-sm">Current balance</div>
					<div className="stat-value text-primary text-sm">
						{curr} {currencyFormatter(value, curr)}
					</div>
				</div>
			))}
		</div>
	);
};
