import type { WorkspaceProjectScope } from './workspaceNavigation'

export type WorkspaceProject = { id: string; name: string; scope: WorkspaceProjectScope; snapshot: Record<string, unknown>; createdAt: number; updatedAt: number }
export const WORKSPACE_PROJECTS_KEY = 'minimax.workspace-projects'

export function loadWorkspaceProjects(): WorkspaceProject[] {
  try {
    const stored = JSON.parse(localStorage.getItem(WORKSPACE_PROJECTS_KEY) ?? '[]') as WorkspaceProject[]
    return Array.isArray(stored) ? stored.filter((project) => project && typeof project.id === 'string' && typeof project.name === 'string' && ['create', 'ltx25', 'ltxripple', 'zimage', 'music', 'music3'].includes(project.scope) && project.snapshot && typeof project.snapshot === 'object').slice(0, 80) : []
  } catch { return [] }
}
