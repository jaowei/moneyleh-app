import { useRef, useState } from "react";
import type { TransactionSplitUI } from "../lib/backend-clients";

export const useTransactionSplitModal = () => {
	const splitModalRef = useRef<null | HTMLDialogElement>(null);
	// use this if the backend does not send any splits, e.g. when uploading statements
	const [transactionSplits, setTransactionSplits] = useState<
		Map<number, TransactionSplitUI>
	>(new Map());
	const [currentSplit, setCurrentSplit] = useState<
		TransactionSplitUI | undefined
	>();
	const [txnSplitIdx, setTxnSplitIdx] = useState<number[]>([]);
	const handleSplitEditorClose = () => {
		setTxnSplitIdx([]);
		setCurrentSplit(undefined);
		splitModalRef.current?.close();
	};
	const handleSplitEditorOpen = (
		transactionIdxs: number[],
		split?: TransactionSplitUI,
	) => {
		if (transactionIdxs.length === 1) {
			if (split) {
				setCurrentSplit(split);
			} else {
				setCurrentSplit(transactionSplits.get(transactionIdxs[0]));
			}
			setTxnSplitIdx((prev) => {
				prev.push(transactionIdxs[0]);
				return prev;
			});
		} else {
			setTxnSplitIdx(transactionIdxs);
		}
		splitModalRef.current?.showModal();
	};
	const handleSplitEditorChange = (newShare?: TransactionSplitUI) => {
		setTransactionSplits((prev) => {
			txnSplitIdx.forEach((idx) => {
				if (newShare) {
					prev.set(idx, newShare);
				} else {
					prev.delete(idx);
				}
			});
			return prev;
		});
		setCurrentSplit(newShare);
	};
	return {
		splitModalRef,
		currentSplit,
		txnSplitIdx,
		transactionSplits,
		handleSplitEditorChange,
		handleSplitEditorClose,
		handleSplitEditorOpen,
	};
};

export type SplitEditorOpenHandler = ReturnType<
	typeof useTransactionSplitModal
>["handleSplitEditorOpen"];
