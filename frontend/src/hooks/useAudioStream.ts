import { useEffect, useRef, useCallback, useState } from 'react';
import { AudioQueueSystem } from '../systems/AudioQueueSystem';

export const useAudioStream = () => {
    const audioSystemRef = useRef<AudioQueueSystem | null>(null);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);

    // Initializer wrapping to avert rigid browser audio context policy issues
    useEffect(() => {
        if (!audioSystemRef.current) {
            audioSystemRef.current = new AudioQueueSystem();
        }

        const pollInterval = setInterval(() => {
            if (audioSystemRef.current) {
                setIsPlaying(audioSystemRef.current.isCurrentlyPlaying());
            }
        }, 100);

        return () => {
            clearInterval(pollInterval);
            if (audioSystemRef.current) {
                audioSystemRef.current.dispose();
                audioSystemRef.current = null;
            }
        };
    }, []);

    const pushAudioChunk = useCallback((base64Data: string) => {
        if (audioSystemRef.current) {
            audioSystemRef.current.enqueueBase64Audio(base64Data);
        }
    }, []);

    const stopAudio = useCallback(() => {
        if (audioSystemRef.current) {
            audioSystemRef.current.stopAndClear();
            setIsPlaying(false);
        }
    }, []);

    const getContextTime = useCallback(() => {
        return audioSystemRef.current?.audioContext.currentTime || 0;
    }, []);

    return {
        isPlaying,
        pushAudioChunk,
        stopAudio,
        getContextTime
    };
};
