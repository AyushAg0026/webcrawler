import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState } from './states';

interface State {
  error: Error | null;
}

/**
 * Catches errors thrown while rendering, so one broken component shows a
 * friendly message instead of a blank white page. (Error boundaries still
 * have to be class components in React.)
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <ErrorState
        title="This page crashed"
        message={this.state.error.message || 'An unexpected error happened while showing this page.'}
        action={<Button onClick={() => window.location.reload()}>Reload page</Button>}
      />
    );
  }
}
