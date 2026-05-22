import { useRef, useState } from "react";

export const useAccountCardModal = () => {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [addingError, setAddingError] = useState("");
	const handleModalClose = () => {
		dialogRef.current?.close();
	};
	const handleModalOpen = () => {
		dialogRef.current?.showModal();
	};
	return {
		dialogRef,
		handleModalClose,
		addingError,
		setAddingError,
		handleModalOpen,
	};
};
