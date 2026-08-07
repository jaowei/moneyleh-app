export const capitalise = (target: string): string => {
	return target.slice(0, 1).toUpperCase() + target.slice(1);
};

export const currencyFormatter = (value: number, currencyCode: string) => {
	return new Intl.NumberFormat("en-sg", {
		style: "currency",
		currency: currencyCode,
	}).format(value);
};
