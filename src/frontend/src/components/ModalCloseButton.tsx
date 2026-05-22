export const ModalCloseButton = ({
	onModalClose,
}: {
	onModalClose: () => void;
}) => (
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
