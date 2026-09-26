import { History, LoaderCircle } from 'lucide-react'
import type { LegacyMigrationStatus } from '../types'

type LegacyMigrationControlProps = {
  status: LegacyMigrationStatus | null
  running: boolean
  onRun(): void
}

export function LegacyMigrationControl({ status, running, onRun }: LegacyMigrationControlProps) {
  const description = status?.needsBrowserStorageRepair
    ? 'Restore the previous local characters, projects, and workspace state. This replaces Oyama browser-backed workspace data, then requires a restart.'
    : status?.migrated
      ? 'The previous MiniMax Studio profile was imported. Run this again only to collect files added to the old app after the first import.'
      : status?.available
        ? 'Import your previous MiniMax Studio profile into Oyama. Existing Oyama data is never replaced.'
        : 'No previous MiniMax Studio profile was found on this computer.'

  return <div className="legacy-migration-settings">
    <div>
      <strong>Previous Studio data</strong>
      <small>{description}</small>
      {status?.repairError && <p className="settings-note warning" role="alert">The last restore could not finish: {status.repairError}. Close other Oyama windows before retrying. Your previous profile remains in place.</p>}
    </div>
    <button type="button" className="secondary-button" disabled={!status?.available || running} onClick={onRun}>
      {running ? <LoaderCircle className="spin" size={15} /> : <History size={15} />}
      {running ? 'Importing…' : status?.needsBrowserStorageRepair ? 'Restore projects & characters' : status?.migrated ? 'Import missing data again' : 'Import previous data'}
    </button>
  </div>
}
