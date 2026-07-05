import { useState, useEffect } from 'react'
import { getAuthSession } from '../lib/auth'
import Sidebar from '../pages/student_dashboard/Sidebar'
import { useLocation } from 'react-router-dom'

export default function Layout({ children }) {
  const [user, setUser] = useState(null)
  const location = useLocation()

  useEffect(() => {
    const session = getAuthSession()
    if (session?.user) {
      setUser(session.user)
    }
  }, [])

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Fixed width, no margins */}
      <Sidebar user={user} />

      {/* Main Content - Takes remaining space */}
      <main className="flex-1 overflow-auto">
        <div key={location.pathname} className="dashboard-page p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
