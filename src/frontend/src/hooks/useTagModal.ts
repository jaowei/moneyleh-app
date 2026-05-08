import { useRef, useState } from "react"
import type { UiTag } from "../components/TagPicker"

export const useTagModal = () => {
    const tagModalRef = useRef<null | HTMLDialogElement>(null)
    const [selectedTags, setSelectedTags] = useState<UiTag[]>([])
    const [indexEditing, setIndexEditing] = useState<number | undefined>()
    const handleTagEditorOpen = (tags: UiTag[], transactionIdx: number) => {
        setIndexEditing(transactionIdx)
        setSelectedTags(tags)
        tagModalRef.current?.showModal()
    }

    const handleTagEditorClose = () => {
        setIndexEditing(undefined)
        setSelectedTags([])
        tagModalRef.current?.close()
    }
    const handleTagEditorChange = (tags: UiTag[]) => {
        setSelectedTags(tags)
    }
    return {
        tagModalRef,
        selectedTags,
        indexEditing,
        handleTagEditorClose,
        handleTagEditorOpen,
        handleTagEditorChange
    }
}