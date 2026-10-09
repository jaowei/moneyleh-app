import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	toDateInputValue,
	toIsoDate,
	toLocaleDateString,
} from "./date-utils.ts";

// The backend normalizes dates to UTC, so the calendar day shown must not
// depend on the viewer's timezone. These zones all disagree about what day
// `2024-01-15T00:00:00.000Z` is when read in local time.
const timeZones = [
	"UTC",
	"America/Los_Angeles",
	"America/New_York",
	"Asia/Singapore",
	"Pacific/Kiritimati",
	"Pacific/Pago_Pago",
];

const originalTz = process.env.TZ;
const inTz = <T>(tz: string, fn: () => T): T => {
	process.env.TZ = tz;
	try {
		return fn();
	} finally {
		process.env.TZ = originalTz;
	}
};

describe("date-utils", () => {
	describe("toLocaleDateString", () => {
		beforeEach(() => {
			process.env.TZ = "UTC";
		});
		afterEach(() => {
			process.env.TZ = originalTz;
		});

		test("renders the ISO calendar day, not the shifted local day", () => {
			// A naive toLocaleDateString() renders the 14th west of Greenwich.
			const iso = "2024-01-15T00:00:00.000Z";
			const naive = inTz("America/Los_Angeles", () =>
				new Date(iso).toLocaleDateString(),
			);
			const ours = inTz("America/Los_Angeles", () => toLocaleDateString(iso));
			expect(ours).not.toBe(naive);
		});

		test("is stable across timezones", () => {
			const formatted = timeZones.map((tz) =>
				inTz(tz, () => toLocaleDateString("2024-01-15T00:00:00.000Z")),
			);
			expect(new Set(formatted).size).toBe(1);
		});

		test("uses the viewer's locale format rather than a fixed one", () => {
			const formatted = toLocaleDateString("2024-01-15T00:00:00.000Z");
			const expected = new Date("2024-01-15T00:00:00.000Z").toLocaleDateString(
				undefined,
				{ timeZone: "UTC" },
			);
			expect(formatted).toBe(expected);
		});

		test("handles dates stored with a UTC time component", () => {
			expect(toLocaleDateString("2020-12-31T16:00:00.000Z")).toBe(
				toLocaleDateString("2020-12-31T00:00:00.000Z"),
			);
		});

		test("handles date-only strings", () => {
			expect(toLocaleDateString("2024-01-15")).toBe(
				toLocaleDateString("2024-01-15T00:00:00.000Z"),
			);
		});

		test("returns unparseable values unchanged", () => {
			expect(toLocaleDateString("not a date")).toBe("not a date");
			expect(toLocaleDateString("")).toBe("");
		});
	});

	describe("toDateInputValue", () => {
		test("trims an ISO string down to the date input format", () => {
			expect(toDateInputValue("2024-01-15T00:00:00.000Z")).toBe("2024-01-15");
		});

		test("accepts date-only strings", () => {
			expect(toDateInputValue("2024-01-15")).toBe("2024-01-15");
		});

		test("is timezone stable", () => {
			const iso = "2024-01-15T00:00:00.000Z";
			expect(inTz("America/Los_Angeles", () => toDateInputValue(iso))).toBe(
				"2024-01-15",
			);
			expect(inTz("Pacific/Kiritimati", () => toDateInputValue(iso))).toBe(
				"2024-01-15",
			);
		});

		test("returns an empty value for unparseable input", () => {
			expect(toDateInputValue("not a date")).toBe("");
			expect(toDateInputValue("")).toBe("");
		});
	});

	describe("toIsoDate", () => {
		test("converts a calendar day into a UTC ISO timestamp", () => {
			expect(toIsoDate("2024-01-15")).toBe("2024-01-15T00:00:00.000Z");
		});

		test("round trips with toDateInputValue", () => {
			const iso = toIsoDate("2024-06-15");
			expect(iso).toBeString();
			expect(toDateInputValue(iso as string)).toBe("2024-06-15");
		});

		test("accepts leap days that exist", () => {
			expect(toIsoDate("2024-02-29")).toBe("2024-02-29T00:00:00.000Z");
		});

		test("rejects days that do not exist instead of rolling over", () => {
			// new Date("2023-02-29T00:00:00.000Z") is a valid Date of 2023-03-01
			expect(toIsoDate("2023-02-29")).toBeUndefined();
			expect(toIsoDate("2024-02-31")).toBeUndefined();
		});

		test("rejects out of range months and days", () => {
			expect(toIsoDate("2024-13-01")).toBeUndefined();
			expect(toIsoDate("2024-00-10")).toBeUndefined();
			expect(toIsoDate("2024-01-00")).toBeUndefined();
		});

		test("rejects values that are not zero padded calendar days", () => {
			expect(toIsoDate("2024-1-5")).toBeUndefined();
			expect(toIsoDate("01/15/2024")).toBeUndefined();
			expect(toIsoDate("2024-01-15T00:00:00.000Z")).toBeUndefined();
		});

		test("rejects empty and unparseable input", () => {
			expect(toIsoDate("")).toBeUndefined();
			expect(toIsoDate("not a date")).toBeUndefined();
		});
	});
});
