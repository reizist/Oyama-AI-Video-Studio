export type WorkspaceSectionTab<Id extends string> = { id: Id; label: string; description?: string }

export function WorkspaceSectionTabs<Id extends string>({ tabs, active, onChange, label }: {
  tabs: readonly WorkspaceSectionTab<Id>[]
  active: Id
  onChange(id: Id): void
  label: string
}) {
  return <nav className="workspace-section-tabs" aria-label={label}>
    {tabs.map(tab => <button key={tab.id} type="button" className={active === tab.id ? 'active' : ''} aria-current={active === tab.id ? 'page' : undefined} onClick={() => onChange(tab.id)} title={tab.description}>
      <strong>{tab.label}</strong>{tab.description && <small>{tab.description}</small>}
    </button>)}
  </nav>
}
