import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  Send,
  Languages,
  Radio,
  FileQuestion,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectApplication?: (appId: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  language?: string;
  timestamp: string;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  onSelectApplication
}) => {
  const { user } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState<'English' | 'Hindi' | 'Marathi'>('English');
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Ready to talk');
  const [textInput, setTextInput] = useState('');
  const [loadingText, setLoadingText] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Namaste! I am your aakalan Voice Assistant powered by Gemini 3.8 Live. Ask me in English, Hindi (हिंदी), or Marathi (मराठी) about navigating dashboards, application stages, document expiries, deficiency return reasons, and task deadlines.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Audio & WebSocket references
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isSpeaking]);

  // Helper to convert Float32 to 16kHz PCM base64
  const floatTo16BitPCMBase64 = (input: Float32Array): string => {
    const pcm16 = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const uint8 = new Uint8Array(pcm16.buffer);
    let binary = '';
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    return window.btoa(binary);
  };

  // Helper to schedule gapless 24kHz PCM audio playback
  const playPcmChunk = (base64Audio: string) => {
    try {
      if (!audioContextOutRef.current) {
        audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000
        });
      }

      const ctx = audioContextOutRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const binary = window.atob(base64Audio);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const currentTime = ctx.currentTime;
      if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime;
      }

      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += audioBuffer.duration;

      activeSourcesRef.current.push(source);
      setIsSpeaking(true);

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
        if (activeSourcesRef.current.length === 0) {
          setIsSpeaking(false);
        }
      };
    } catch {
      // Audio playback edge-case silently handled
    }
  };

  const stopAllAudio = () => {
    activeSourcesRef.current.forEach(src => {
      try {
        src.stop();
      } catch {
        // ignore
      }
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    setIsSpeaking(false);
  };

  // Initialize and connect Live WebSocket
  const startLiveSession = async () => {
    try {
      setConnectionStatus('Connecting to Gemini 3.8 Live API...');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        setIsLiveConnected(true);
        setConnectionStatus('Live API session active. Starting microphone...');
        // Request microphone access
        await startMicRecording();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'connected') {
            setConnectionStatus('Gemini Live listening (English / हिंदी / मराठी)');
          } else if (data.type === 'audio' && data.audio) {
            playPcmChunk(data.audio);
          } else if (data.type === 'text' && data.text) {
            // Update last assistant message or append
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.sender === 'assistant' && last.id === 'streaming') {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: last.text + data.text }
                ];
              } else {
                return [
                  ...prev,
                  {
                    id: 'streaming',
                    sender: 'assistant',
                    text: data.text,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  }
                ];
              }
            });
          } else if (data.type === 'interrupted') {
            stopAllAudio();
            setConnectionStatus('Interrupted by user speech');
          } else if (data.type === 'turnComplete') {
            setMessages(prev =>
              prev.map(m => m.id === 'streaming' ? { ...m, id: `msg-${Date.now()}` } : m)
            );
            setConnectionStatus('Gemini Live listening...');
          } else if (data.type === 'error') {
            setConnectionStatus(`Live Notice: ${data.message || 'Ready'}`);
          }
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        setConnectionStatus('WebSocket unable to connect directly. Switching to text/voice fallback.');
        setIsLiveConnected(false);
      };

      ws.onclose = () => {
        setIsLiveConnected(false);
        setIsMicActive(false);
      };
    } catch {
      setConnectionStatus('Live connection unavailable. You can type or use fallback voice queries.');
    }
  };

  // Start capturing audio from microphone at 16kHz
  const startMicRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });
      audioContextInRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      // ScriptProcessor captures PCM chunks
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const channelData = e.inputBuffer.getChannelData(0);
        const base64Pcm = floatTo16BitPCMBase64(channelData);
        wsRef.current.send(JSON.stringify({ audio: base64Pcm }));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      setIsMicActive(true);
      setConnectionStatus('Microphone active. Speak in English, Hindi, or Marathi...');
    } catch (err: any) {
      console.warn('Microphone permission denied or unavailable:', err);
      setIsMicActive(false);
      setConnectionStatus('Microphone unavailable. You can ask your question using text below.');
    }
  };

  const stopLiveSession = () => {
    stopAllAudio();
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current = null;
    }
    if (audioContextInRef.current) {
      try {
        audioContextInRef.current.close();
      } catch {
        // ignore
      }
      audioContextInRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    setIsLiveConnected(false);
    setIsMicActive(false);
    setConnectionStatus('Session paused. Click Start to resume.');
  };

  // Send textual query (either over active Live WS or via fallback REST endpoint)
  const handleSendTextQuery = async (queryText?: string) => {
    const question = (queryText || textInput).trim();
    if (!question) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    setTextInput('');

    // If Live session is open, send realtime text input
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        text: `[Language: ${selectedLanguage}] ${question}`
      }));
      setConnectionStatus(`Processing question in ${selectedLanguage}...`);
      return;
    }

    // Otherwise use backend fallback endpoint
    setLoadingText(true);
    setConnectionStatus(`Querying AICTE knowledge in ${selectedLanguage}...`);
    try {
      const res = await fetch('/api/voice/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          language: selectedLanguage,
          context: { role: user?.role }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: data.replyText,
          language: data.language,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, assistantMsg]);
        setConnectionStatus('Ready to talk');

        // Optional Web Speech synthesis read-aloud for fallback responses
        if ('speechSynthesis' in window && !isLiveConnected) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(data.replyText);
          if (selectedLanguage === 'Hindi') utterance.lang = 'hi-IN';
          else if (selectedLanguage === 'Marathi') utterance.lang = 'mr-IN';
          else utterance.lang = 'en-IN';
          utterance.rate = 1.05;
          window.speechSynthesis.speak(utterance);
        }
      } else {
        const errData = await res.json();
        setMessages(prev => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: 'assistant',
            text: errData.replyText || 'Please verify that GEMINI_API_KEY is configured in Settings > Secrets.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setConnectionStatus('Ready to talk');
      }
    } catch {
      setConnectionStatus('Network query error');
    } finally {
      setLoadingText(false);
    }
  };

  // Teardown on modal close
  useEffect(() => {
    if (!isOpen) {
      stopLiveSession();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const quickPrompts = [
    {
      title: 'How to submit an application?',
      hindi: 'आवेदन कैसे जमा करें?',
      marathi: 'अर्ज कसा सादर करावा?'
    },
    {
      title: 'Which workflow stage is an application in?',
      hindi: 'आवेदन किस चरण में है?',
      marathi: 'अर्ज कोणत्या टप्प्यावर आहे?'
    },
    {
      title: 'Which documents are missing or expiring soon?',
      hindi: 'कौन से दस्तावेज समाप्त या गायब हैं?',
      marathi: 'कोणती कागदपत्रे कालबाह्य होत आहेत?'
    },
    {
      title: 'Why was my application returned for correction?',
      hindi: 'मेरा आवेदन वापस क्यों भेजा गया?',
      marathi: 'माझा अर्ज दुरुस्तीसाठी परत का पाठवला?'
    },
    {
      title: 'Which tasks are overdue or approaching deadline?',
      hindi: 'कौन से कार्य लंबित या समयसीमा के करीब हैं?',
      marathi: 'कोणती कामे प्रलंबित किंवा मुदत संपत आहेत?'
    },
    {
      title: 'How do officers draft deficiency notices?',
      hindi: 'अधिकारी कमी/त्रुटि सूचना कैसे बनाते हैं?',
      marathi: 'अधिकारी त्रुटी नोटीस कशी तयार करतात?'
    },
    {
      title: 'Explain Institution, Scrutiny, Regional, and Admin dashboards',
      hindi: 'संस्थान, जांच, क्षेत्रीय और व्यवस्थापक डैशबोर्ड समझाएं',
      marathi: 'संस्था, तपासणी, प्रादेशिक आणि ॲडमिन डॅशबोर्ड समजावून सांगा'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">aakalan Voice Assistant</h3>
                <span className="font-mono text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-400/30">
                  gemini-3.8-live
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Spoken assistance for applications, stages, expiries & deficiency notices
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700 text-xs font-medium">
              <button
                onClick={() => setSelectedLanguage('English')}
                className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer ${
                  selectedLanguage === 'English' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setSelectedLanguage('Hindi')}
                className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer ${
                  selectedLanguage === 'Hindi' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:text-white'
                }`}
              >
                हिंदी
              </button>
              <button
                onClick={() => setSelectedLanguage('Marathi')}
                className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer ${
                  selectedLanguage === 'Marathi' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:text-white'
                }`}
              >
                मराठी
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Status Bar & Animated Waveform */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isLiveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span className="font-medium text-slate-700">{connectionStatus}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Visualizer bars */}
            <div className="flex items-center gap-0.5 h-4">
              <div className={`w-1 rounded-full bg-blue-600 transition-all ${isSpeaking || isMicActive ? 'h-4 animate-bounce' : 'h-1.5'}`} />
              <div className={`w-1 rounded-full bg-indigo-600 transition-all ${isSpeaking || isMicActive ? 'h-3 animate-pulse' : 'h-1'}`} />
              <div className={`w-1 rounded-full bg-blue-500 transition-all ${isSpeaking || isMicActive ? 'h-5 animate-bounce' : 'h-2'}`} />
              <div className={`w-1 rounded-full bg-purple-600 transition-all ${isSpeaking || isMicActive ? 'h-3 animate-pulse' : 'h-1'}`} />
            </div>

            {isSpeaking && (
              <button
                onClick={stopAllAudio}
                className="px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                title="Mute spoken response"
              >
                <VolumeX className="w-3 h-3" />
                <span>Mute</span>
              </button>
            )}
          </div>
        </div>

        {/* Conversation Transcript Area */}
        <div ref={chatScrollRef} className="p-4 flex-1 overflow-y-auto space-y-3 bg-slate-50/40">
          {messages.map(m => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-2xs leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-br-xs'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                }`}
              >
                <p>{m.text}</p>
                <span className={`text-[10px] block mt-1 ${m.sender === 'user' ? 'text-blue-200 text-right' : 'text-slate-400'}`}>
                  {m.timestamp}
                </span>
              </div>
            </div>
          ))}

          {loadingText && (
            <div className="flex items-center gap-2 text-xs text-slate-500 italic">
              <div className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
              <span>Analyzing live database and drafting response...</span>
            </div>
          )}
        </div>

        {/* Quick Question Recommendations */}
        <div className="p-3 bg-white border-t border-slate-200 shrink-0">
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>Suggested Questions ({selectedLanguage}):</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {quickPrompts.map((q, idx) => {
              const label = selectedLanguage === 'Hindi' ? q.hindi : selectedLanguage === 'Marathi' ? q.marathi : q.title;
              return (
                <button
                  key={idx}
                  onClick={() => handleSendTextQuery(label)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border border-slate-200 text-left shrink-0"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Controls: Live Mic & Text Box */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 space-y-3">
          <div className="flex items-center gap-3">
            {!isLiveConnected ? (
              <button
                onClick={startLiveSession}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer whitespace-nowrap"
              >
                <Mic className="w-4 h-4 animate-pulse" />
                <span>Start Live Voice Conversation</span>
              </button>
            ) : (
              <button
                onClick={stopLiveSession}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer whitespace-nowrap"
              >
                <MicOff className="w-4 h-4" />
                <span>End Voice Session</span>
              </button>
            )}

            <div className="flex-1 relative flex items-center">
              <input
                type="text"
                placeholder={
                  selectedLanguage === 'Hindi'
                    ? 'प्रश्न पूछें (उदा. आवेदन कैसे जमा करें?)...'
                    : selectedLanguage === 'Marathi'
                    ? 'प्रश्न विचारा (उदा. अर्ज कसा सादर करावा?)...'
                    : 'Ask a question or request application status...'
                }
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSendTextQuery();
                }}
                className="w-full pl-3 pr-10 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <button
                onClick={() => handleSendTextQuery()}
                disabled={!textInput.trim() || loadingText}
                className="absolute right-2 p-1.5 text-blue-600 hover:text-blue-800 disabled:text-slate-300 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
