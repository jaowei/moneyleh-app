import { createFileRoute, Link } from "@tanstack/react-router";
import {
	backendRouteClient,
	type PortfolioRes,
} from "../../lib/backend-clients.ts";
import { toLocaleDateString } from "../../lib/date-utils.ts";
import { ERROR_MESSAGES, getBackendErrorResponse } from "../../lib/error.ts";

export const Route = createFileRoute("/_authenticated/portfolio")({
	component: PortfolioComponent,
	loader: async ({ context: { auth } }) => {
		const userId = auth?.user?.id;
		if (!userId) throw new Error(ERROR_MESSAGES.NOT_AUTHORISED);

		const res = await backendRouteClient.api.portfolio[":userId"].$get({
			param: { userId },
		});
		if (!res.ok) throw await getBackendErrorResponse(res);
		const portfolio: PortfolioRes = await res.json();
		return { portfolio };
	},
});

type Holding = PortfolioRes["holdings"][number];

interface AccountGroup {
	accountId: number;
	accountName: string;
	companyName: string | null;
	asOfDate: string;
	holdings: Holding[];
}

const securityTypeLabels: Record<string, string> = {
	stock: "Stocks",
	bond: "Bonds",
	etf: "ETFs",
	managedFund: "Managed funds",
};

const moneyFormatters = new Map<string, Intl.NumberFormat>();
const formatMoney = (value: number, currency: string) => {
	let formatter = moneyFormatters.get(currency);
	if (!formatter) {
		try {
			formatter = new Intl.NumberFormat("en-SG", {
				style: "currency",
				currency,
				maximumFractionDigits: 2,
			});
		} catch {
			// Currency codes come from the statement, so an unknown one must not
			// break the page.
			return `${currency} ${value.toFixed(2)}`;
		}
		moneyFormatters.set(currency, formatter);
	}
	return formatter.format(value);
};

const groupByAccount = (holdings: Holding[]): AccountGroup[] => {
	const groups = new Map<number, AccountGroup>();
	for (const holding of holdings) {
		const group = groups.get(holding.accountId);
		if (group) {
			group.holdings.push(holding);
		} else {
			groups.set(holding.accountId, {
				accountId: holding.accountId,
				accountName: holding.accountName,
				companyName: holding.companyName,
				asOfDate: holding.asOfDate,
				holdings: [holding],
			});
		}
	}
	return [...groups.values()].sort(
		(a, b) =>
			(a.companyName ?? "").localeCompare(b.companyName ?? "") ||
			a.accountName.localeCompare(b.accountName),
	);
};

const totalsByCurrency = (holdings: Holding[]) =>
	holdings.reduce<Record<string, number>>((acc, holding) => {
		acc[holding.currency] = (acc[holding.currency] ?? 0) + holding.marketValue;
		return acc;
	}, {});

const gainPct = (holding: Holding) =>
	holding.extra && typeof holding.extra.unrealisedGainPct === "number"
		? holding.extra.unrealisedGainPct
		: undefined;

const AccountHoldings = ({ group }: { group: AccountGroup }) => {
	const totals = totalsByCurrency(group.holdings);
	return (
		<div className="rounded-box border border-base-content/5 bg-base-100">
			<div className="flex flex-wrap items-start justify-between gap-2 bg-base-200 px-4 py-3">
				<div>
					<h3 className="font-bold">
						{group.companyName} · {group.accountName}
					</h3>
					<p className="text-xs text-base-content/60">
						As of {toLocaleDateString(group.asOfDate)}
					</p>
				</div>
				<div className="text-right">
					{Object.entries(totals).map(([currency, total]) => (
						<div key={currency} className="font-semibold tabular-nums">
							{formatMoney(total, currency)}
						</div>
					))}
				</div>
			</div>
			<table className="table table-zebra table-xs w-full">
				<thead>
					<tr>
						<th className="min-w-[240px]">Instrument</th>
						<th className="w-28 text-right">Units</th>
						<th className="w-28 text-right">Unit price</th>
						<th className="w-32 text-right">Market value</th>
						<th className="w-20 text-center">Currency</th>
						<th className="w-40 text-right">Unrealised gain</th>
					</tr>
				</thead>
				<tbody>
					{group.holdings.map((holding) => {
						const pct = gainPct(holding);
						return (
							<tr key={holding.id}>
								<td>
									<div className="font-medium">{holding.securityName}</div>
									<div className="text-xs text-base-content/60">
										{[
											holding.symbol,
											holding.isin,
											securityTypeLabels[holding.securityType] ??
												holding.securityType,
										]
											.filter(Boolean)
											.join(" · ")}
									</div>
								</td>
								<td className="text-right font-mono tabular-nums">
									{holding.units}
								</td>
								<td className="text-right font-mono tabular-nums">
									{formatMoney(holding.price, holding.currency)}
								</td>
								<td className="text-right font-mono tabular-nums font-semibold">
									{formatMoney(holding.marketValue, holding.currency)}
								</td>
								<td className="text-center">{holding.currency}</td>
								<td className="text-right font-mono tabular-nums">
									{holding.unrealisedGain === null
										? "—"
										: `${formatMoney(holding.unrealisedGain, holding.currency)}${
												pct === undefined ? "" : ` (${pct.toFixed(2)}%)`
											}`}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
};

const Allocation = ({ portfolio }: { portfolio: PortfolioRes }) => {
	const byCurrency = new Map<
		string,
		{ securityType: string; marketValue: number }[]
	>();
	for (const entry of portfolio.byType) {
		const existing = byCurrency.get(entry.currency);
		if (existing) {
			existing.push(entry);
		} else {
			byCurrency.set(entry.currency, [entry]);
		}
	}
	if (!byCurrency.size) {
		return null;
	}
	return (
		<div className="rounded-box border border-base-content/5 bg-base-100 p-4">
			<h2 className="font-bold mb-3">Allocation</h2>
			<div className="flex flex-col gap-4">
				{[...byCurrency.entries()].map(([currency, entries]) => {
					const total = portfolio.totalValueByCurrency[currency] ?? 0;
					return (
						<div key={currency} className="flex flex-col gap-2">
							<h3 className="text-xs font-semibold uppercase text-base-content/60">
								{currency}
							</h3>
							{[...entries]
								.sort((a, b) => b.marketValue - a.marketValue)
								.map((entry) => {
									const pct = total > 0 ? (entry.marketValue / total) * 100 : 0;
									return (
										<div key={entry.securityType}>
											<div className="flex justify-between text-sm">
												<span>
													{securityTypeLabels[entry.securityType] ??
														entry.securityType}
												</span>
												<span className="tabular-nums text-base-content/70">
													{formatMoney(entry.marketValue, currency)} ·{" "}
													{pct.toFixed(1)}%
												</span>
											</div>
											<progress
												className="progress progress-primary w-full"
												value={pct}
												max={100}
											/>
										</div>
									);
								})}
						</div>
					);
				})}
			</div>
		</div>
	);
};

function PortfolioComponent() {
	const { portfolio } = Route.useLoaderData();
	const accountGroups = groupByAccount(portfolio.holdings);
	const hasHoldings = portfolio.holdings.length > 0;

	return (
		<div className="h-full overflow-auto p-4">
			<div className="mx-auto w-full xl:w-4/5 flex flex-col gap-4">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<h1 className="text-2xl xl:text-3xl font-bold">Portfolio</h1>
					{portfolio.asOfDate && (
						<span className="text-sm text-base-content/60">
							Latest statement: {toLocaleDateString(portfolio.asOfDate)}
						</span>
					)}
				</div>

				{hasHoldings ? (
					<>
						<div className="stats stats-vertical lg:stats-horizontal shadow w-full">
							{Object.entries(portfolio.totalValueByCurrency).map(
								([currency, value]) => (
									<div className="stat" key={currency}>
										<div className="stat-title">
											Portfolio value ({currency})
										</div>
										<div className="stat-value text-2xl xl:text-3xl">
											{formatMoney(value, currency)}
										</div>
									</div>
								),
							)}
							<div className="stat">
								<div className="stat-title">Holdings</div>
								<div className="stat-value text-2xl xl:text-3xl">
									{portfolio.holdings.length}
								</div>
							</div>
							<div className="stat">
								<div className="stat-title">Accounts</div>
								<div className="stat-value text-2xl xl:text-3xl">
									{accountGroups.length}
								</div>
							</div>
						</div>

						<div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
							<div className="xl:col-span-2 flex flex-col gap-4">
								{accountGroups.map((group) => (
									<AccountHoldings key={group.accountId} group={group} />
								))}
							</div>
							<div>
								<Allocation portfolio={portfolio} />
							</div>
						</div>
					</>
				) : (
					<div className="flex flex-col items-center gap-3 rounded-box border border-dashed border-base-content/20 p-10 text-center">
						<h2 className="text-xl font-semibold">No portfolio yet</h2>
						<p className="max-w-md text-base-content/70">
							Upload a broker statement (for example a Chocolate Finance
							statement) and confirm it in the upload view. Your holdings will
							appear here.
						</p>
						<Link to="/inventory/upload" className="btn btn-primary btn-sm">
							Upload a statement
						</Link>
					</div>
				)}
			</div>
		</div>
	);
}
