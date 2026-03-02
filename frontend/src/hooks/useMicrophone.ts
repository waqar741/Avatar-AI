import { useState, useEffect, useCallback, useRef } from 'react';

// Browsers utilize distinct proprietary prefixes for speech recognition
const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const useMicrophone = (onFinalTranscript: (text: string) => void) => {
    const [isListening, setIsListening] = useState(false);
    const [isSupported, setIsSupported] = useState(true);
    const [interimText, setInterimText] = useState("");
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (!SpeechRecognitionAPI) {
            setIsSupported(false);
            return;
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onresult = (event: any) => {
            let finalOutput = '';
            let interimOutput = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalOutput += event.results[i][0].transcript;
                } else {
                    interimOutput += event.results[i][0].transcript;
                }
            }

            setInterimText(interimOutput);
            if (finalOutput.trim() && isListening) {
                // Instantly pipe final bounds capturing phrase breakpoints
                onFinalTranscript(finalOutput.trim());
            }
        };

        recognition.onend = () => {
            setIsListening(false);
            setInterimText("");
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error:", event.error);
            setIsListening(false);
        };

        recognitionRef.current = recognition;

        return () => {
            // Safe teardown clearing bindings explicitly preventing zombie event trails
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                recognitionRef.current = null;
            }
        };
    }, [onFinalTranscript, isListening]); // bind isListening to prevent echoing during automated resets

    const startListening = useCallback(() => {
        if (recognitionRef.current && !isListening) {
            try {
                recognitionRef.current.start();
            } catch (e) {
                console.warn("Recognition already active", e);
            }
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
        }
    }, [isListening]);

    return {
        isSupported,
        isListening,
        interimText,
        startListening,
        stopListening
    };
};
