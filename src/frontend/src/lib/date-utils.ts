const isoCalendarDayZ = /^\d{4}-\d{2}-\d{2}$/;

const toValidDate = (value: string): Date | undefined => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return undefined;
	}
	return date;
};

/**
 * Renders a stored transaction date in the viewer's locale.
 *
 * The backend normalizes dates to UTC (`parseDateString` parses with
 * `.utc(true)`), so the calendar day is read in UTC to keep what the user sees
 * in sync with what gets persisted instead of shifting by a day for anyone
 * west of Greenwich.
 */
export const toLocaleDateString = (value: string): string => {
	const date = toValidDate(value);
	if (!date) {
		return value;
	}
	return date.toLocaleDateString(undefined, { timeZone: "UTC" });
};

/** ISO date -> `YYYY-MM-DD`, the format `<input type="date">` expects. */
export const toDateInputValue = (value: string): string => {
	const date = toValidDate(value);
	if (!date) {
		return "";
	}
	return date.toISOString().slice(0, 10);
};

/**
 * `YYYY-MM-DD` -> ISO date-time string, or `undefined` when the input is empty
 * or not a real calendar day.
 */
export const toIsoDate = (value: string): string | undefined => {
	if (!isoCalendarDayZ.test(value)) {
		return undefined;
	}
	const date = toValidDate(`${value}T00:00:00.000Z`);
	// Date rolls impossible days over (2023-02-29 becomes 2023-03-01), so the
	// round trip through ISO is what tells us the day actually exists.
	if (!date || date.toISOString().slice(0, 10) !== value) {
		return undefined;
	}
	return date.toISOString();
};
