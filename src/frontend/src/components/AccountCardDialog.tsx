import { useRouter } from "@tanstack/react-router";
import { type ChangeEventHandler, useState } from "react";
import type {
	GetCompanyRes,
	PostAccountRes,
	PostCardRes,
} from "../lib/backend-clients";
import {
	type AccountFormProps,
	AddAccountForm,
	AddCardForm,
} from "./AddAccountCardForm";
import { AddButton } from "./AddButton";
import { ModalCloseTopRightButton } from "./ModalCloseButton";

export type Entities = {
	id: number;
	companyName: string;
	name: string;
}[];
interface DialogProps {
	ref: React.Ref<HTMLDialogElement>;
	entityType: "account" | "card";
	companyData: GetCompanyRes["data"];
	userId: string;
	onModalClose: () => void;
	handleSelection: (id: number) => void;
	selectionError: string;
	entitiesToAdd: Entities;
	formInitialValues?: AccountFormProps["initialValues"];
	onFormSuccess?: (created: PostAccountRes | PostCardRes) => void;
}

const AllListModalBox = ({ children }: { children: React.ReactNode }) => {
	return <div className="modal-box max-w-[80vw]">{children}</div>;
};

export const AccountCardDialog = ({
	ref,
	entityType,
	companyData,
	userId,
	onModalClose,
	onFormSuccess,
	entitiesToAdd,
	handleSelection,
	selectionError,
	formInitialValues,
}: DialogProps) => {
	const [searchTerm, setSearchTerm] = useState("");

	const router = useRouter();

	const tableName = entityType === "account" ? "Accounts" : "Cards";

	const filteredEntities = entitiesToAdd.filter((ent) => {
		const targetSearchName = `${ent.companyName.toLowerCase()} ${ent.name.toLowerCase()}`;
		const matchSearchTerm = searchTerm
			? targetSearchName.includes(searchTerm)
			: true;
		return matchSearchTerm;
	});
	const handleEntitySearchInputChange: ChangeEventHandler<HTMLInputElement> = (
		e,
	) => {
		setSearchTerm(e.target.value.toLowerCase());
	};
	const handleAddEntityClick = (accountId: number) => {
		handleSelection(accountId);
	};
	const handleFormSuccess = (created: PostAccountRes | PostCardRes) => {
		onFormSuccess?.(created);
		router.invalidate();
	};
	return (
		<dialog ref={ref} className="modal">
			<AllListModalBox>
				<ModalCloseTopRightButton onModalClose={onModalClose} />
				<input
					className="input"
					placeholder="search accounts"
					onChange={handleEntitySearchInputChange}
				/>
				{entityType === "account" ? (
					<AddAccountForm
						companies={companyData}
						userId={userId}
						onFormSubmitSuccess={handleFormSuccess}
						initialValues={formInitialValues}
					/>
				) : (
					<AddCardForm
						companies={companyData}
						userId={userId}
						onFormSubmitSuccess={handleFormSuccess}
						initialValues={formInitialValues}
					/>
				)}
				<table className="table">
					<thead>
						<tr>
							<th colSpan={3} align="center">
								{tableName}
							</th>
						</tr>
					</thead>
					<thead>
						<tr>
							<th>Company name</th>
							<th>{tableName} name</th>
							<th>Add</th>
						</tr>
					</thead>
					<tbody>
						{filteredEntities.map((acc) => (
							<tr key={acc.id}>
								<td>{acc.companyName}</td>
								<td>{acc.name}</td>
								<td>
									<AddButton onClick={() => handleAddEntityClick(acc.id)} />
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{selectionError && (
					<div className="alert alert-error">{selectionError}</div>
				)}
				<div className="modal-action">
					<form method="dialog">
						<button type="button" className="btn" onClick={onModalClose}>
							Close
						</button>
					</form>
				</div>
			</AllListModalBox>
		</dialog>
	);
};
