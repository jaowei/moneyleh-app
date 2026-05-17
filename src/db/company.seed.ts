export const STARTING_COMPANIES = [
	{
		name: "DBS",
	},
	{
		name: "UOB",
	},
	{
		name: "Citibank",
	},
	{
		name: "Trust Bank",
	},
	{
		name: "Standard Chartered",
	},
	{
		name: "HSBC",
	},
	{
		name: "Interactive Brokers",
	},
	{
		name: "Tiger Brokers",
	},
	{
		name: "Moo Moo",
	},
	{
		name: "CPF",
	},
	{
		name: "Great Eastern",
	},
	{
		name: "SingLife",
	},
	{
		name: "Chocolate Finance",
	},
	{
		name: "AMEX",
	},
	{
		name: "IFast",
	},
	{
		name: "Syfe",
	},
	{
		name: "GXS",
	},
] as const;
export type Companies = (typeof STARTING_COMPANIES)[number]["name"];
