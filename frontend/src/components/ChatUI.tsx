import React, { useState, useEffect, useRef } from 'react';

interface ChatUIProps {
    transcript: string;
    isListening: boolean;
    interimText: string;
    onStartMic: () => void;
    onStopMic: () => void;
    onSendMessage: (msg: string) => void;
}

export const ChatUI: React.FC<ChatUIProps> = ({
    transcript,
    isListening,
    interimText,
    onStartMic,
    onStopMic,
    onSendMessage
}) => {
    const [inputText, setInputText] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto scroll narrative transcript downward natively
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [transcript, interimText]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputText.trim()) {
            onSendMessage(inputText.trim());
            setInputText("");
        }
    };

    return (
        <div className="absolute bottom-6 right-6 w-96 max-h-[60vh] flex flex-col gap-4 z-10 pointers-events-auto">

            {/* Transcript Panel Backdrop */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 scroll-smooth"
            >
                {transcript ? (
                    <div className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">
                        {transcript}
                    </div>
                ) : (
                    <div className="text-xs text-white/30 italic m-auto">
                        Awaiting interaction...
                    </div>
                )}

                {interimText && (
                    <div className="text-sm text-blue-200/60 italic animate-pulse">
                        {interimText}
                    </div>
                )}
            </div>

            {/* Input Controls */}
            <form onSubmit={handleSend} className="flex gap-2 items-center bg-black/40 backdrop-blur-md p-2 rounded-full border border-white/10 shadow-lg">
                <button
                    type="button"
                    onMouseDown={onStartMic}
                    onMouseUp={onStopMic}
                    onMouseLeave={onStopMic}
                    onTouchStart={onStartMic}
                    onTouchEnd={onStopMic}
                    className={`p-3 rounded-full transition-all duration-300 ${isListening
                            ? 'bg-red-500 text-white scale-110 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                            : 'bg-white/10 hover:bg-white/20 text-white/80'
                        }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                </button>

                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type or hold mic..."
                    className="flex-1 bg-transparent border-none outline-none text-white text-sm px-2 placeholder:text-white/30"
                />

                <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="p-2.5 rounded-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:bg-white/10 text-white transition-colors"
                >
                    <svg className="w-4 h-4 translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                </button>
            </form>
        </div>
    );
};
