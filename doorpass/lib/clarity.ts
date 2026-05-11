export function identifyUser(email: string, name: string) {
  if (typeof window === 'undefined') return

  const tryIdentify = (attempts: number) => {
    const clarity = (window as any).clarity
    if (clarity) {
      clarity('identify', email, undefined, undefined, name)
      clarity('set', 'email', email)
      clarity('set', 'name', name)
      return
    }
    if (attempts > 0) {
      setTimeout(() => tryIdentify(attempts - 1), 1000)
    }
  }

  tryIdentify(10)
}
