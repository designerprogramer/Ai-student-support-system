export default function Layout({ children }) {
  return (
    <div className="flex h-screen bg-gray-50">

      {/* Sidebar */}
      <div className="w-[260px] h-screen fixed left-0 top-0 border-r bg-white">
        <SidebarPage />
      </div>

      {/* Main Content */}
      <div className="flex-1 ml-[260px] overflow-y-auto">
        <div className="p-6">
          {children}
        </div>
      </div>

    </div>
  )
}