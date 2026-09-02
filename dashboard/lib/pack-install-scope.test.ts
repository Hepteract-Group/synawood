import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const panel = readFileSync(join(process.cwd(), 'app/(app)/settings/packs/packs-panel.tsx'), 'utf8')
const route = readFileSync(join(process.cwd(), 'app/api/studio/packs/route.ts'), 'utf8')
const migration = readFileSync(
  join(process.cwd(), '../supabase/migrations/0055_pack_install_account_scope.sql'),
  'utf8',
)

describe('Pack install scope (#954)', () => {
  it('lets the operator pick This organization or My account', () => {
    expect(panel).toContain('This organization')
    expect(panel).toContain('My account')
    expect(panel).toContain('scope: installScope')
    expect(route).toContain("scope: body.scope === 'account' ? 'account' : 'product'")
  })

  it('stores Account vs Product as xor user_id / product_id', () => {
    expect(migration).toContain('pack_installs_scope_xor')
    expect(migration).toContain('pack_installs_user_version_uidx')
    expect(migration).toContain('is_product_member')
  })
})
