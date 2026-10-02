import { useState } from 'react'
import { Archive, FileJson, ShieldAlert } from 'lucide-react'
import type { Note } from '../../types/editor'
import { analyzeImportConflicts, type ImportConflictChoice } from '../../utils/backup'
import type { ImportedBackup } from '../../services/backupService'
import { Modal } from '../common/Controls'

interface ImportBackupDialogProps {
  backup: ImportedBackup
  fileName: string
  fileSize: number
  existingNotes: Note[]
  onClose: () => void
  onImport: (choice: ImportConflictChoice) => boolean
}

const largeFileWarningBytes = 20 * 1024 * 1024

export function ImportBackupDialog({ backup, fileName, fileSize, existingNotes, onClose, onImport }: ImportBackupDialogProps) {
  const [choice, setChoice] = useState<ImportConflictChoice>('skip')
  const summary = analyzeImportConflicts(existingNotes, backup.notes)
  const isZip = fileName.toLocaleLowerCase().endsWith('.zip')

  return <Modal title="Import notes backup" onClose={onClose}>
    <div className="backup-file-summary">{isZip ? <Archive size={18} /> : <FileJson size={18} />}<div><strong>{fileName}</strong><span>{backup.notes.length} notes · {(fileSize / (1024 * 1024)).toFixed(1)} MB</span></div></div>
    {fileSize > largeFileWarningBytes && <p className="backup-warning"><ShieldAlert size={15} />This backup is over 20 MB. Import may take a moment.</p>}
    {backup.warnings.map((warning) => <p className="backup-warning" key={warning}><ShieldAlert size={15} />{warning}</p>)}
    <div className="backup-import-counts"><span><strong>{summary.newCount}</strong> new</span><span><strong>{summary.conflicts.length}</strong> conflicting by ID or title</span></div>
    {summary.conflicts.length > 0 && <fieldset className="backup-conflict-options"><legend>For conflicting notes</legend>{([
      ['skip', 'Skip', 'Keep the existing note unchanged.'],
      ['duplicate', 'Duplicate', 'Import a separate copy with a unique title.'],
      ['replace', 'Replace', 'Replace the matching note after a history snapshot.'],
    ] as const).map(([value, label, description]) => <label key={value}><input type="radio" name="backup-conflict-choice" checked={choice === value} onChange={() => setChoice(value)} /><span><strong>{label}</strong><small>{description}</small></span></label>)}</fieldset>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="button" className="primary-button" onClick={() => { if (onImport(choice)) onClose() }}>Import {summary.newCount + (choice === 'skip' ? 0 : summary.conflicts.length)} notes</button></div>
  </Modal>
}