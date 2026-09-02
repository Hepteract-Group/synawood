/** Required Product id for ops scripts — no baked default (issue #901). */

export const readRequiredProductId = (
  argv: string[],
  env: Record<string, string | undefined>,
): string => {
  const flagIndex = argv.indexOf('--product-id')
  if (flagIndex >= 0) {
    const value = argv[flagIndex + 1]?.trim()
    if (!value || value.startsWith('-')) {
      throw new Error('Pass --product-id <id> or PRODUCT_ID')
    }
    return value
  }
  const fromEnv = env.PRODUCT_ID?.trim()
  if (fromEnv) return fromEnv
  throw new Error('Pass --product-id <id> or PRODUCT_ID')
}
