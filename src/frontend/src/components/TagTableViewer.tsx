import type { ReactNode } from "react";
import type { UiTag } from "./TagPicker"

interface TagTableViewerProps {
    selectedTags: UiTag[]
    canEdit: boolean;
    onTagChange: (selectedTags: UiTag[]) => void;
}

interface TagActionButtonProps {
    onClick: () => void;
    tagDescription: string;
    actionType: 'delete' | 'add' | 'preview' | 'readonly'
}

const TagTooltipWrapper = ({ tagDescription, children }: {
    tagDescription: string;
    children: ReactNode;
}) => {
    return (
        <div className="tooltip" data-tip={tagDescription}>
            {children}
        </div>
    )
}

const TagActionButton = ({ onClick, tagDescription, actionType }: TagActionButtonProps) => {
    const getStyleTag = () => {
        switch (actionType) {
            case "delete":
                return 'btn-error'
            case "add":
                return 'btn-accent'
            case "preview":
                return 'btn-warning btn-xs'
            case "readonly":
                return ''
        }
    }
    const getIconElement = () => {
        switch (actionType) {
            case "delete":
                return <span className="icon-[iwwa--delete]"></span>
            case "add":
                return <span className="icon-[material-symbols--add-2-rounded]"></span>
            case "preview":
                return <span className="icon-[iwwa--delete]"></span>
            case "readonly":
                return
        }
    }
    return (
        <button className={`btn btn-soft ${getStyleTag()}`} onClick={onClick} disabled={actionType === 'readonly'}>
            <div className="truncate max-w-24">
                {tagDescription}
            </div>
            {getIconElement()}
        </button>
    )
}

export const TagTableViewer = ({ selectedTags, canEdit, onTagChange }: TagTableViewerProps) => {
    const handleTagRemoval = (tag: UiTag) => {
        return () => {
            const newTags = selectedTags.filter((existingTag) => tag.id !== existingTag.id)
            onTagChange(newTags)
        }
    }
    return (
        <div className="flex flex-row gap-0.5">
            {selectedTags?.map((t) => (
                <TagTooltipWrapper key={t.id} tagDescription={t.description}>
                    <TagActionButton actionType={canEdit ? "preview" : "readonly"}
                        tagDescription={t.description} onClick={handleTagRemoval(t)} />
                </TagTooltipWrapper>
            ))}
        </div>
    )
}