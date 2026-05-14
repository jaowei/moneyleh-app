import { useRouter } from "@tanstack/react-router";
import { type Dispatch, type SetStateAction, useState } from "react";
import { useAuth } from "../context/auth.tsx";
import { useRequestState } from "../hooks/useRequestState.ts";
import { useTagModal } from "../hooks/useTagModal.ts";
import {
	backendRouteClient,
	type FileUploadRes,
	type GetCompanyRes,
	type Tag,
} from "../lib/backend-clients.ts";
import { AddAccountForm, AddCardForm } from "./AddAccountCardForm.tsx";
import { TagPicker, TagPickerModal, type UiTag } from "./TagPicker.tsx";
import { TagTableViewer } from "./TagTableViewer.tsx";

interface TransactionViewerProps {
	userId: string;
	fileUploadRes: FileUploadRes;
	tagData: Tag[];
	companies: GetCompanyRes["data"];
}

interface TransactionViewerTabContentProps extends TransactionViewerProps {
	transactions: FileUploadRes["taggedTransactions"][0];
	idx: number;
}

interface TransactionsTableProps {
	transactions: FileUploadRes["taggedTransactions"][0];
	statementInfo: FileUploadRes["statementInfo"];
	accountInfo?: FileUploadRes["accountInfo"][0];
	cardInfo?: FileUploadRes["cardInfo"][0];
	onSaveSuccess?: () => void;
	tagData: Tag[];
	saveDisabled: boolean;
}

interface TransactionRowProps {
	transaction: FileUploadRes["taggedTransactions"][0][0];
	transactionIndex: number;
	canEdit: boolean;
	onTagEditorOpen: (tags: UiTag[], currentIdx: number) => void;
	setTransactions: Dispatch<
		SetStateAction<FileUploadRes["taggedTransactions"][0]>
	>;
}

const TransactionViewerRow = ({
	transaction,
	setTransactions,
	transactionIndex,
	canEdit,
	onTagEditorOpen,
}: TransactionRowProps) => {
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
	const handleTagPickerClick = () => {
		onTagEditorOpen(transaction.tags, transactionIndex);
	};
	return (
		<tr>
			<td>{date.toLocaleDateString()}</td>
			<td>{transaction.description}</td>
			<td>{transaction.currency}</td>
			<td>{transaction.amount}</td>
			<td>
				<TagTableViewer
					selectedTags={transaction.tags}
					canEdit={canEdit}
					onTagChange={handleTagChange}
				/>
			</td>
			<td>
				<TagPicker onTagPickerClick={handleTagPickerClick} />
			</td>
		</tr>
	);
};

const TransactionViewerTable = ({
	transactions,
	statementInfo,
	accountInfo,
	cardInfo,
	tagData,
	onSaveSuccess,
	saveDisabled,
}: TransactionsTableProps) => {
	const { user } = useAuth();
	const [editableTransactions, setEditableTransactions] =
		useState(transactions);
	const { requestSuccess, error, onSuccess, onError, reset } =
		useRequestState();
	const {
		tagModalRef,
		selectedTags,
		handleTagEditorChange,
		handleTagEditorClose,
		handleTagEditorOpen,
		indexEditing,
	} = useTagModal();

	const userId = user?.id;
	const name =
		transactions[0]?.accountName ||
		accountInfo?.accountName ||
		cardInfo?.cardName;
	const handleSaveTransactionsClick = async () => {
		reset();
		try {
			const res = await backendRouteClient.api.transaction.$post({
				json: {
					transactions: editableTransactions,
					statementInfo,
					cardInfo,
					accountInfo,
				},
			});
			if (!res.ok) {
				onError(await res.text());
			} else {
				onSaveSuccess?.();
				onSuccess();
			}
		} catch (e) {
			onError(e);
		}
	};
	if (!userId) {
		return <div>Please sign in again</div>;
	}

	const handleTagChange = (selectedTags: UiTag[]) => {
		setEditableTransactions((existing) =>
			existing.map((txn, idx) => {
				if (indexEditing === idx) {
					return {
						...txn,
						tags: selectedTags,
					};
				} else {
					return txn;
				}
			}),
		);
		handleTagEditorChange(selectedTags);
	};

	return (
		<div className="flex flex-col w-full h-full items-center justify-center gap-4">
			<button
				type="button"
				className="btn btn-primary"
				disabled={
					saveDisabled || requestSuccess || !editableTransactions.length
				}
				onClick={handleSaveTransactionsClick}
			>
				Save transactions for {name}
			</button>
			{error && (
				<div role="alert" className="alert alert-error">
					<span>{error}</span>
				</div>
			)}
			<table className="table table-zebra table-xs">
				<thead>
					<tr>
						<th>Transaction Date</th>
						<th>Description</th>
						<th>Currency</th>
						<th>Amount</th>
						<th>Tag</th>
						<th>Edit Tags</th>
					</tr>
				</thead>
				<tbody>
					{editableTransactions.map((t, idx) => {
						return (
							<TransactionViewerRow
								key={t.id}
								transaction={t}
								setTransactions={setEditableTransactions}
								transactionIndex={idx}
								canEdit={!requestSuccess}
								onTagEditorOpen={handleTagEditorOpen}
							/>
						);
					})}
				</tbody>
			</table>
			<TagPickerModal
				ref={tagModalRef}
				availableTags={tagData}
				selectedTags={selectedTags}
				onModalClose={handleTagEditorClose}
				onTagChange={handleTagChange}
			/>
		</div>
	);
};

const TabContent = ({
	fileUploadRes,
	idx,
	transactions,
	companies,
	tagData,
	userId,
}: TransactionViewerTabContentProps) => {
	const router = useRouter();
	const { statementInfo, accountInfo, cardInfo, companyId } = fileUploadRes;
	const [isNewCardAccount, setIsNewCardAccount] = useState(
		accountInfo[idx]?.accountId === undefined &&
			cardInfo[idx]?.cardId === undefined,
	);
	const handleSubmitSuccess = async () => {
		router.invalidate();
		setIsNewCardAccount(false);
	};
	const isCard = cardInfo[idx]?.cardName;
	const isAccount = accountInfo[idx]?.accountName;
	const name =
		transactions[0]?.accountName ||
		accountInfo[idx]?.accountName ||
		cardInfo[idx]?.cardName;
	const formInitialValues = {
		name,
		companyId: `${companyId}`,
	};
	return (
		<>
			<input
				type="radio"
				name="transactions-tabs"
				className="tab"
				aria-label={`${name}`}
				defaultChecked={idx === 0}
			/>
			<div className="tab-content border-base-300 bg-base-100 p-10 max-h-[65vh] overflow-auto">
				{isNewCardAccount && (
					<div>
						<h2 className="text-2xl">New account/card detected</h2>
						<p>
							{name} has not been added to your inventory yet, would you like to
							add it?
						</p>
						{isCard && (
							<AddCardForm
								companies={companies}
								userId={userId}
								onFormSubmitSucess={handleSubmitSuccess}
								initialValues={formInitialValues}
							/>
						)}
						{isAccount && (
							<AddAccountForm
								companies={companies}
								userId={userId}
								onFormSubmitSucess={handleSubmitSuccess}
								initialValues={formInitialValues}
							/>
						)}
					</div>
				)}
				<TransactionViewerTable
					transactions={transactions}
					statementInfo={statementInfo}
					accountInfo={accountInfo[idx]}
					cardInfo={cardInfo[idx]}
					tagData={tagData}
					saveDisabled={isNewCardAccount}
				/>
			</div>
		</>
	);
};

export default function UploadViewer({
	fileUploadRes,
	tagData,
	companies,
	userId,
}: TransactionViewerProps) {
	return (
		<div className="tabs tabs-border">
			{fileUploadRes.taggedTransactions.map((transactionsPerAccount, idx) => {
				const uniqueKey =
					fileUploadRes.accountInfo[idx].accountName ||
					fileUploadRes.cardInfo[idx].cardName;
				return (
					<TabContent
						key={uniqueKey}
						fileUploadRes={fileUploadRes}
						tagData={tagData}
						companies={companies}
						userId={userId}
						transactions={transactionsPerAccount}
						idx={idx}
					/>
				);
			})}
		</div>
	);
}
