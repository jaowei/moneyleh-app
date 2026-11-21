import type { Dispatch, SetStateAction } from "react";
import {
	createBlankHoldingRow,
	type EditableHoldingField,
	type EditableHoldingRow,
	updateEditableHolding,
} from "../lib/editable-holdings.ts";
import { EditableCell } from "./EditableCell.tsx";

interface PortfolioTableProps {
	rows: EditableHoldingRow[];
	setRows: Dispatch<SetStateAction<EditableHoldingRow[]>>;
	canEdit: boolean;
}

/**
 * Editable view of the holdings parsed from a broker statement. Values come
 * straight from the statement, so the user can correct any instrument, unit or
 * amount that was parsed incorrectly, remove a phantom holding, or add one the
 * parser missed before confirming the upload.
 */
export const PortfolioTable = ({
	rows,
	setRows,
	canEdit,
}: PortfolioTableProps) => {
	const handleChange = (
		index: number,
		field: EditableHoldingField,
		rawValue: string,
	) => {
		setRows((existing) =>
			existing.map((row, idx) =>
				idx === index
					? {
							...row,
							holding: updateEditableHolding(row.holding, field, rawValue),
						}
					: row,
			),
		);
	};

	const handleRemove = (index: number) => {
		setRows((existing) => existing.toSpliced(index, 1));
	};

	const handleAdd = () => {
		setRows((existing) => [
			...existing,
			createBlankHoldingRow(existing[0]?.holding.currency ?? "SGD"),
		]);
	};

	const totals = rows.reduce<Record<string, number>>((acc, { holding }) => {
		acc[holding.currency] = (acc[holding.currency] ?? 0) + holding.marketValue;
		return acc;
	}, {});

	return (
		<div className="flex flex-col gap-2 w-full">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div>
					<h3 className="text-lg xl:text-xl font-semibold">
						Portfolio holdings
					</h3>
					<p className="text-xs text-base-content/70">
						Parsed from the statement. Correct any value that looks wrong,
						remove a holding that should not be there, or add one that was
						missed.
					</p>
				</div>
				<button
					type="button"
					className="btn btn-sm btn-outline"
					disabled={!canEdit}
					onClick={handleAdd}
				>
					+ Add holding
				</button>
			</div>
			{rows.length === 0 && (
				<p className="px-2 py-4 text-sm text-base-content/60">
					No holdings were parsed from this statement.
				</p>
			)}
			{rows.length > 0 && (
				<>
					<table className="table table-zebra table-xs table-pin-rows border border-base-300 rounded w-full">
						<thead>
							<tr>
								<th className="min-w-[280px]">Instrument</th>
								<th className="w-28 text-right">Units</th>
								<th className="w-28 text-right">Unit price</th>
								<th className="w-32 text-right">Market value</th>
								<th className="w-20 text-center">Currency</th>
								<th className="w-32 text-right">Unrealised gain</th>
								<th className="w-10" />
							</tr>
						</thead>
						<tbody>
							{rows.map(({ key, holding }, idx) => (
								<tr key={key}>
									<EditableCell
										value={holding.instrumentName}
										editing={canEdit}
										type="text"
										className="min-w-[280px]"
										inputClassName={`w-full font-medium ${
											holding.instrumentName.trim() === "" ? "input-error" : ""
										}`}
										onChange={(value) =>
											handleChange(idx, "instrumentName", value)
										}
									/>
									<EditableCell
										value={holding.units}
										editing={canEdit}
										type="number"
										className="w-28 text-right"
										inputClassName="w-24 text-right font-mono tabular-nums"
										onChange={(value) => handleChange(idx, "units", value)}
									/>
									<EditableCell
										value={holding.price}
										editing={canEdit}
										type="number"
										className="w-28 text-right"
										inputClassName="w-24 text-right font-mono tabular-nums"
										onChange={(value) => handleChange(idx, "price", value)}
									/>
									<EditableCell
										value={holding.marketValue}
										editing={canEdit}
										type="number"
										className="w-32 text-right"
										inputClassName="w-28 text-right font-mono tabular-nums font-semibold"
										onChange={(value) =>
											handleChange(idx, "marketValue", value)
										}
									/>
									<EditableCell
										value={holding.currency}
										editing={canEdit}
										type="text"
										className="w-20 text-center"
										inputClassName="w-16 text-center uppercase"
										onChange={(value) => handleChange(idx, "currency", value)}
									/>
									<EditableCell
										value={holding.unrealisedGain ?? ""}
										editing={canEdit}
										type="number"
										className="w-32 text-right"
										inputClassName="w-24 text-right font-mono tabular-nums"
										onChange={(value) =>
											handleChange(idx, "unrealisedGain", value)
										}
									/>
									<td className="w-10 text-center">
										<button
											type="button"
											className="btn btn-ghost btn-xs text-error"
											disabled={!canEdit}
											aria-label={`Remove ${holding.instrumentName || "holding"}`}
											title="Remove holding"
											onClick={() => handleRemove(idx)}
										>
											✕
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
					<div className="flex justify-end gap-4 px-2 text-sm text-base-content/70">
						{Object.entries(totals).map(([currency, total]) => (
							<span key={currency} className="font-mono tabular-nums">
								Portfolio total: {currency} {total.toFixed(2)}
							</span>
						))}
					</div>
				</>
			)}
		</div>
	);
};
