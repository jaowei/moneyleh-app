import { useRouter } from "@tanstack/react-router";
import { type Dispatch, type SetStateAction, useState } from "react";
import type { SplitEditorOpenHandler } from "../hooks/useTransactionSplitModal";
import {
	backendRouteClient,
	type GetTransactionDataRes,
} from "../lib/backend-clients";
import {
	type EditableTransactionField,
	editableFields,
	editableFieldTypes,
	updateEditableField,
} from "../lib/editable-fields";
import { EditableCell } from "./EditableCell";
import { TagPicker, type UiTag } from "./TagPicker";
import { TagTableViewer } from "./TagTableViewer";
import { TransactionSplitButton } from "./TransactionSplit";

type Transaction = GetTransactionDataRes["transactions"][0];

interface TransactionRowProps {
	userId: string;
	transaction: Transaction;
	transactionIndex: number;
	onTagEditorOpen: (tags: UiTag[], currentIdxs: number[]) => void;
	onTransactionSplitOpen: SplitEditorOpenHandler;
	setTransactions: Dispatch<SetStateAction<Transaction[]>>;
	onActionError: (msg: string) => void;
	onActionSuccess: (msg: string) => void;
}

export const AccountCardTransactionRow = ({
	userId,
	transaction,
	transactionIndex,
	onTagEditorOpen,
	onTransactionSplitOpen,
	setTransactions,
	onActionError,
	onActionSuccess,
}: TransactionRowProps) => {
	const [editRow, setEditRow] = useState(false);
	const router = useRouter();

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
	const handleCellChange = (
		rawValue: string,
		field: EditableTransactionField,
	) => {
		setTransactions((existing) =>
			existing.map((txn, idx) =>
				transactionIndex === idx
					? updateEditableField(txn, field, rawValue)
					: txn,
			),
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
	const handleSplitModalClick = () => {
		onTransactionSplitOpen([transactionIndex], transaction.split);
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
			{editableFields.map((field) => (
				<EditableCell
					key={field}
					editing={editRow}
					type={editableFieldTypes[field]}
					value={transaction[field]}
					onChange={(val) => handleCellChange(val, field)}
				/>
			))}
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
				<TransactionSplitButton
					onClick={handleSplitModalClick}
					disabled={!editRow}
					hasSplit={!!transaction.split?.share}
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
