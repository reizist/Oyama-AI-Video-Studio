import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { createId } from '../lib/createId'
import { sanitizeError } from '../lib/logSanitize'

type ErrorBoundaryProps = { children: ReactNode }
type ErrorBoundaryState = { failed: false } | { failed: true; reason: string; path: string; reference: string }

/** Keeps an unexpected React rendering failure from becoming a blank window. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const detail = sanitizeError(error)
    return { failed: true, reason: detail.reason, path: detail.path, reference: createId().slice(0, 8) }
  }

  componentDidCatch(error: unknown) {
    const detail = sanitizeError(error)
    const reference = this.state.failed ? this.state.reference : 'unknown'
    // Keep a correlation handle for support without writing user prompt text
    // into DevTools logs.
    console.error(`[ui-boundary] ref=${reference} name=${detail.name} reason=${detail.reason} path=${detail.path}`)
  }

  private reloadView = () => this.setState({ failed: false })

  render() {
    if (this.state.failed) {
      return <main className="app-error-boundary" role="alert">
        <AlertTriangle size={32} aria-hidden="true" />
        <h1>This view hit an error</h1>
        <p>The workspace is still open. Reload this view to try again.</p>
        <code>{this.state.reason}</code>
        {this.state.path && <small>{this.state.path}</small>}
        <small>Support reference: {this.state.reference}</small>
        <button type="button" className="secondary-button" onClick={this.reloadView}><RotateCcw size={15} />Reload view</button>
      </main>
    }
    return this.props.children
  }
}
