import { createFileRoute, Link, Outlet, useMatches, isMatch } from "@tanstack/react-router";

export const Route = createFileRoute('/_authenticated/inventory')({
    component: InventoryLayoutComponent,
    loader: () => ({ crumb: "Summary" })
})


function InventoryLayoutComponent() {
    const matches = useMatches()

    const crumbs = matches.filter((match) => isMatch(match, 'loaderData.crumb'))

    return (
        <div className="flex flex-row h-full">
            <ul className="menu h-full bg-base-200 rounded-box w-56">
                <li><Link to="/inventory">Summary</Link></li>
                <li><Link to="/inventory/upload">Upload</Link></li>
            </ul>
            <div className="w-full overflow-auto">
                <div className="breadcrumbs pl-4">
                    <ul>{crumbs.map((match) => (<li>
                        <Link to={match.fullPath}>{match.loaderData?.crumb}
                        </Link></li>))}</ul>
                </div>
                <Outlet />
            </div>
        </div>
    )
}