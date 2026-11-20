import { useRef, useState } from "react";
import type { UiTag } from "../components/TagPicker";

export const useTagModal = () => {
	const tagModalRef = useRef<null | HTMLDialogElement>(null);
	const [selectedTags, setSelectedTags] = useState<UiTag[]>([]);
	const [indexsEditing, setIndexsEditing] = useState<number[]>([]);
	const [baseTags, setBaseTags] = useState<Map<number, UiTag[]>>(new Map());
	const handleTagEditorOpen = (
		tags: UiTag[],
		transactionIdxs: number[],
		originalTagsByIdx?: Map<number, UiTag[]>,
	) => {
		setIndexsEditing(transactionIdxs);
		setSelectedTags(tags);
		setBaseTags(originalTagsByIdx ?? new Map());
		tagModalRef.current?.showModal();
	};

	const handleTagEditorClose = () => {
		setIndexsEditing([]);
		setSelectedTags([]);
		setBaseTags(new Map());
		tagModalRef.current?.close();
	};
	const handleTagEditorChange = (tags: UiTag[]) => {
		setSelectedTags(tags);
	};
	return {
		tagModalRef,
		selectedTags,
		indexsEditing,
		baseTags,
		handleTagEditorClose,
		handleTagEditorOpen,
		handleTagEditorChange,
	};
};
