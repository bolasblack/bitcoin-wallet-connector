export function hasAny<T>(ary: T[]): ary is [T, ...T[]]
export function hasAny<T>(ary: readonly T[]): ary is readonly [T, ...T[]]
export function hasAny<T>(ary: readonly T[]): ary is readonly [T, ...T[]] {
  return ary.length > 0
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function checkNever(x: never): undefined {
  return
}
