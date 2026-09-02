import {
  costEventGbp,
  listCostEventsForProducts,
  readCreativeBudgets,
  type CostEventRow,
} from '@synawood/creative/pricing'
import { listMembershipsForUser } from '@/lib/product-onboarding'
import { requireUser } from '@/lib/require-user'
import {
  getStudioClients,
  handleRouteError,
  jsonError,
  requireStudioAccess,
} from '@/lib/studio-server'

const sinceDaysAgoIso = (days: number): string =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

const projectLabelFromJson = (projectJson: unknown, fallbackId: string): string => {
  if (projectJson && typeof projectJson === 'object' && 'name' in projectJson) {
    const name = (projectJson as { name?: unknown }).name
    if (typeof name === 'string' && name.trim()) return name.trim()
  }
  return `Project ${fallbackId.slice(0, 8)}`
}

const aggregateByKey = (
  rows: CostEventRow[],
  keyOf: (row: CostEventRow) => string,
): Map<string, number> => {
  const map = new Map<string, number>()
  for (const row of rows) {
    const key = keyOf(row)
    map.set(key, (map.get(key) ?? 0) + costEventGbp(row))
  }
  return map
}

export const GET = async (request: Request) => {
  try {
    const productParam = new URL(request.url).searchParams.get('productId')?.trim() || 'all'
    const { supabase } = getStudioClients()
    const user = await requireUser()
    const memberships = await listMembershipsForUser(supabase, user.id)
    const allowed = memberships.map((m) => ({
      id: m.product.id,
      slug: m.product.slug,
      name: m.product.name,
    }))

    if (allowed.length === 0) {
      return jsonError('Create or join a Product first.', 400)
    }

    const scopeIds =
      productParam === 'all'
        ? allowed.map((p) => p.id)
        : allowed.some((p) => p.id === productParam)
          ? [productParam]
          : null

    if (!scopeIds) {
      return jsonError('Unknown or inaccessible Product.', 403)
    }

    // Single-product path still goes through role gate for consistency with Studio APIs.
    if (productParam !== 'all') {
      await requireStudioAccess({ productId: productParam, minRole: 'viewer' })
    }

    const monthSince = sinceDaysAgoIso(31)
    const weekSince = sinceDaysAgoIso(7)
    const budgets = readCreativeBudgets()

    const [monthEvents, weekEvents, allEvents, recent] = await Promise.all([
      listCostEventsForProducts(supabase, { productIds: scopeIds, sinceIso: monthSince }),
      listCostEventsForProducts(supabase, { productIds: scopeIds, sinceIso: weekSince }),
      listCostEventsForProducts(supabase, { productIds: scopeIds }),
      listCostEventsForProducts(supabase, {
        productIds: scopeIds,
        limit: 80,
      }),
    ])

    const monthGbp = monthEvents.reduce((sum, row) => sum + costEventGbp(row), 0)
    const weekGbp = weekEvents.reduce((sum, row) => sum + costEventGbp(row), 0)
    const totalGbp = allEvents.reduce((sum, row) => sum + costEventGbp(row), 0)

    const monthByProduct = aggregateByKey(monthEvents, (row) => row.product_id)
    const totalByProduct = aggregateByKey(allEvents, (row) => row.product_id)
    const byProduct = allowed
      .filter((p) => scopeIds.includes(p.id))
      .map((p) => ({
        productId: p.id,
        name: p.name,
        slug: p.slug,
        monthGbp: monthByProduct.get(p.id) ?? 0,
        totalGbp: totalByProduct.get(p.id) ?? 0,
      }))
      .sort((a, b) => b.monthGbp - a.monthGbp)

    const projectIds = [
      ...new Set(
        monthEvents.map((row) => row.project_id).filter((id): id is string => Boolean(id)),
      ),
    ]
    const projectNames = new Map<string, string>()
    if (projectIds.length > 0) {
      const { data: projects, error: projectsError } = await supabase
        .from('studio_projects')
        .select('id, project_json')
        .in('id', projectIds)
      if (projectsError) {
        throw new Error(projectsError.message)
      }
      for (const project of projects ?? []) {
        projectNames.set(
          project.id as string,
          projectLabelFromJson(project.project_json, project.id as string),
        )
      }
    }

    const monthByProject = aggregateByKey(monthEvents, (row) => row.project_id ?? '__unassigned__')
    const byProject = [...monthByProject.entries()]
      .map(([key, gbp]) => ({
        projectId: key === '__unassigned__' ? null : key,
        label:
          key === '__unassigned__'
            ? 'Unassigned'
            : (projectNames.get(key) ?? `Project ${key.slice(0, 8)}`),
        gbp,
      }))
      .filter((slice) => slice.gbp > 0)
      .sort((a, b) => b.gbp - a.gbp)

    return Response.json({
      scope: productParam === 'all' ? 'all' : productParam,
      products: allowed,
      spent: { monthGbp, weekGbp, totalGbp },
      budgets,
      remainingMonthlyGbp:
        productParam === 'all' ? null : Math.max(0, budgets.monthlyGeneratorCap - monthGbp),
      byProduct,
      byProject,
      recent: recent.map((row) => ({
        id: row.id,
        product_id: row.product_id,
        role: row.role,
        model_id: row.model_id,
        estimated_gbp: row.estimated_gbp,
        actual_gbp: row.actual_gbp,
        project_id: row.project_id,
        created_at: row.created_at,
      })),
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to load costs')
  }
}
