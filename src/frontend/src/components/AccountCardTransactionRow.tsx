import { useRouter } from "@tanstack/react-router";
import { type Dispatch, type SetStateAction, useState } from "react";
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
	onTagEditorOpen: (tags: UiTag[], currentIdxs: number[]) => void;
	setTransactions: Dispatch<SetStateAction<Transaction[]>>;
	onActionError: (msg: string) => void;
	onActionSuccess: (msg: string) => void;
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
	onActionError,
	onActionSuccess,
}: TransactionRowProps) => {
	const [editRow, setEditRow] = useState(false);
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
			const res = await backendRouteClient.api.transaction[":userId"].$patch({
				param: { userId },
				json: {
					transactions: [transaction],
				},
			});
			if (res.ok) {
				router.invalidate();
				setEditRow(false);
				onActionSuccess(`Row edited!`);
			} else {
				const errText = await res.text();
				onActionError(`Failed to edit: ${errText}`);
			}
		} catch (error) {
			onActionError(`Failed to edit: ${error}`);
		}
	};
	const handleTagPickerClick = () => {
		onTagEditorOpen(transaction.tags, [transactionIndex]);
	};
	const handleDeleteRowClick = async () => {
		try {
			const res = await backendRouteClient.api.transaction[":userId"][
				":transactionId"
			].$delete({
				param: {
					userId,
					transactionId: `${transaction.id}`,
				},
			});
			if (res.ok) {
				router.invalidate();
				setTransactions((existing) => {
					return existing.filter((t) => t.id !== transaction.id);
				});
				onActionSuccess("Row deleted!");
			} else {
				const errText = await res.text();
				onActionError(`Error deleting row: ${errText}`);
			}
		} catch (error) {
			onActionError(`Error deleting row: ${error}`);
		}
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
					forTable
				/>
			</td>
			<td>
				<div className="flex flex-row gap-2">
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
					<button
						type="button"
						className="btn btn-xs btn-error"
						onClick={handleDeleteRowClick}
					>
						delete
					</button>
				</div>
			</td>
		</tr>
	);
};
