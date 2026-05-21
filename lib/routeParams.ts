export type AsyncRouteParams<T extends string> = Promise<Record<T, string>>

export async function getRouteParam<T extends string>(
  params: AsyncRouteParams<T>,
  key: T,
): Promise<string> {
  const resolvedParams = await params
  return resolvedParams[key] ?? ''
}

export async function getDecodedRouteParam<T extends string>(
  params: AsyncRouteParams<T>,
  key: T,
): Promise<string> {
  const value = await getRouteParam(params, key)
  return value ? decodeURIComponent(value) : ''
}
