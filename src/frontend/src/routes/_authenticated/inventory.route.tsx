import {
	createFileRoute,
	isMatch,
	Link,
	Outlet,
	useMatches,
} from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/inventory")({
	component: InventoryLayoutComponent,
	loader: () => ({ crumb: "Summary" }),
});

function InventoryLayoutComponent() {
	const matches = useMatches();

	const crumbs = matches.filter((match) => isMatch(match, "loaderData.crumb"));
	console.log(matches);

	return (
		<div className="flex flex-row h-full">
			<ul className="menu h-full bg-base-200 rounded-box xl:min-w-40 min-2-30">
				<li>
					<Link to="/inventory">Summary</Link>
				</li>
				<li>
					<Link to="/inventory/upload">Upload</Link>
				</li>
			</ul>
			<div className="w-full overflow-auto">
				<div className="breadcrumbs pl-4">
					<ul>
						{crumbs.map((match) => (
							<li key={match.id} className="font-bold text-accent-content">
								<Link to={match.fullPath}>{match.loaderData?.crumb}</Link>
							</li>
						))}
					</ul>
				</div>
				<Outlet />
			</div>
		</div>
	);
}
