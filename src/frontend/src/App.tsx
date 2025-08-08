import { RouterProvider } from '@tanstack/react-router'
import { AuthProvider, useAuth } from './context/auth'
import { router } from './router'
import './App.css'

function InnerApp() {
  const auth = useAuth()
  return <RouterProvider router={router} context={{ auth }} />
}

function App() {
  return (
    <AuthProvider>
      <InnerApp />
    </AuthProvider>
  )
}

export default App