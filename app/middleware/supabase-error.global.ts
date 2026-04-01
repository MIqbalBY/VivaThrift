export default defineNuxtRouteMiddleware((to) => {
  // Supabase redirects to Site URL with error params when token verification fails
  // (e.g. expired OTP). Catch these and redirect to forgot-password with a message.
  if (to.query.error_code === 'otp_expired' || to.query.error === 'access_denied') {
    return navigateTo({
      path: '/auth/forgot-password',
      query: { expired: 'true' },
    })
  }
})
