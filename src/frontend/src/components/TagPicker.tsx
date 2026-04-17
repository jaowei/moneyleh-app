import { useRouter } from "@tanstack/react-router";
import { backendRouteClient, type Tag } from "../lib/backend-clients.ts";
import { useRef, useState, type ChangeEvent } from "react";

export type UiTag = Pick<Tag, 'id' | 'description'>

interface TagInputProps {
    onTagChange: (selectedTags: UiTag[]) => void;
    selectedTags: UiTag[];
    availableTags: UiTag[]
}

const tagFilter = (searchQuery: string) => {
    return (tag: UiTag) => {
        const cleanStr = tag.description.toLowerCase().trim()
        return cleanStr.includes(searchQuery)
    }
}

export const TagPicker = ({ selectedTags, availableTags, onTagChange }: TagInputProps) => {
    const tagModalRef = useRef<null | HTMLDialogElement>(null)
    const remainingTags = availableTags.filter((tag) => !selectedTags.find((t) => t.id === tag.id))
    const [newTagName, setNewTagName] = useState('')
    const [tagSearchQuery, setTagSearchQuery] = useState('')
    const [tagCreationError, setTagCreationError] = useState('')

    const router = useRouter()

    const filteredSelectedTags = tagSearchQuery ? selectedTags.filter(tagFilter(tagSearchQuery)) : selectedTags
    const filteredRemainingTags = tagSearchQuery ? remainingTags.filter(tagFilter(tagSearchQuery)) : remainingTags

    const handleCreateTagClick = async () => {
        const res = await backendRouteClient.api.tag.$post({
            json: { tags: [{ description: newTagName }] }
        })
        if (res.ok) {
            const createdTag = (await res.json()).created
            const newTags = [...selectedTags, createdTag[0]]
            onTagChange(newTags)
            setNewTagName('')
            router.invalidate()
        } else {
            setTagCreationError(res.statusText)
        }
    }

    const handleCheckboxSelect = (tag: UiTag) => {
        return (e: ChangeEvent<HTMLInputElement>) => {
            console.log(e.target.checked)
            if (!e.target.checked) {
                // unchecking, remove tag
                const newTags = selectedTags.filter((existingTag) => tag.id !== existingTag.id)
                onTagChange(newTags)
            } else {
                // checking, add tag
                const newTags = [...selectedTags, tag]
                onTagChange(newTags)
            }
        }
    }

    const handleNewTagNameInput = (e: ChangeEvent<HTMLInputElement>) => {
        setNewTagName(e.target.value)
    }

    const handleSearchInput = (e: ChangeEvent<HTMLInputElement>) => {
        setTagSearchQuery(e.target.value)
    }

    return (
        <div className="flex items-center justify-center flex-wrap gap-2 max-w-[35vw]">
            <button className="btn btn-xs btn-accent" onClick={() => tagModalRef.current?.showModal()}>
                <span className="icon-[fluent--tag-48-regular]"></span>
            </button>
            <dialog ref={tagModalRef} className="modal">
                <div className="modal-box max-w-[75vw] min-h-[90vh]">
                    <div className="flex w-full flex-col gap-4">
                        <div className="flex flex-row items-center gap-4">
                            <fieldset className="fieldset">
                                <div className="join">
                                    <input type="text" className="input join-item" placeholder="Add new tags"
                                        value={newTagName}
                                        onChange={handleNewTagNameInput} />
                                    <button className="btn join-item" disabled={!newTagName}
                                        onClick={handleCreateTagClick}>Add tag
                                    </button>
                                </div>
                                {tagCreationError && <p>{tagCreationError}</p>}
                            </fieldset>
                            <fieldset>
                                <input type="text" className="input join-item" placeholder="Search tags below"
                                    value={tagSearchQuery}
                                    onChange={handleSearchInput} />
                            </fieldset>
                        </div>
                        <div className="max-h-[70vh] overflow-auto">
                            <table className="table table-zebra table-xs">
                                <thead>
                                    <tr>
                                        <th>Tag Name</th>
                                        <th>Selected</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSelectedTags.map((tag) => (
                                        <tr key={tag.id}>
                                            <td>{tag.description}</td>
                                            <td><input className="checkbox checkbox-success" type="checkbox"
                                                defaultChecked onChange={handleCheckboxSelect(tag)} /></td>
                                        </tr>
                                    ))}
                                    {filteredRemainingTags.map((tag) => (
                                        <tr key={tag.id}>
                                            <td>{tag.description}</td>
                                            <td><input className="checkbox" type="checkbox" onChange={handleCheckboxSelect(tag)} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
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
