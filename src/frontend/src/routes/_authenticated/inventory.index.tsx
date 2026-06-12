import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import type React from "react";
import { useRef, useState } from "react";
import {
	AccountCardDialog,
	type Entities,
} from "../../components/AccountCardDialog.tsx";
import BulkUploadModal from "../../components/BulkUploadModal.tsx";
import {
	DeleteAccountCardButton,
	DeleteAccountCardModal,
} from "../../components/DeleteAccountCard.tsx";
import { DismissableAlert } from "../../components/DismissableAlert.tsx";
import { useAccountCardModal } from "../../hooks/useAccountCardModal.ts";
import {
	type AllAccounts,
	type AllCards,
	type AvailableInventoryResponse,
	fetchCompanies,
	fetchTagData,
	type GetCompanyRes,
	uiRouteClient,
} from "../../lib/backend-clients.ts";
import { getBackendErrorResponse } from "../../lib/error.ts";

export const Route = createFileRoute("/_authenticated/inventory/")({
	component: InventoryComponent,
	loader: async ({ context: { auth } }) => {
		const userId = auth?.user?.id;

		if (!userId) throw new Error();

		let inventory: AvailableInventoryResponse;

		const allInventoryRes = await uiRouteClient.availableInventory[
			":userId"
		].$get({
			param: { userId },
		});
		if (allInventoryRes.ok) {
			inventory = await allInventoryRes.json();
		} else {
			throw await getBackendErrorResponse(allInventoryRes);
		}

		const tagData = await fetchTagData();
		const companyData = await fetchCompanies();

		return {
			inventory,
			tagData,
			companyData,
			userId,
		};
	},
});

const AllAccountsList = ({
	allAccounts,
	companyData,
}: {
	allAccounts: AllAccounts;
	companyData: GetCompanyRes["data"];
}) => {
	const { auth } = Route.useRouteContext();
	const {
		dialogRef: accountsListDialogRef,
		addingError,
		setAddingError,
		handleModalClose,
		handleModalOpen,
	} = useAccountCardModal();
	const userId = auth?.user?.id;
	if (!userId) throw new Error("No user id");

	const router = useRouter();

	const filteredAccounts: Entities = [];
	for (const acc of allAccounts) {
		const hasAccount = acc.accounts;
		const isUserAccount = !!acc.user_accounts;
		if (hasAccount && !isUserAccount) {
			filteredAccounts.push({
				id: hasAccount.id,
				companyName: acc.companies.name,
				name: hasAccount.name,
			});
		}
	}

	const handleAddAccountClick = async (accountId: number) => {
		const res = await uiRouteClient.assignTo[":userId"].$post({
			param: { userId },
			json: {
				accountData: [
					{
						accountId,
						userId,
					},
				],
			},
		});
		if (res.ok) {
			accountsListDialogRef.current?.close();
			router.invalidate();
		} else {
			setAddingError(res.statusText);
		}
	};
	return (
		<>
			<button
				type="button"
				className="btn btn-sm btn-accent"
				onClick={handleModalOpen}
			>
				Add accounts
			</button>
			<AccountCardDialog
				ref={accountsListDialogRef}
				entityType="account"
				companyData={companyData}
				userId={userId}
				onModalClose={handleModalClose}
				handleSelection={handleAddAccountClick}
				entitiesToAdd={filteredAccounts}
				selectionError={addingError}
			/>
		</>
	);
};

const AllCardsList = ({
	allCards,
	companyData,
}: {
	allCards: AllCards;
	companyData: GetCompanyRes["data"];
}) => {
	const { auth } = Route.useRouteContext();
	const router = useRouter();

	const {
		dialogRef: cardsListDialogRef,
		addingError,
		setAddingError,
		handleModalClose,
		handleModalOpen,
	} = useAccountCardModal();
	const userId = auth?.user?.id;
	if (!userId) throw new Error("No user id");

	const filteredCards: Entities = [];
	for (const card of allCards) {
		const hasCard = card.cards;
		const isUserCard = !!card.user_cards;
		if (hasCard && !isUserCard) {
			filteredCards.push({
				id: hasCard.id,
				companyName: card.companies.name,
				name: hasCard.name,
			});
		}
	}

	const handleAddCardClick = async (cardId: number) => {
		const res = await uiRouteClient.assignTo[":userId"].$post({
			param: { userId },
			json: {
				cardData: [
					{
						cardId,
						userId,
					},
				],
			},
		});
		if (res.ok) {
			cardsListDialogRef.current?.close();
			router.invalidate();
		} else {
			setAddingError(res.statusText);
		}
	};

	return (
		<div className="flex flex-col gap-2">
			<button
				type="button"
				className="btn btn-sm btn-accent"
				onClick={handleModalOpen}
			>
				Add cards
			</button>
			<AccountCardDialog
				ref={cardsListDialogRef}
				entityType="card"
				companyData={companyData}
				userId={userId}
				onModalClose={handleModalClose}
				handleSelection={handleAddCardClick}
				entitiesToAdd={filteredCards}
				selectionError={addingError}
			/>
		</div>
	);
};

const TableRow = ({ children }: { children: React.ReactNode }) => {
	return <td className="overflow-y-auto">{children}</td>;
};
const TableRowAmount = ({ children }: { children: number }) => {
	const amount = new Intl.NumberFormat("en-sg", {
		style: "currency",
		currency: "SGD",
	}).format(children);
	return <td className="overflow-y-auto text-primary font-bold">{amount}</td>;
};

function InventoryComponent() {
	const { inventory, tagData, companyData, userId } = Route.useLoaderData();
	const [bulkUploadAlert, setBulkUploadAlert] = useState<string | undefined>();
	const [deleteMsgError, setDeleteMsgError] = useState<string | undefined>();
	const [deleteMsgSuccess, setDeleteMsgSuccess] = useState<
		string | undefined
	>();
	const [cardIdToDelete, setCardIdToDelete] = useState<number | undefined>();
	const [accountIdToDelete, setAccountIdToDelete] = useState<
		number | undefined
	>();
	const warningModalRef = useRef<null | HTMLDialogElement>(null);

	const handleBulkUploadSuccess = (name?: string) => {
		if (name) {
			setBulkUploadAlert(`Upload success for ${name}`);
		}
	};

	const handleBulkUploadAlertDismiss = () => {
		setBulkUploadAlert(undefined);
	};
	const handleDeleteAlertDismiss = () => {
		setDeleteMsgError(undefined);
		setDeleteMsgSuccess(undefined);
	};

	const handleDeleteSuccess = (msg: string) => {
		setDeleteMsgSuccess(msg);
	};
	const handleDeleteError = (msg: string) => {
		setDeleteMsgError(msg);
	};
	const handleDelete = (cardId?: number, accountId?: number) => {
		warningModalRef.current?.showModal();
		setCardIdToDelete(cardId);
		setAccountIdToDelete(accountId);
	};

	return (
		<div className="flex flex-col items-center p-4">
			<div className="w-full xl:w-4/5">
				{bulkUploadAlert && (
					<div className="p-2">
						<DismissableAlert
							message={bulkUploadAlert}
							onDismiss={handleBulkUploadAlertDismiss}
							type="success"
						/>
					</div>
				)}
				{deleteMsgError && (
					<div className="p-2">
						<DismissableAlert
							message={deleteMsgError}
							onDismiss={handleDeleteAlertDismiss}
							type="error"
						/>
					</div>
				)}
				{deleteMsgSuccess && (
					<div className="p-2">
						<DismissableAlert
							message={deleteMsgSuccess}
							onDismiss={handleDeleteAlertDismiss}
							type="success"
						/>
					</div>
				)}
				<div className="rounded-box border border-base-content/5 bg-base-100">
					<table className="table table-fixed">
						<thead className="bg-base-200">
							<tr>
								<th colSpan={4} align="center">
									<div className="flex flex-row justify-between items-center">
										<h2 className="font-bold">Accounts</h2>
										<AllAccountsList
											allAccounts={inventory.allAccounts}
											companyData={companyData}
										/>
									</div>
								</th>
							</tr>
						</thead>
						<thead>
							<tr>
								<th>Company name</th>
								<th>Account name</th>
								<th>Total</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{inventory.userAccounts.map((acc) => (
								<tr key={acc.accounts?.id}>
									<TableRow>{acc.companies.name}</TableRow>
									<TableRow>{acc.accounts?.name}</TableRow>
									<TableRowAmount>{acc.total}</TableRowAmount>
									<TableRow>
										<div className="flex flex-row gap-1">
											{acc.accounts?.id && (
												<Link
													to="/inventory/$type/$id"
													params={{
														id: `${acc.accounts.id}`,
														type: "account",
													}}
												>
													<button
														type="button"
														className="btn btn-xs btn-primary"
													>
														View
													</button>
												</Link>
											)}
											<BulkUploadModal
												accountName={acc.accounts?.name}
												accountId={acc.accounts?.id}
												tagData={tagData}
												onAddSuccess={handleBulkUploadSuccess}
											/>
											{acc.accounts?.id && (
												<DeleteAccountCardButton
													accountId={acc.accounts.id}
													onDelete={handleDelete}
												/>
											)}
										</div>
									</TableRow>
								</tr>
							))}
						</tbody>
					</table>
					<table className="table table-fixed">
						<thead className="bg-base-200">
							<tr>
								<th colSpan={4} align="center">
									<div className="flex flex-row justify-between items-center">
										<h2 className="font-bold">Cards</h2>
										<AllCardsList
											allCards={inventory.allCards}
											companyData={companyData}
										/>
									</div>
								</th>
							</tr>
						</thead>
						<thead>
							<tr>
								<th>Company name</th>
								<th>Card name</th>
								<th>Total</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{inventory.userCards.map((card) => (
								<tr key={card.cards?.id}>
									<TableRow>{card.companies.name}</TableRow>
									<TableRow>{card.cards?.name}</TableRow>
									<TableRowAmount>{card.total}</TableRowAmount>
									<TableRow>
										<div className="flex flex-row gap-1">
											{card.cards?.id && (
												<Link
													to="/inventory/$type/$id"
													params={{
														id: `${card.cards.id}`,
														type: "card",
													}}
												>
													<button
														type="button"
														className="btn btn-xs btn-primary"
													>
														View
													</button>
												</Link>
											)}
											<BulkUploadModal
												cardName={card.cards?.name}
												cardId={card.cards?.id}
												tagData={tagData}
												onAddSuccess={handleBulkUploadSuccess}
											/>
											{card.cards?.id && (
												<DeleteAccountCardButton
													cardId={card.cards.id}
													onDelete={handleDelete}
												/>
											)}
										</div>
									</TableRow>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<DeleteAccountCardModal
					ref={warningModalRef}
					userId={userId}
					accountId={accountIdToDelete}
					cardId={cardIdToDelete}
					onError={handleDeleteError}
					onSuccess={handleDeleteSuccess}
				/>
			</div>
		</div>
	);
}
