import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { AuthState } from '../context/auth'

interface RouterContext {
    auth: AuthState
}

export const Route = createRootRouteWithContext<RouterContext>()({
    component: () => (
        <div>
            <div className="navbar h-[8vh] p-0 bg-base-100 shadow-sm">
                <div className='navbar-start'>
                    <Link to="/" className="btn btn-ghost text-xl">MoneyLeh</Link>
                    <ul className="menu menu-horizontal px-1">
                        <li>
                            <Link to="/dashboard" activeProps={{ className: 'font-bold' }}>
                                Dashboard
                            </Link>
                        </li>
                        <li>
                            <Link to="/inventory" activeProps={{ className: 'font-bold' }}>
                                Inventory
                            </Link>
                        </li>
                    </ul>
                </div>
            </div>
            <div className='h-[92vh]'>
                <Outlet />
            </div>
            <TanStackRouterDevtools />
        </div>
    ),
})