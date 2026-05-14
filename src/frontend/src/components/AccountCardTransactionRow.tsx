import { useRouter } from "@tanstack/react-router";
import { type Dispatch, type SetStateAction, useState } from "react";
import { useRequestState } from "../hooks/useRequestState";
import {
	backendRouteClient,
	type GetTransactionDataRes,
} from "../lib/backend-clients";
import { EditableCell } from "./EditableCell";
import { TagPicker, type UiTag } from "./TagPicker";
import { TagTableViewer } from "./TagTableViewer";

type Transaction = GetTransactionDataRes["transactions"][0];

interface TransactionRowProps {
	userId: string;
	transaction: Transaction;
	transactionIndex: number;
	onTagEditorOpen: (tags: UiTag[], currentIdx: number) => void;
	setTransactions: Dispatch<SetStateAction<Transaction[]>>;
}

const getUpdater = (
	property: keyof Transaction,
	transaction: Transaction,
	valueToUpdate: string,
) => {
	switch (property) {
		case "transactionDate":
			return {
				...transaction,
				transactionDate: valueToUpdate,
			};
		case "description":
			return {
				...transaction,
				description: valueToUpdate,
			};
		case "amount":
			return {
				...transaction,
				amount: parseFloat(valueToUpdate),
			};
		default:
			throw new Error("Cannot update this property");
	}
};

export const AccountCardTransactionRow = ({
	transaction,
	transactionIndex,
	onTagEditorOpen,
	setTransactions,
	userId,
}: TransactionRowProps) => {
	const [editRow, setEditRow] = useState(false);
	const { onError, onSuccess, reset } = useRequestState();
	const router = useRouter();

	const date = new Date(transaction.transactionDate);
	const handleTagChange = (selectedTags: UiTag[]) => {
		setTransactions((existing) =>
			existing.map((txn, idx) => {
				if (transactionIndex === idx) {
					return {
						...txn,
						tags: selectedTags,
					};
				} else {
					return txn;
				}
			}),
		);
	};
	const handleCellChange = (newValue: string, property: keyof Transaction) => {
		setTransactions((existing) =>
			existing.map((txn, idx) => {
				if (transactionIndex === idx) {
					return getUpdater(property, txn, newValue);
				} else {
					return txn;
				}
			}),
		);
	};
	const handleEditClick = () => {
		setEditRow(true);
	};
	const handleSaveRowClick = async () => {
		try {
			const res = await backendRouteClient.api.transaction[":userId"]["$patch"](
				{
					param: { userId },
					json: {
						transactions: [transaction],
					},
				},
			);
			if (res.ok) {
				onSuccess();
				router.invalidate();
				setEditRow(false);
			} else {
				onError(await res.text());
			}
		} catch (error) {
			onError(error);
		}
		reset();
	};
	const handleTagPickerClick = () => {
		onTagEditorOpen(transaction.tags, transactionIndex);
	};
	return (
		<tr>
			<EditableCell
				editing={editRow}
				value={date.toLocaleDateString()}
				onChange={(val) => handleCellChange(val, "transactionDate")}
			/>
			<EditableCell
				editing={editRow}
				value={transaction.description}
				onChange={(val) => handleCellChange(val, "description")}
			/>
			<td>{transaction.currency}</td>
			<EditableCell
				editing={editRow}
				value={transaction.amount}
				onChange={(val) => handleCellChange(val, "amount")}
			/>
			<td>
				<TagTableViewer
					selectedTags={transaction.tags}
					canEdit={editRow}
					onTagChange={handleTagChange}
				/>
			</td>
			<td>
				<TagPicker
					onTagPickerClick={handleTagPickerClick}
					disabled={!editRow}
				/>
			</td>
			<td>
				{editRow ? (
					<button
						type="button"
						className="btn btn-xs btn-secondary"
						onClick={handleSaveRowClick}
					>
						save
					</button>
				) : (
					<button
						type="button"
						className="btn btn-xs btn-primary"
						onClick={handleEditClick}
					>
						edit
					</button>
				)}
			</td>
		</tr>
	);
};
