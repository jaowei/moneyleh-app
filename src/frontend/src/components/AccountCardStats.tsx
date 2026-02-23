interface AccountCardStatsProps {
    numTransactions: number;
    currentBalance: Record<string, number>;
    latestTransactionDate?: string;
}

const currencyFormatter = (value: number, currencyCode: string) => {
    return new Intl.NumberFormat('en-sg', { style: 'currency', currency: currencyCode }).format(value)
}

export const AccountCardStats = ({ numTransactions, currentBalance, latestTransactionDate }: AccountCardStatsProps) => {

    return (
        <div className="stats bg-base-100 border-base-300 border">
            <div className="stat">
                <div className="stat-title">Total transactions</div>
                <div className="stat-value text-secondary">{numTransactions}</div>
            </div>
            <div className="stat">
                <div className="stat-title">Latest Transaction</div>
                <div className="stat-value text-secondary">{latestTransactionDate || 'N/A'}</div>
            </div>
            {Object.entries(currentBalance).map(([curr, value]) => (
                <div className="stat ">
                    <div className="stat-title">Current balance</div>
                    <div className="stat-value text-primary">{curr} {currencyFormatter(value, curr)}</div>
                </div>
            ))}

        </div>
    )
}