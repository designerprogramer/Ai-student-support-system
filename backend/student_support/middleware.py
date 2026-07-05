class SecurityHeadersMiddleware:
    CSP_VALUE = (
        "default-src 'self'; "
        "script-src 'self'; "
        "img-src 'self' data: blob:; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "frame-ancestors 'none';"
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response['Content-Security-Policy'] = self.CSP_VALUE
        response['X-Content-Type-Options'] = 'nosniff'
        response['Referrer-Policy'] = 'same-origin'
        return response
