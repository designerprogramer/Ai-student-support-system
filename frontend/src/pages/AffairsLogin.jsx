import SecureRoleLogin from '../components/SecureRoleLogin'

export default function AffairsLogin() {
  return (
    <SecureRoleLogin
      role="affairs"
      title="Affairs Login"
      description="Login with password and email OTP to review student complaints and manage student affairs."
    />
  )
}
