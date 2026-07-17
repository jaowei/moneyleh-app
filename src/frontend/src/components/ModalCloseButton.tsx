interface ModalCloseButtonProps {
	onModalClose: () => void;
}

export const ModalCloseTopRightButton = ({
	onModalClose,
}: ModalCloseButtonProps) => (
	<form method="dialog">
		<button
			type="button"
			className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
			onClick={onModalClose}
		>
			✕
		</button>
	</form>
);

export const ModalCloseFooterButton = ({
	onModalClose,
}: ModalCloseButtonProps) => (
	<form method="dialog">
		<button type="button" className="btn btn-error" onClick={onModalClose}>
			Close
		</button>
	</form>
);
