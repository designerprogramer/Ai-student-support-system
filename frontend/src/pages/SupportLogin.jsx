import SecureRoleLogin from '../components/SecureRoleLogin'

export default function SupportLogin() {
  return (
    <SecureRoleLogin
      role="support"
      title="Support Officer Login"
      description="Login with password and email OTP to access your dashboard and manage complaints."
    />
  )
}
