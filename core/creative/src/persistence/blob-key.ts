export const buildBlobKey = (input: {
  productId: string
  kind: 'uploads' | 'generated' | 'renders' | 'brand-kit' | 'finals' | 'library' | 'extract'
  parts: string[]
  localPrefix?: boolean
}): string => {
  const safeParts = input.parts.map((part) => part.replace(/^\/+|\/+$/g, '')).filter(Boolean)
  const base = ['marketing-os', input.productId, input.kind, ...safeParts]
  return input.localPrefix === false ? base.join('/') : ['local', ...base].join('/')
}
