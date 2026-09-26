import { useEffect } from 'react'
import { HardDrive, HelpCircle, X } from 'lucide-react'
import type { View } from '../types'
import { setupGuide, workspaceTips } from '../lib/workspaceTips'

export function WorkspaceTips({ view, onClose }: { view: View; onClose(): void }) {
  const content = workspaceTips[view]
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])
  return <div className="tips-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="tips-modal" role="dialog" aria-modal="true" aria-labelledby="tips-modal-title"><header><div><span className="tips-modal-icon"><HelpCircle size={18} /></span><span><small>WORKSPACE TIPS</small><strong id="tips-modal-title">{content.title}</strong><p>{content.description}</p></span></div><button className="icon-button" onClick={onClose} aria-label="Close workspace tips"><X size={18} /></button></header><div className="tips-modal-body">{content.tips.map(([title, text], index) => <article key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{title}</strong><p>{text}</p></div></article>)}<section className="tips-setup-guide" aria-labelledby="tips-setup-guide-title"><header><span><HardDrive size={15} /></span><div><small>COMPLETE LOCAL SETUP</small><strong id="tips-setup-guide-title">Models, nodes, and optional tools</strong><p>Use this checklist for the features you want. Every item stays local to your workstation.</p></div></header>{setupGuide.map(([title, text], index) => <article key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{title}</strong><p>{text}</p></div></article>)}</section></div><footer><span><HelpCircle size={14} />Tips update with the workspace you are viewing.</span><button className="secondary-button" onClick={onClose}>Done</button></footer></section></div>
}

