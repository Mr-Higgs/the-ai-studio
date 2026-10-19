export function safeNextPath(value) {
  return typeof value === 'string'
    && value.startsWith('/')
    && !value.startsWith('//')
    && !value.startsWith('/\\')
    ? value
    : '/';
}

export function authCallbackUrl(next = '/') {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  const url = new URL('/auth/callback', base);
  url.searchParams.set('next', safeNextPath(next));
  return url.toString();
}
