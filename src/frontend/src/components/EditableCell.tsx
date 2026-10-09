import { type ChangeEvent, useEffect, useState } from "react";
import { toDateInputValue, toLocaleDateString } from "../lib/date-utils.ts";

export type EditableCellType = "text" | "number" | "date";

interface EditableCellProps {
	/** The value as the backend stores it (dates are ISO strings). */
	value: string | number;
	/** Receives the raw `<input>` value; parse it before storing. */
	onChange: (value: string) => void;
	editing: boolean;
	/** Defaults to `text`, or to `number` when `value` is a number. */
	type?: EditableCellType;
}

const inputTypes = {
	text: "text",
	number: "number",
	date: "date",
} as const;

const toEditValue = (value: string | number, type: EditableCellType) =>
	type === "date" ? toDateInputValue(`${value}`) : `${value}`;

const toDisplayValue = (value: string | number, type: EditableCellType) =>
	type === "date" ? toLocaleDateString(`${value}`) : `${value}`;

export const EditableCell = ({
	value,
	editing,
	onChange,
	type,
}: EditableCellProps) => {
	const cellType = type ?? (typeof value === "number" ? "number" : "text");
	// While editing, the input owns its own value so partial input ("12.",
	// "2024-0") is not clobbered by the parsed value round-tripping back down.
	const [draft, setDraft] = useState<string | null>(null);

	useEffect(() => {
		if (!editing) {
			setDraft(null);
		}
	}, [editing]);

	const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
		setDraft(e.target.value);
		onChange(e.target.value);
	};

	return (
		<td>
			{editing ? (
				<input
					type={inputTypes[cellType]}
					className="input input-xs"
					value={draft ?? toEditValue(value, cellType)}
					onChange={handleChange}
				/>
			) : (
				toDisplayValue(value, cellType)
			)}
		</td>
	);
};
