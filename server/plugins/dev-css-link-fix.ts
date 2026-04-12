const GLOBAL_STYLESHEET_RE = /(<link rel="stylesheet" href=")((?:\/_nuxt\/assets\/css\/|\/_nuxt\/virtual:nuxt:)[^"]+)(" crossorigin>)/g
const DUPLICATE_ABSOLUTE_STYLESHEET_RE = /<link rel="stylesheet" href="\/_nuxt\/(?:C:\/[^\"]+|\.nuxt\/[^\"]+)" crossorigin>/g

function rewriteDevHtml(body: string) {
  const withoutAbsoluteDuplicates = body.replace(DUPLICATE_ABSOLUTE_STYLESHEET_RE, '')

  return withoutAbsoluteDuplicates.replace(GLOBAL_STYLESHEET_RE, (_, prefix: string, href: string, suffix: string) => {
    if (href.includes('vt-style-link=1')) {
      return `${prefix}${href}${suffix}`
    }

    const separator = href.includes('?') ? '&' : '?'
    return `${prefix}${href}${separator}vt-style-link=1${suffix}`
  })
}

export default defineNitroPlugin((nitroApp) => {
  if (process.env.NODE_ENV === 'production') {
    return
  }

  nitroApp.hooks.hook('render:response', (response) => {
    if (typeof response.body !== 'string' || !response.body.includes('rel="stylesheet"')) {
      return
    }

    response.body = rewriteDevHtml(response.body)
  })
})