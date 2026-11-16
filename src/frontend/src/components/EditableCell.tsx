import { type ChangeEvent, useEffect, useState } from "react";
import { toDateInputValue, toLocaleDateString } from "../lib/date-utils.ts";
import type { EditableTransactionField } from "../lib/editable-fields.ts";

export type EditableCellType = "text" | "number" | "date";

interface EditableCellProps {
	/** The value as the backend stores it (dates are ISO strings). */
	value: string | number;
	/** Receives the raw `<input>` value; parse it before storing. */
	onChange: (value: string) => void;
	editing: boolean;
	/** Defaults to `text`, or to `number` when `value` is a number. */
	type?: EditableCellType;
	/** Field name for field-specific styling and layout. */
	field?: EditableTransactionField;
	/** Whether to use subtle ghost input styling. */
	subtle?: boolean;
	/** Optional additional className for <td>. */
	className?: string;
	/** Optional additional className for <input>. */
	inputClassName?: string;
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
	field,
	subtle = false,
	className = "",
	inputClassName = "",
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

	const titleValue = draft ?? `${value}`;

	const getFieldInputClasses = () => {
		if (!subtle) {
			return "input input-xs";
		}
		const base =
			"input input-xs input-ghost hover:input-bordered focus:input-bordered transition-colors";
		switch (field) {
			case "description":
				return `${base} w-full text-xs font-normal text-base-content`;
			case "currency":
				return `${base} w-full max-w-16 text-center font-medium text-xs text-base-content/80`;
			case "amount": {
				const numVal =
					typeof value === "number" ? value : Number.parseFloat(`${value}`);
				const isPositive = Number.isFinite(numVal) && numVal > 0;
				return `${base} w-full max-w-28 text-right font-mono tabular-nums text-xs font-semibold ${
					isPositive ? "text-success" : "text-base-content"
				}`;
			}
			case "transactionDate":
				return `${base} w-full max-w-28 font-mono text-xs`;
			default:
				return `${base} w-full`;
		}
	};

	const getFieldTdClasses = () => {
		switch (field) {
			case "description":
				return "min-w-[280px] max-w-xl";
			case "currency":
				return "w-16 text-center";
			case "amount":
				return "w-28 text-right";
			case "transactionDate":
				return "w-32";
			default:
				return "";
		}
	};

	const tdClasses = [getFieldTdClasses(), className].filter(Boolean).join(" ");
	const inputClasses = [getFieldInputClasses(), inputClassName]
		.filter(Boolean)
		.join(" ");

	return (
		<td
			className={tdClasses || undefined}
			title={field === "description" ? titleValue : undefined}
		>
			{editing ? (
				<input
					type={inputTypes[cellType]}
					className={inputClasses}
					title={field === "description" ? titleValue : undefined}
					value={draft ?? toEditValue(value, cellType)}
					onChange={handleChange}
				/>
			) : (
				toDisplayValue(value, cellType)
			)}
		</td>
	);
};
