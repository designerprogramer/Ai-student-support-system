from rest_framework.throttling import AnonRateThrottle


class RoleLoginRateThrottle(AnonRateThrottle):
    scope = 'role_login'


class OTPVerifyRateThrottle(AnonRateThrottle):
    scope = 'otp_verify'


class PasswordResetRateThrottle(AnonRateThrottle):
    scope = 'password_reset'
