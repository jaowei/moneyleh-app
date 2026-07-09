import { useRef, useState } from "react";
import type { UiTag } from "../components/TagPicker";

export const useTagModal = () => {
	const tagModalRef = useRef<null | HTMLDialogElement>(null);
	const [selectedTags, setSelectedTags] = useState<UiTag[]>([]);
	const [indexsEditing, setIndexsEditing] = useState<number[]>([]);
	const handleTagEditorOpen = (tags: UiTag[], transactionIdxs: number[]) => {
		setIndexsEditing(transactionIdxs);
		setSelectedTags(tags);
		tagModalRef.current?.showModal();
	};

	const handleTagEditorClose = () => {
		setIndexsEditing([]);
		setSelectedTags([]);
		tagModalRef.current?.close();
	};
	const handleTagEditorChange = (tags: UiTag[]) => {
		setSelectedTags(tags);
	};
	return {
		tagModalRef,
		selectedTags,
		indexsEditing,
		handleTagEditorClose,
		handleTagEditorOpen,
		handleTagEditorChange,
	};
};
