import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-red-950 text-white font-mono">
                    <h1 className="text-2xl font-bold mb-4">React Render Crash</h1>
                    <p className="mb-4">Check console for full trace.</p>
                    <pre className="bg-black/50 p-4 rounded text-sm overflow-auto max-w-full">
                        {this.state.error?.message}
                        {'\n'}
                        {this.state.error?.stack}
                    </pre>
                </div>
            );
        }

        return this.props.children;
    }
}
