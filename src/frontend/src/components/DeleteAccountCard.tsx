import { useRouter } from "@tanstack/react-router";
import { backendRouteClient } from "../lib/backend-clients";
import { ModalCloseTopRightButton } from "./ModalCloseButton";

interface DeleteAccountCardModalProps {
	ref: React.RefObject<HTMLDialogElement | null>;
	userId: string;
	onSuccess: (msg: string) => void;
	onError: (msg: string) => void;
	cardId?: number;
	accountId?: number;
}

interface DeleteAccountCardButtonProps {
	onDelete: (cardId?: number, accountId?: number) => void;
	cardId?: number;
	accountId?: number;
}

export const DeleteAccountCardModal = ({
	ref,
	onError,
	onSuccess,
	userId,
	cardId,
	accountId,
}: DeleteAccountCardModalProps) => {
	const router = useRouter();
	const handleClick = async () => {
		let res: { ok: boolean };
		try {
			if (cardId) {
				res = await backendRouteClient.api.card[":userId"][":cardId"].$delete({
					param: { userId, cardId: `${cardId}` },
				});
			} else if (accountId) {
				res = await backendRouteClient.api.account[":userId"][
					":accountId"
				].$delete({
					param: { userId, accountId: `${accountId}` },
				});
			} else {
				res = { ok: false };
			}
		} catch (error) {
			onError(`Error deleting: ${error}`);
			ref.current?.close();
			return;
		}

		if (res?.ok) {
			onSuccess(
				`Successfully deleted ${cardId ? "card" : "account"} with id: ${cardId || accountId}`,
			);
			router.invalidate();
		} else {
			onError(
				`Could not delete ${cardId ? "card" : "account"} with id: ${cardId || accountId}`,
			);
		}
		ref.current?.close();
	};
	const handleModalClose = () => {
		ref.current?.close();
	};
	return (
		<dialog ref={ref} className="modal">
			<div className="modal-box">
				<p>
					<p className="font-bold text-error">Warning!</p> This action will
					remove all transactions
				</p>
				<div className="modal-action">
					<button type="button" className="btn btn-error" onClick={handleClick}>
						Confirm deletion
					</button>
				</div>
				<ModalCloseTopRightButton onModalClose={handleModalClose} />
			</div>
		</dialog>
	);
};

export const DeleteAccountCardButton = ({
	cardId,
	accountId,
	onDelete,
}: DeleteAccountCardButtonProps) => {
	const handleClick = async () => {
		onDelete(cardId, accountId);
	};
	return (
		<button
			type="button"
			className="btn btn-xs btn-error"
			onClick={handleClick}
		>
			Delete
		</button>
	);
};
