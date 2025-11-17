import {backendRouteClient, type Tag} from "../lib/backend-clients.ts";

import {type ReactNode, useRef, useState} from "react";

export type UiTag = Pick<Tag, 'id' | 'description'>

interface TagInputProps {
    onTagChange: (selectedTags: UiTag[]) => void;
    tags?: UiTag[];
    availableTags?: UiTag[]
}

const TagContainer = ({title, children}: { title: string; children: ReactNode }) => {
    return (
        <div className="flex flex-col items-center">
            <h2>{title}</h2>
            <div className="card bg-base-300 rounded-box grid w-full h-full place-items-center p-2">
                {children}
            </div>
        </div>
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
        <div className="flex items-center justify-center">
            {selectedTags?.map((t) => (
                <div key={t.id} className="join">
                    <div
                        className="badge badge-md badge-primary join-item overflow-hidden whitespace-nowrap max-w-16">{t.description}</div>
                    <button className="btn btn-xs btn-circle btn-error join-item" onClick={handleTagRemoval(t)}>
                        <span className="icon-[iwwa--delete]"></span>
                    </button>
                </div>
            ))}
            <button className="btn btn-circle"
                    onClick={() => tagModalRef.current?.showModal()}>
                <span className="icon-[material-symbols--add-2-rounded]"></span>
            </button>
            <dialog ref={tagModalRef} className="modal">
                <div className="modal-box">
                    <div className="flex w-full flex-col gap-4">
                        <TagContainer title="Selected Tags">
                            {!selectedTags ?
                                <h3>No tags selected yet, pick some from below</h3> : selectedTags?.map((t) => (
                                    <div key={t.id} className="join">
                                        <input type="text" className="input join-item" readOnly value={t.description}/>
                                        <button className="btn btn-circle join-item btn-error"
                                                onClick={handleTagRemoval(t)}>
                                            <span className="icon-[iwwa--delete]"></span>
                                        </button>
                                    </div>
                                ))}
                        </TagContainer>
                        <div className="divider"></div>
                        <TagContainer title="Available Tags">
                            {!remainingTags ?
                                <h3>No tags available, start adding some below</h3> : remainingTags.map((t) => (
                                    <div key={t.id} className="join">
                                        <input type="text" className="input join-item" readOnly value={t.description}/>
                                        <button className="btn btn-circle join-item btn-success"
                                                onClick={handleTagAddition(t)
                                                }>
                                            <span className="icon-[material-symbols--add-2-rounded]"></span>
                                        </button>
                                    </div>
                                ))}
                        </TagContainer>
                        <div className="divider"></div>
                        <fieldset className="fieldset">
                            <div className="join">
                                <input type="text" className="input join-item" placeholder="Add new tags"
                                       value={newTagName}
                                       onChange={(e) => setNewTagName(e.target.value)}/>
                                <button className="btn join-item" onClick={handleCreateTagClick}>Add tag</button>
                            </div>
                            {tagCreationError && <p>{tagCreationError}</p>}
                        </fieldset>
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
