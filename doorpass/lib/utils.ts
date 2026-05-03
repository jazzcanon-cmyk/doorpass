import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const ADDRESS_SHORTCUTS: Array<[RegExp, string]> = [
  [/울산광역시/g, '울산'],
  [/부산광역시/g, '부산'],
  [/대구광역시/g, '대구'],
  [/경상남도/g, '경남'],
]

export function shortenAddress(address: string | null | undefined): string {
  if (!address) return ''
  let result = address
  for (const [pattern, replacement] of ADDRESS_SHORTCUTS) {
    result = result.replace(pattern, replacement)
  }
  return result
}
