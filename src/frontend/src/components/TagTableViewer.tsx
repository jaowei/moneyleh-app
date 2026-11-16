import type { ReactNode } from "react";
import type { UiTag } from "./TagPicker";

interface TagTableViewerProps {
	selectedTags: UiTag[];
	canEdit: boolean;
	onTagChange: (selectedTags: UiTag[]) => void;
	onAddTagClick?: () => void;
}

interface TagActionButtonProps {
	onClick: () => void;
	tagDescription: string;
	actionType: "delete" | "add" | "preview" | "readonly";
}

const TagTooltipWrapper = ({
	tagDescription,
	children,
}: {
	tagDescription: string;
	children: ReactNode;
}) => {
	return (
		<div className="tooltip" data-tip={tagDescription}>
			{children}
		</div>
	);
};

const TagActionButton = ({
	onClick,
	tagDescription,
	actionType,
}: TagActionButtonProps) => {
	const getStyleTag = () => {
		switch (actionType) {
			case "delete":
				return "btn-error";
			case "add":
				return "btn-accent";
			case "preview":
				return "btn-warning";
			case "readonly":
				return "";
		}
	};
	const getIconElement = () => {
		switch (actionType) {
			case "delete":
				return <span className="icon-[iwwa--delete]"></span>;
			case "add":
				return <span className="icon-[material-symbols--add-2-rounded]"></span>;
			case "preview":
				return <span className="icon-[iwwa--delete]"></span>;
			case "readonly":
				return;
		}
	};
	return (
		<button
			type="button"
			className={`btn btn-soft ${getStyleTag()} btn-xs`}
			onClick={onClick}
			disabled={actionType === "readonly"}
		>
			<div className="truncate max-w-24">{tagDescription}</div>
			{getIconElement()}
		</button>
	);
};

export const TagTableViewer = ({
	selectedTags,
	canEdit,
	onTagChange,
	onAddTagClick,
}: TagTableViewerProps) => {
	const handleTagRemoval = (tag: UiTag) => {
		return () => {
			const newTags = selectedTags.filter(
				(existingTag) => tag.id !== existingTag.id,
			);
			onTagChange(newTags);
		};
	};
	const hasTags = selectedTags && selectedTags.length > 0;
	return (
		<div className="flex flex-row flex-wrap items-center gap-1">
			{selectedTags?.map((t) => (
				<TagTooltipWrapper key={t.id} tagDescription={t.description}>
					<TagActionButton
						actionType={canEdit ? "preview" : "readonly"}
						tagDescription={t.description}
						onClick={handleTagRemoval(t)}
					/>
				</TagTooltipWrapper>
			))}
			{canEdit && onAddTagClick && (
				<button
					type="button"
					className={`btn btn-ghost btn-outline border-dashed btn-xs ${
						hasTags ? "px-1.5" : "px-2"
					} text-base-content/60 hover:text-base-content transition-colors`}
					onClick={onAddTagClick}
					title={hasTags ? "Add more tags" : "Add tag"}
				>
					<span className="icon-[fluent--tag-20-regular] text-xs"></span>
					{hasTags ? (
						<span className="text-[10px] ml-0.5">+</span>
					) : (
						<span className="text-[11px] font-normal ml-1">Add Tag</span>
					)}
				</button>
			)}
		</div>
	);
};
