import SecureRoleLogin from '../components/SecureRoleLogin'

export default function AdminLogin() {
  return (
    <SecureRoleLogin
      role="admin"
      title="Admin Login"
      description="Login with password and email OTP to access admin reports, security logs, users, and escalations."
    />
  )
}
