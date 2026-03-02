import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudioStream } from './hooks/useAudioStream';
import { useMicrophone } from './hooks/useMicrophone';
import { AvatarCanvas } from './components/AvatarCanvas';
import { ChatUI } from './components/ChatUI';
import { StatusIndicator } from './components/StatusIndicator';
import { PhonemeFrame } from './types/phoneme.types';
import { ServerMessage } from './types/socket.types';

// Enforce single connection pointing directly to FastAPI Uvicorn backend natively
const WS_URL = 'ws://localhost:8000/ws/avatar';

function App() {
  const [transcript, setTranscript] = useState<string>("");
  const [phonemes, setPhonemes] = useState<PhonemeFrame[]>([]);
  const { isPlaying, pushAudioChunk, stopAudio, getContextTime } = useAudioStream();

  // Track continuous narrative externally bypassing WebSocket state loops
  const appendTranscript = useCallback((text: string) => {
    setTranscript(prev => prev + text);
  }, []);

  const handleWebSocketMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'token':
        if (msg.content) appendTranscript(msg.content);
        break;
      case 'audio_chunk':
        if (msg.data) pushAudioChunk(msg.data);
        break;
      case 'phoneme':
        if (msg.frames) setPhonemes(msg.frames);
        break;
      case 'error':
        console.error("Backend pipeline error:", msg.message);
        // Do not crash the UI immediately, attempt recovery through reconnects
        break;
      case 'audio_done':
      case 'phoneme_done':
      case 'done':
      case 'heartbeat':
        break;
    }
  }, [appendTranscript, pushAudioChunk]);

  const { isConnected, error: wsError, sendMessage } = useWebSocket({
    url: WS_URL,
    onMessage: handleWebSocketMessage,
  });

  // Attach Microphone constraints mapping natively bound triggers
  const handleVoiceInput = useCallback((text: string) => {
    if (text.trim()) {
      setTranscript(prev => prev + `\n\nYou: ${text}\nAvatar: `);
      sendMessage({ type: 'chat', message: text });
      // Stop lingering responses before pushing new intent
      stopAudio();
      setPhonemes([]);
    }
  }, [sendMessage, stopAudio]);

  const { isListening, isSupported, interimText, startListening, stopListening } = useMicrophone(handleVoiceInput);

  const handleTextMessage = useCallback((text: string) => {
    setTranscript(prev => prev + `\n\nYou: ${text}\nAvatar: `);
    sendMessage({ type: 'chat', message: text });
    stopAudio();
    setPhonemes([]);
  }, [sendMessage, stopAudio]);

  // Determine structural view states implicitly mapping combinations
  const determineStatus = () => {
    if (wsError) return 'error';
    if (!isConnected) return 'disconnected';
    if (isListening) return 'listening';
    if (isPlaying) return 'speaking';
    return 'connected';
  };

  return (
    <div className="w-full h-full bg-[#121212] flex items-center justify-center p-4">
      <StatusIndicator
        status={determineStatus()}
        errorMessage={wsError || (!isSupported ? "Microphone APIs restricted by browser" : undefined)}
      />

      {/* 3D Context Boundary */}
      <div className="w-full max-w-6xl h-full max-h-[900px] relative">
        <AvatarCanvas
          phonemes={phonemes}
          isPlayingAudio={isPlaying}
          getAudioTime={getContextTime}
        />

        <ChatUI
          transcript={transcript}
          isListening={isListening}
          interimText={interimText}
          onStartMic={startListening}
          onStopMic={stopListening}
          onSendMessage={handleTextMessage}
        />
      </div>
    </div>
  );
}

export default App;
