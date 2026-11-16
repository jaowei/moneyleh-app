export const EditableTransactionsTableHeader = () => {
	return (
		<thead>
			<tr>
				<th className="w-32">Transaction Date</th>
				<th className="min-w-[280px]">Description</th>
				<th className="w-16 text-center">Currency</th>
				<th className="w-28 text-right">Amount</th>
				<th className="min-w-[200px]">Tags</th>
				<th className="w-24 text-center">Split Transaction</th>
				<th className="w-24 text-center">Actions</th>
			</tr>
		</thead>
	);
};
