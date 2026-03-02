import React from 'react';

type StatusState = 'disconnected' | 'connected' | 'listening' | 'speaking' | 'error';

interface StatusIndicatorProps {
    status: StatusState;
    errorMessage?: string;
}

const statusConfig: Record<StatusState, { color: string; label: string }> = {
    disconnected: { color: 'bg-yellow-500', label: 'Disconnected' },
    connected: { color: 'bg-green-500', label: 'Idle' },
    listening: { color: 'bg-blue-500', label: 'Listening...' },
    speaking: { color: 'bg-purple-500', label: 'Avatar Speaking' },
    error: { color: 'bg-red-500', label: 'Error' }
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, errorMessage }) => {
    const config = statusConfig[status];

    return (
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
            <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-xl transition-all duration-300">
                <div className={`w-3 h-3 rounded-full ${config.color} animate-pulse shadow-[0_0_10px_currentColor]`} />
                <span className="text-sm font-medium tracking-wide text-white/90">
                    {config.label}
                </span>
            </div>

            {status === 'error' && errorMessage && (
                <div className="bg-red-500/20 border border-red-500/50 backdrop-blur-md px-4 py-2 rounded-lg max-w-xs shadow-lg animate-in fade-in slide-in-from-top-4">
                    <p className="text-xs text-red-200">{errorMessage}</p>
                </div>
            )}
        </div>
    );
};
