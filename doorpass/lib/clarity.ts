export function identifyUser(email: string, name: string) {
  if (typeof window !== 'undefined') {
    const clarity = (window as any).clarity
    if (!clarity) return
    clarity('identify', email, undefined, undefined, name)
    clarity('set', 'email', email)
    clarity('set', 'name', name)
  }
}
