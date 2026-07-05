import RoleSidebar from './RoleSidebar'
import { useLocation } from 'react-router-dom'

export default function RoleLayout({ role, children }) {
  const location = useLocation()
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <RoleSidebar role={role} />
      <main className="h-screen min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div key={location.pathname} className="dashboard-page min-w-0 p-6">{children}</div>
      </main>
    </div>
  )
}
