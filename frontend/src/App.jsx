import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import RoleLayout from './components/RoleLayout'
import Dashboard from './pages/student_dashboard/Dashboard'
import Complaints from './pages/student_dashboard/Complaints'
import ComplaintDetail from './pages/student_dashboard/ComplaintDetail'
import NewComplaint from './pages/student_dashboard/NewComplaint'
import Settings from './pages/student_dashboard/setting'
import StudentReminders from './pages/student_dashboard/Reminders'
import StudentReports from './pages/student_dashboard/Reports'
import RoleProtectedRoute from './components/RoleProtectedRoute'
import Login from './pages/Login'
import SupportLogin from './pages/SupportLogin'
import AffairsLogin from './pages/AffairsLogin'
import AdminLogin from './pages/AdminLogin'
import Landing from './pages/Landing'
import SupportOfficerDashboard from './pages/Support Officer/dashboard'
import SupportOfficerReminders from './pages/Support Officer/Reminders'
import AffairsDashboard from './pages/affairs_dashboard/dashboard'
import AffairsComplaintReview from './pages/affairs_dashboard/ComplaintReview'
import AffairsReminders from './pages/affairs_dashboard/Reminders'
import AdminDashboard from './pages/admin_dashboard/dashboard'
import AdminComplaints from './pages/admin_dashboard/Complaints'
import AdminEscalations from './pages/admin_dashboard/Escalations'
import AdminReminders from './pages/admin_dashboard/Reminders'
import AdminReports from './pages/admin_dashboard/Reports'
import AdminSecurityLogs from './pages/admin_dashboard/SecurityLogs'
import AdminUserManagement from './pages/admin_dashboard/UserManagement'
import AccountSettings from './pages/AccountSettings'

function StudentLayout({ children }) {
  return (
    <RoleProtectedRoute allowedRoles={['student']}>
      <Layout>{children}</Layout>
    </RoleProtectedRoute>
  )
}

function SupportLayout({ children }) {
  return (
    <RoleProtectedRoute allowedRoles={['support_officer']}>
      <RoleLayout role="support_officer">{children}</RoleLayout>
    </RoleProtectedRoute>
  )
}

function AffairsLayout({ children }) {
  return (
    <RoleProtectedRoute allowedRoles={['affairs']}>
      <RoleLayout role="affairs">{children}</RoleLayout>
    </RoleProtectedRoute>
  )
}

function AdminLayout({ children }) {
  return (
    <RoleProtectedRoute allowedRoles={['admin']}>
      <RoleLayout role="admin">{children}</RoleLayout>
    </RoleProtectedRoute>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Navigate to="/student/login" replace />} />
      <Route path="/student/login" element={<Login />} />
      <Route path="/support/login" element={<SupportLogin />} />
      <Route path="/affairs/login" element={<AffairsLogin />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      <Route path="/dashboard" element={<Navigate to="/student/dashboard" replace />} />
      <Route path="/complaints" element={<Navigate to="/student/complaints" replace />} />
      <Route path="/complaints/new" element={<Navigate to="/student/complaints/new" replace />} />
      <Route path="/reports" element={<Navigate to="/student/dashboard" replace />} />
      <Route path="/sidebar" element={<Navigate to="/student/dashboard" replace />} />

      <Route
        path="/student/dashboard"
        element={
          <StudentLayout>
            <Dashboard />
          </StudentLayout>
        }
      />
      <Route
        path="/student/complaints"
        element={
          <StudentLayout>
            <Complaints />
          </StudentLayout>
        }
      />
      <Route
        path="/student/complaints/new"
        element={
          <StudentLayout>
            <NewComplaint />
          </StudentLayout>
        }
      />
      <Route
        path="/student/complaints/:id"
        element={
          <StudentLayout>
            <ComplaintDetail />
          </StudentLayout>
        }
      />
      <Route
        path="/student/reports"
        element={
          <StudentLayout>
            <StudentReports />
          </StudentLayout>
        }
      />
      <Route
        path="/student/setting"
        element={
          <StudentLayout>
            <Settings />
          </StudentLayout>
        }
      />
      <Route
        path="/student/reminders"
        element={
          <StudentLayout>
            <StudentReminders />
          </StudentLayout>
        }
      />

      <Route
        path="/support/dashboard"
        element={
          <SupportLayout>
            <SupportOfficerDashboard />
          </SupportLayout>
        }
      />
      <Route
        path="/support/reminders"
        element={
          <SupportLayout>
            <SupportOfficerReminders />
          </SupportLayout>
        }
      />
      <Route
        path="/support/settings"
        element={
          <SupportLayout>
            <AccountSettings />
          </SupportLayout>
        }
      />

      <Route
        path="/affairs/dashboard"
        element={
          <AffairsLayout>
            <AffairsDashboard />
          </AffairsLayout>
        }
      />
      <Route
        path="/affairs/complaints"
        element={
          <AffairsLayout>
            <AffairsComplaintReview />
          </AffairsLayout>
        }
      />
      <Route
        path="/affairs/reminders"
        element={
          <AffairsLayout>
            <AffairsReminders />
          </AffairsLayout>
        }
      />
      <Route
        path="/affairs/settings"
        element={
          <AffairsLayout>
            <AccountSettings />
          </AffairsLayout>
        }
      />

      <Route
        path="/admin/dashboard"
        element={
          <AdminLayout>
            <AdminDashboard />
          </AdminLayout>
        }
      />
      <Route path="/admin/complaint" element={<Navigate to="/admin/complaints" replace />} />
      <Route
        path="/admin/complaints"
        element={
          <AdminLayout>
            <AdminComplaints />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminLayout>
            <AdminUserManagement />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/escalations"
        element={
          <AdminLayout>
            <AdminEscalations />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/reminders"
        element={
          <AdminLayout>
            <AdminReminders />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <AdminLayout>
            <AdminReports />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/security-logs"
        element={
          <AdminLayout>
            <AdminSecurityLogs />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <AdminLayout>
            <AccountSettings />
          </AdminLayout>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
