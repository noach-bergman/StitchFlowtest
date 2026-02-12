
import React, { useState, useRef, useEffect } from 'react';
import { getDesignAdvice, generateSpeech, decodeBase64, decodeAudioData } from '../services/gemini';
import { Send, Sparkles, Volume2, VolumeX, MessageCircle, Scissors, Heart, Palette } from 'lucide-react';
import { Client } from '../types';

interface AiAssistantProps {
  clients: Client[];
}

const AiAssistant: React.FC<AiAssistantProps> = ({ clients }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
    { role: 'assistant', content: 'ברוכה הבאה לעולם של השראה! אני המעצבת הדיגיטלית שלך. צריכה עזרה בשילובי בדים? עצות גזרה? או אולי חישוב כמויות? אני כאן לכל שאלה.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Cleanup audio context on unmount to prevent "play() request interrupted" errors
  useEffect(() => {
    return () => {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handleSend = async (textOverride?: string) => {
    const userMsg = textOverride || input;
    if (!userMsg.trim() || isLoading) return;
    
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);
    
    const advice = await getDesignAdvice(userMsg);
    setMessages(prev => [...prev, { role: 'assistant', content: advice || 'סליחה, חלה תקלה.' }]);
    setIsLoading(false);
  };

  const speakText = async (text: string) => {
    if (isSpeaking) {
      // If already speaking, stop the current audio
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        setIsSpeaking(false);
      }
      return;
    }

    setIsSpeaking(true);
    try {
      const audioBase64 = await generateSpeech(text, 'Zephyr');
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      } else if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const decodedData = decodeBase64(audioBase64);
      const audioBuffer = await decodeAudioData(decodedData, audioContextRef.current);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        setIsSpeaking(false);
        audioSourceRef.current = null;
      };

      audioSourceRef.current = source;
      source.start();
    } catch (err) {
      console.error("Speech synthesis failed:", err);
      setIsSpeaking(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-180px)] bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden relative">
      {/* Dynamic Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-5">
         <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500 rounded-full blur-[120px]"></div>
         <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500 rounded-full blur-[120px]"></div>
      </div>

      {/* Header with gradient background */}
      <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg animate-pulse">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="font-black text-gray-800 text-lg font-heebo tracking-tight">Atelier AI Assistant</h3>
            <div className="flex items-center justify-end gap-1">
               <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
               <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Online & Inspired</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] p-5 rounded-[2rem] text-sm md:text-base leading-relaxed shadow-sm relative group transition-all hover:shadow-md ${
              msg.role === 'user' 
                ? 'bg-slate-900 text-white rounded-tr-none' 
                : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
            }`}>
              {msg.role === 'assistant' && <div className="absolute -top-3 right-4 bg-gradient-to-r from-rose-500 to-indigo-600 text-[8px] font-black text-white px-3 py-1 rounded-full uppercase tracking-tighter shadow-md">AI Insights</div>}
              {msg.content}
              {msg.role === 'assistant' && (
                <button 
                  onClick={() => speakText(msg.content)}
                  className="absolute -left-12 top-2 p-3 text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                  title={isSpeaking ? "הפסק הקראה" : "הקרא הודעה"}
                >
                  {isSpeaking ? <VolumeX size={20} className="animate-pulse text-rose-500" /> : <Volume2 size={20} />}
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-end">
            <div className="bg-white border border-gray-100 p-5 rounded-3xl rounded-tl-none shadow-sm flex gap-2">
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-rose-400 rounded-full animate-bounce delay-75"></div>
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Prompts with Colors */}
      <div className="px-6 py-4 bg-white/50 backdrop-blur-sm flex gap-3 overflow-x-auto no-scrollbar border-t border-gray-50 z-10">
         {[
           { text: "כמה בד צריך?", icon: <Scissors size={14} />, color: "bg-blue-50 text-blue-600 border-blue-100" },
           { text: "שילובי צבעים", icon: <Palette size={14} />, color: "bg-emerald-50 text-emerald-600 border-emerald-100" },
           { text: "טרנדים 2025", icon: <Heart size={14} />, color: "bg-rose-50 text-rose-600 border-rose-100" }
         ].map((p, i) => (
           <button 
             key={i} 
             onClick={() => handleSend(p.text)} 
             className={`whitespace-nowrap flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black border transition-all hover:scale-105 active:scale-95 shadow-sm ${p.color}`}
           >
             {p.icon} {p.text}
           </button>
         ))}
      </div>

      {/* Improved Input */}
      <div className="p-6 bg-white sticky bottom-0 flex gap-4 z-20 border-t border-gray-50">
        <input
          type="text"
          placeholder="שאלי הכל על בדים, גזרות או השראה..."
          className="flex-1 bg-slate-50 border border-gray-100 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-rose-500/10 text-base text-right transition-all font-bold placeholder:text-gray-300"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button 
          onClick={() => handleSend()} 
          disabled={isLoading || !input.trim()} 
          className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-2xl shadow-xl hover:shadow-rose-500/20 active:scale-95 transition-all disabled:opacity-50"
        >
          <Send className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default AiAssistant;
