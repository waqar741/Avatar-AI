import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudioStream } from './hooks/useAudioStream';
import { useMicrophone } from './hooks/useMicrophone';
import { AvatarCanvas } from './components/AvatarCanvas';
import { ChatUI } from './components/ChatUI';
import { StatusIndicator } from './components/StatusIndicator';
import type { PhonemeFrame } from './types/phoneme.types';
import type { ServerMessage } from './types/socket.types';

// Orchestration Layer
import { ConversationStateMachine } from './systems/ConversationStateMachine';
import type { ConversationState } from './systems/ConversationStateMachine';
import { SpeakingCoordinator } from './systems/SpeakingCoordinator';
import { PerformanceMonitor } from './utils/performance';

const WS_URL = 'ws://localhost:8000/ws/avatar';

function App() {
  const [transcript, setTranscript] = useState<string>("");
  const [phonemes, setPhonemes] = useState<PhonemeFrame[]>([]);
  const [appState, setAppState] = useState<ConversationState>('DISCONNECTED');
  const [wsErrorMessage, setWsErrorMessage] = useState<string | undefined>();

  // 1. Single source of Truth Models
  const stateMachine = useMemo(() => new ConversationStateMachine(), []);
  const perfMonitor = useMemo(() => new PerformanceMonitor(), []);

  // Sync React State natively with State Machine class bounding renders securely
  useEffect(() => {
    const unsubscribe = stateMachine.subscribe((state) => {
      setAppState(state);
    });
    perfMonitor.start();

    return () => {
      unsubscribe();
      perfMonitor.stop();
    };
  }, [stateMachine, perfMonitor]);

  // Audio subsystem Hooks
  const { pushAudioChunk, stopAudio, getContextTime } = useAudioStream();

  // 2. Speaking Coordinator Mapping Latency
  const coordinator = useMemo(() => new SpeakingCoordinator({
    stateMachine,
    onStartSpeaking: () => { },
    onStopSpeaking: () => { },
  }), [stateMachine]);

  const appendTranscript = useCallback((text: string) => {
    setTranscript(prev => prev + text);
  }, []);

  const handleWebSocketMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'token':
        if (msg.content) appendTranscript(msg.content);
        break;
      case 'audio_chunk':
        if (msg.data) {
          pushAudioChunk(msg.data);
          coordinator.notifyAudioChunkReceived(); // Early Latency Switch (THINKING -> SPEAKING)
        }
        break;
      case 'phoneme':
        if (msg.frames) setPhonemes(prev => [...prev, ...msg.frames]);
        break;
      case 'audio_done':
        coordinator.notifyAudioDone();
        break;
      case 'phoneme_done':
        coordinator.notifyPhonemesDone();
        break;
      case 'error':
        console.error("Backend Error:", msg.message);
        setWsErrorMessage(msg.message);
        break;
    }
  }, [appendTranscript, pushAudioChunk, coordinator]);

  const handleStatusChange = useCallback((status: 'connecting' | 'connected' | 'disconnected' | 'error') => {
    switch (status) {
      case 'connecting': stateMachine.safeTransition('CONNECTING'); break;
      case 'connected':
        stateMachine.safeTransition('IDLE');
        setWsErrorMessage(undefined);
        break;
      case 'disconnected': stateMachine.safeTransition('DISCONNECTED'); break;
      case 'error': stateMachine.forceErrorState(); break;
    }
  }, [stateMachine]);

  const { sendMessage } = useWebSocket({
    url: WS_URL,
    onMessage: handleWebSocketMessage,
    onStatusChange: handleStatusChange
  });

  // 3. User Interactions & Interruption Mapping
  const interruptAvatar = useCallback(() => {
    stopAudio();
    setPhonemes([]);
    coordinator.interruptAndClear();
  }, [stopAudio, coordinator]);

  const commitChatIntent = useCallback((text: string) => {
    if (!text.trim()) return;

    interruptAvatar(); // Violent halt to existing responses

    setTranscript(prev => prev + `\n\nYou: ${text}\nAvatar: `);
    stateMachine.safeTransition('THINKING'); // Instant Intelligence Feedback (Head switch natively responds)

    sendMessage({ type: 'chat', message: text });
  }, [interruptAvatar, stateMachine, sendMessage]);

  // Microphone Hook
  const { isListening, isSupported, interimText, startListening, stopListening } = useMicrophone(commitChatIntent);

  // Reflect strictly into StateMachine on manual UI changes
  useEffect(() => {
    if (isListening && appState === 'IDLE') {
      stateMachine.safeTransition('LISTENING');
    } else if (!isListening && appState === 'LISTENING') {
      stateMachine.safeTransition('IDLE'); // Should be overridden by THINKING immediately in commitChatIntent normally
    }
  }, [isListening, appState, stateMachine]);

  // Derive explicit UI status strings for display overlays
  const deriveStatusLabel = (): 'error' | 'disconnected' | 'listening' | 'speaking' | 'connected' => {
    if (appState === 'ERROR') return 'error';
    if (appState === 'DISCONNECTED') return 'disconnected';
    if (appState === 'LISTENING') return 'listening';
    if (appState === 'SPEAKING') return 'speaking';
    return 'connected';
  };

  return (
    <div className="w-full h-full bg-[#121212] flex items-center justify-center p-4">
      <StatusIndicator
        status={deriveStatusLabel()}
        errorMessage={appState === 'ERROR' ? (wsErrorMessage || "Connection Lost") : (!isSupported ? "Microphone APIs restricted" : undefined)}
      />

      {/* 3D Context Bounds */}
      <div className="w-full max-w-6xl h-full max-h-[900px] relative">
        <AvatarCanvas
          phonemes={phonemes}
          appState={appState}
          getAudioTime={getContextTime}
        />

        <ChatUI
          transcript={transcript}
          isListening={appState === 'LISTENING'}
          interimText={interimText}
          onStartMic={() => {
            interruptAvatar();
            startListening();
          }}
          onStopMic={stopListening}
          onSendMessage={commitChatIntent}
        />
      </div>
    </div>
  );
}

export default App;
