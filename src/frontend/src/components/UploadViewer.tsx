import { useRouter } from "@tanstack/react-router";
import { type Dispatch, type SetStateAction, useState } from "react";
import { useAuth } from "../context/auth.tsx";
import { useAccountCardModal } from "../hooks/useAccountCardModal.ts";
import { useRequestState } from "../hooks/useRequestState.ts";
import { useTagModal } from "../hooks/useTagModal.ts";
import {
	backendRouteClient,
	type FileUploadRes,
	type GetCompanyRes,
	type PostAccountRes,
	type PostCardRes,
	type Tag,
	uiRouteClient,
} from "../lib/backend-clients.ts";
import { getBackendErrorResponse } from "../lib/error.ts";
import { AccountCardDialog } from "./AccountCardDialog.tsx";
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
	statementInfo: Omit<FileUploadRes["statementInfo"], "statementOwnerIds"> & {
		statementOwnershipId: number | null | undefined;
	};
	accountInfo?: FileUploadRes["accountInfo"][0];
	cardInfo?: FileUploadRes["cardInfo"][0];
	onSaveSuccess?: () => void;
	tagData: Tag[];
	saveDisabled: boolean;
	companyId: number;
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
	companyId,
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
		if (!statementInfo.statementOwnershipId) throw new Error();
		reset();
		try {
			const res = await backendRouteClient.api.transaction.$post({
				json: {
					transactions: editableTransactions,
					statementInfo: {
						...statementInfo,
						statementOwnershipId: statementInfo.statementOwnershipId,
					},
					cardInfo,
					accountInfo,
					companyId,
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
	const {
		statementInfo,
		accountInfo,
		cardInfo,
		companyId,
		availableAccounts,
		availableCards,
	} = fileUploadRes;

	const {
		dialogRef,
		setAddingError,
		addingError,
		handleModalClose,
		handleModalOpen,
	} = useAccountCardModal();

	const statementIsNotLinked = !statementInfo.statementOwnerIds[idx];
	const [isUnlinked, setIsUnlinked] = useState(statementIsNotLinked);
	const [newStatementOwnerId, setNewStatementOwnerId] = useState<number>();
	const [entitiesToLink, setEntitiesToLink] = useState(
		availableAccounts[idx] || availableCards[idx] || [],
	);

	const isCard = cardInfo[idx]?.cardName;
	const isAccount = accountInfo[idx]?.accountName;
	const title = isCard ? "Card" : "Account";
	const name =
		transactions[0]?.accountName ||
		accountInfo[idx]?.accountName ||
		cardInfo[idx]?.cardName;
	const initialValues = {
		name,
		companyId: `${companyId}`,
	};

	const handleDialogAddClick = async (id: number) => {
		const data = isAccount
			? { accountData: [{ accountId: id, userId }] }
			: { cardData: [{ cardId: id, userId }] };
		const assignRes = await uiRouteClient.assignTo[":userId"].$post({
			param: { userId },
			json: data,
		});
		const linkRes = await uiRouteClient.linkStatement.$post({
			json: {
				identifier: name,
				...(isAccount ? { accountId: id } : { cardId: id }),
			},
		});
		if (assignRes.ok && linkRes.ok) {
			dialogRef.current?.close();
			router.invalidate();
			setIsUnlinked(false);
			const linked = await linkRes.json();
			setNewStatementOwnerId(linked.data.id);
		} else if (!assignRes.ok) {
			setAddingError((await getBackendErrorResponse(assignRes)).message);
		} else {
			setAddingError((await getBackendErrorResponse(linkRes)).message);
		}
	};

	const handleLinkFormSuccess = (created: PostAccountRes | PostCardRes) => {
		const { id, name, companyId } = created;
		const targetCompany = companies.find((company) => company.id === companyId);
		if (!targetCompany) throw new Error("Could not find company");
		const companyName = targetCompany.name;
		const newEntity = { id, name, companyName };
		setEntitiesToLink((prev) => [...prev, newEntity]);
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
				{isUnlinked && (
					<div>
						<h2 className="text-2xl">New {title} detected</h2>
						<p>
							{name} is not associated with any {title}, link to existing or
							create a new {title}
						</p>
						<button
							type="button"
							className="btn btn-sm btn-accent"
							onClick={handleModalOpen}
						>
							Link or add {title}
						</button>
					</div>
				)}
				<TransactionViewerTable
					transactions={transactions}
					statementInfo={{
						statementDate: statementInfo.statementDate,
						statementOwnershipId:
							statementInfo.statementOwnerIds[idx] || newStatementOwnerId,
					}}
					accountInfo={accountInfo[idx]}
					cardInfo={cardInfo[idx]}
					tagData={tagData}
					saveDisabled={isUnlinked}
					companyId={companyId}
				/>
				<AccountCardDialog
					ref={dialogRef}
					entityType={isAccount ? "account" : "card"}
					companyData={companies}
					userId={userId}
					onModalClose={handleModalClose}
					handleSelection={handleDialogAddClick}
					entitiesToAdd={entitiesToLink}
					selectionError={addingError}
					formInitialValues={initialValues}
					onFormSuccess={handleLinkFormSuccess}
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
					fileUploadRes.accountInfo[idx]?.accountName ||
					fileUploadRes.cardInfo[idx]?.cardName;
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
