import {backendRouteClient, type Tag} from "../lib/backend-clients.ts";

import {type ReactNode, useRef, useState} from "react";

export type UiTag = Pick<Tag, 'id' | 'description'>

interface TagInputProps {
    onTagChange: (selectedTags: UiTag[]) => void;
    tags?: UiTag[];
    availableTags?: UiTag[]
}

const TagsContainer = ({title, children}: { title: string; children: ReactNode }) => {
    return (
        <div className="flex flex-col items-center">
            <h2>{title}</h2>
            <div className="card bg-base-300 rounded-box flex flex-row w-[90%] flex-wrap gap-2 p-2">
                {children}
            </div>
        </div>
    )
}

const TagTextButton = ({tagDescription, children}: {
    tagDescription: string;
    children: ReactNode;
}) => {
    return (
        <div className="tooltip" data-tip={tagDescription}>
            {children}
        </div>
    )
}

const TagDeleteButton = ({onClick, tagDescription}: { onClick: () => void; tagDescription: string }) => {
    return (
        <button className="btn btn-soft btn-error" onClick={onClick}>
            <div className="truncate max-w-24">
                {tagDescription}
            </div>
            <span className="icon-[iwwa--delete]"></span>
        </button>
    )
}

const TagAddButton = ({onClick, tagDescription}: { onClick: () => void; tagDescription: string }) => {
    return (
        <button className="btn btn-soft btn-accent" onClick={onClick}>
            <div className="truncate max-w-24">
                {tagDescription}
            </div>
            <span className="icon-[material-symbols--add-2-rounded]"></span>
        </button>
    )
}

const TagPreviewButton = ({onClick, tagDescription}: { onClick: () => void; tagDescription: string }) => {
    return (
        <button className="btn btn-soft btn-xs btn-warning" onClick={onClick}>
            <div className="truncate max-w-24">
                {tagDescription}
            </div>
            <span className="icon-[iwwa--delete]"></span>
        </button>
    )
}

export const TagPicker = ({tags, availableTags, onTagChange}: TagInputProps) => {
    const tagModalRef = useRef<null | HTMLDialogElement>(null)
    const [selectedTags, setSelectedTags] = useState(tags || [])
    const [remainingTags, setRemainingTags] = useState(availableTags || [])
    const [newTagName, setNewTagName] = useState('')
    const [tagCreationError, setTagCreationError] = useState('')

    const handleCreateTagClick = async () => {
        const res = await backendRouteClient.api.tag.$post({
            json: {tags: [{description: newTagName}]}
        })
        if (res.ok) {
            const createdTag = (await res.json()).created
            setSelectedTags((existing) => {
                const newTags = [...existing, createdTag[0]]
                onTagChange(newTags)
                return newTags
            })
            setNewTagName('')
        } else {
            setTagCreationError(res.statusText)
        }
    }

    const handleTagAddition = (tag: UiTag) => {
        return () => {
            setSelectedTags((existing) => {
                const newTags = [...existing, tag]
                onTagChange(newTags)
                return newTags
            })
            setRemainingTags((existing) => existing.filter((existingTag) => tag.id !== existingTag.id))
        }
    }

    const handleTagRemoval = (tag: UiTag) => {
        return () => {
            setRemainingTags((existing) => [...existing, tag])
            setSelectedTags((existing) => {
                const newTags = existing.filter((existingTag) => tag.id !== existingTag.id)
                onTagChange(newTags)
                return newTags
            })
        }
    }

    return (
        <div className="flex items-center justify-center flex-wrap gap-2 max-w-[35vw]">
            {selectedTags?.map((t) => (
                <TagTextButton key={t.id} tagDescription={t.description}>
                    <TagPreviewButton tagDescription={t.description} onClick={handleTagRemoval(t)}/>
                </TagTextButton>
            ))}
            <button className="btn btn-xs btn-accent" onClick={() => tagModalRef.current?.showModal()}>
                <span className="icon-[fluent--tag-48-regular]"></span>
            </button>
            <dialog ref={tagModalRef} className="modal">
                <div className="modal-box max-w-[75vw] max-h-[95vh]">
                    <div className="flex w-full max-h-[75vh] flex-col gap-4 overflow-auto">
                        <div className="flex flex-col items-center">
                            <fieldset className="fieldset">
                                <div className="join">
                                    <input type="text" className="input join-item" placeholder="Add new tags"
                                           value={newTagName}
                                           onChange={(e) => setNewTagName(e.target.value)}/>
                                    <button className="btn join-item" disabled={!newTagName}
                                            onClick={handleCreateTagClick}>Add tag
                                    </button>
                                </div>
                                {tagCreationError && <p>{tagCreationError}</p>}
                            </fieldset>
                        </div>
                        <div className="divider"></div>
                        <TagsContainer title="Selected Tags">
                            {!selectedTags ?
                                <h3>No tags selected yet, pick some from below</h3> : selectedTags?.map((t) => (
                                    <TagTextButton key={t.id} tagDescription={t.description}>
                                        <TagDeleteButton tagDescription={t.description}
                                                         onClick={handleTagRemoval(t)}/>
                                    </TagTextButton>
                                ))}
                        </TagsContainer>
                        <div className="divider"></div>
                        <TagsContainer title="Available Tags">
                            {!remainingTags ?
                                <h3>No tags available, start adding some below</h3> : remainingTags.map((t) => (
                                    <TagTextButton key={t.id} tagDescription={t.description}>
                                        <TagAddButton tagDescription={t.description} onClick={handleTagAddition(t)}/>
                                    </TagTextButton>
                                ))}
                        </TagsContainer>
                    </div>
                    <div className="modal-action">
                        <form method="dialog">
                            <button className="btn btn-error">Close</button>
                        </form>
                    </div>
                </div>
            </dialog>
        </div>
    )
}
