import { useRouter } from "@tanstack/react-router";
import React, { type ChangeEvent, useState } from "react";
import { backendRouteClient, type Tag } from "../lib/backend-clients.ts";

export type UiTag = Pick<Tag, "id" | "description">;

interface TagModalProps {
	ref: React.RefObject<HTMLDialogElement | null>;
	onTagChange: (selectedTags: UiTag[]) => void;
	onModalClose: () => void;
	selectedTags: UiTag[];
	availableTags: UiTag[];
}

interface TagPickerProps {
	onTagPickerClick: () => void;
	disabled?: boolean;
}

const tagTableStyle = "table table-zebra table-xs border border-base";

const tagFilter = (searchQuery: string) => {
	return (tag: UiTag) => {
		const cleanStr = tag.description.toLowerCase().trim();
		return cleanStr.includes(searchQuery);
	};
};

const TableHeader = ({ title }: { title: string }) => {
	return (
		<thead>
			<tr>
				<th className="font-bold">{title}</th>
			</tr>
			<tr>
				<th>Tag Name</th>
				<th>Selected</th>
			</tr>
		</thead>
	);
};

const sortRemainingTags = (
	tags: UiTag[],
	lastTouchedIds: Set<number>,
): UiTag[] => {
	const remaining = tags.filter((tag) => !lastTouchedIds.has(tag.id));
	const lastTouched = tags
		.filter((tag) => lastTouchedIds.has(tag.id))
		.reverse();
	return [...lastTouched, ...remaining];
};

export const TagPickerModal = ({
	ref,
	selectedTags,
	availableTags,
	onTagChange,
	onModalClose,
}: TagModalProps) => {
	const [newTagName, setNewTagName] = useState("");
	const [tagSearchQuery, setTagSearchQuery] = useState("");
	const [tagCreationError, setTagCreationError] = useState("");
	const [lastTouchedTagIds, setLastTouchedTagIds] = useState<Set<number>>(
		new Set(),
	);

	const router = useRouter();

	const remainingTags = availableTags.filter(
		(tag) => !selectedTags.find((t) => t.id === tag.id),
	);
	const sortedRemainingTags = sortRemainingTags(
		remainingTags,
		lastTouchedTagIds,
	);
	const filteredSelectedTags = tagSearchQuery
		? selectedTags.filter(tagFilter(tagSearchQuery))
		: selectedTags;
	const filteredRemainingTags = tagSearchQuery
		? sortedRemainingTags.filter(tagFilter(tagSearchQuery))
		: sortedRemainingTags;

	const handleCreateTagClick = async () => {
		const res = await backendRouteClient.api.tag.$post({
			json: { tags: [{ description: newTagName }] },
		});
		if (res.ok) {
			const createdTag = (await res.json()).created;
			const newTags = [
				...selectedTags,
				{ id: createdTag[0].id, description: createdTag[0].description },
			];
			onTagChange(newTags);
			setNewTagName("");
			router.invalidate();
		} else {
			setTagCreationError(res.statusText);
		}
	};

	const handleCheckboxSelect = (tag: UiTag) => {
		return (e: ChangeEvent<HTMLInputElement>) => {
			setLastTouchedTagIds((prev) => {
				if (prev.size >= 5) {
					const lastItem = [...prev].shift();
					if (lastItem) {
						prev.delete(lastItem);
					}
				}
				prev.add(tag.id);
				return prev;
			});
			if (!e.target.checked) {
				// unchecking, remove tag
				const newTags = selectedTags.filter(
					(existingTag) => tag.id !== existingTag.id,
				);
				onTagChange(newTags);
			} else {
				// checking, add tag
				const newTags = [...selectedTags, tag];
				onTagChange(newTags);
			}
		};
	};

	const handleNewTagNameInput = (e: ChangeEvent<HTMLInputElement>) => {
		setNewTagName(e.target.value);
	};

	const handleSearchInput = (e: ChangeEvent<HTMLInputElement>) => {
		setTagSearchQuery(e.target.value);
	};
	return (
		<dialog ref={ref} className="modal">
			<div className="modal-box max-w-[75vw] min-h-[90vh]">
				<div className="flex w-full flex-col gap-4">
					<div className="flex flex-row items-center gap-4">
						<fieldset className="fieldset">
							<div className="join">
								<input
									type="text"
									className="input join-item"
									placeholder="Add new tags"
									value={newTagName}
									onChange={handleNewTagNameInput}
								/>
								<button
									type="button"
									className="btn join-item"
									disabled={!newTagName}
									onClick={handleCreateTagClick}
								>
									Add tag
								</button>
							</div>
							{tagCreationError && <p>{tagCreationError}</p>}
						</fieldset>
						<fieldset>
							<input
								type="text"
								className="input join-item"
								placeholder="Search tags below"
								value={tagSearchQuery}
								onChange={handleSearchInput}
							/>
						</fieldset>
					</div>
					<div className="flex flex-col gap-3 max-h-[70vh] overflow-auto">
						<table className={tagTableStyle}>
							<TableHeader title={"Selected"} />
							<tbody>
								{filteredSelectedTags.map((tag) => (
									<tr key={tag.id}>
										<td>{tag.description}</td>
										<td>
											<input
												className="checkbox checkbox-success"
												type="checkbox"
												defaultChecked
												onChange={handleCheckboxSelect(tag)}
											/>
										</td>
									</tr>
								))}
							</tbody>
						</table>
						<table className={tagTableStyle}>
							<TableHeader title={"Unselected"} />
							<tbody>
								{filteredRemainingTags.map((tag) => (
									<tr key={tag.id}>
										<td>{tag.description}</td>
										<td>
											<input
												className="checkbox"
												type="checkbox"
												onChange={handleCheckboxSelect(tag)}
											/>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
				<div className="modal-action">
					<form method="dialog">
						<button
							type="button"
							className="btn btn-error"
							onClick={onModalClose}
						>
							Close
						</button>
					</form>
				</div>
			</div>
		</dialog>
	);
};

export const TagPicker = ({
	onTagPickerClick,
	disabled = false,
}: TagPickerProps) => {
	return (
		<div className="flex items-center justify-center flex-wrap gap-2 max-w-[35vw]">
			<button
				type="button"
				className="btn btn-xs btn-accent"
				disabled={disabled}
				onClick={onTagPickerClick}
			>
				<span className="icon-[fluent--tag-48-regular]"></span>
			</button>
		</div>
	);
};
