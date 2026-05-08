import { useState, type ChangeEvent } from "react"

interface EditableCellProps {
    value: string | number;
    onChange: (value: string) => void;
    editing: boolean;
}

export const EditableCell = ({ value, editing, onChange }: EditableCellProps) => {
    const [currentValue, setCurrentValue] = useState<string | number>(value)
    const inputType = typeof value === 'string' ? 'text' : 'number'
    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        setCurrentValue(e.target.value)
        onChange(e.target.value)
    }

    return (<td>
        {editing ? (<input type={inputType} className="input input-xs"
            value={currentValue}
            onChange={handleInputChange}
        />) : value}
    </td>)
}