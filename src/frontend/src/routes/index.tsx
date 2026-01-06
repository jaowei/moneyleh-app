import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({
      to: '/login',
      search: {
        redirect: location.href
      }
    })
  },
  component: () => <Outlet />,
})

