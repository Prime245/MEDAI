
import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, MicOff, Image as ImageIcon, Send, 
  AlertTriangle, Shield, Camera, Trash2,
  Menu, X, History as HistoryIcon,
  Stethoscope, User, Bot, AlertCircle,
  Phone, MessageSquare, ArrowRight, Check,
  RefreshCw, Video, VideoOff, Mic as MicIcon,
  UserCircle, LogOut, CreditCard, Landmark, Clock,
  FileText, Upload, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { translations, Language } from './translations';
import toast, { Toaster } from 'react-hot-toast';
import { analyzeRisk, getAIResponse } from './utils/medicalLogic';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  risk?: 'low' | 'medium' | 'high';
  timestamp: Date;
  isForwarded?: boolean;
}

interface Doctor {
  id: number;
  name: string;
  specialty: string;
  contact: string;
  image: string;
  status: 'available' | 'busy';
}

const DOCTORS: Doctor[] = [
  { id: 1, name: "Dr. Sarah Ahmed", specialty: "General Physician", contact: "+1234567890", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah", status: 'available' },
  { id: 2, name: "Dr. James Wilson", specialty: "Cardiologist", contact: "+1234567891", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=James", status: 'available' },
  { id: 3, name: "Dr. Maria Garcia", specialty: "Dermatologist", contact: "+1234567892", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria", status: 'busy' },
];

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: translations['en'].welcome,
      timestamp: new Date(),
    }
  ]);

  useEffect(() => {
    // If there's only one message and it's the welcome message, update its language
    if (messages.length === 1 && messages[0].role === 'assistant') {
      setMessages([{
        ...messages[0],
        content: translations[lang].welcome
      }]);
    }
  }, [lang]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high' | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 769);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [forwardingId, setForwardingId] = useState<string | null>(null);
  const [activeMessageModal, setActiveMessageModal] = useState<Doctor | null>(null);
  const [directMsg, setDirectMsg] = useState("");
  const [activeVideoCall, setActiveVideoCall] = useState<Doctor | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [paymentDoctor, setPaymentDoctor] = useState<Doctor | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'online'>('card');
  const [scheduledAppointment, setScheduledAppointment] = useState<Doctor | null>(null);
  const [medicalRecords, setMedicalRecords] = useState<{name: string, date: string, type: string}[]>([]);
  const [mobileFeatureModal, setMobileFeatureModal] = useState<'symptoms' | 'language' | 'doctors' | 'history' | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const medicalFileInputRef = useRef<HTMLInputElement>(null);

  const getUserName = (emailStr: string) => {
    if (!emailStr) return "User";
    return emailStr.split('@')[0];
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const t = translations[lang];
  const isRTL = lang === 'ur' || lang === 'ar';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Voice Recognition Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = lang === 'en' ? 'en-US' : lang === 'hi' ? 'hi-IN' : lang === 'ar' ? 'ar-SA' : 'ur-PK';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => prev + ' ' + transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, [lang]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() && !previewImage && selectedSymptoms.length === 0) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText || (selectedSymptoms.length > 0 ? `Selected symptoms: ${selectedSymptoms.join(', ')}` : "Image upload"),
      image: previewImage || undefined,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setPreviewImage(null);
    setIsLoading(true);

    const risk = analyzeRisk(selectedSymptoms, userMessage.content);
    setRiskLevel(risk);

    const response = await getAIResponse(userMessage.content, selectedSymptoms, userMessage.image);
    
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      risk: risk as any,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsLoading(false);
  };

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptom) 
        ? prev.filter(s => s !== symptom) 
        : [...prev, symptom]
    );
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const forwardCase = (msgId: string, docName: string) => {
    setForwardingId(msgId);
    setTimeout(() => {
      setMessages(prev => prev.map(m => 
        m.id === msgId ? { ...m, isForwarded: true, content: `${m.content}\n\n[System: ${t.caseForwarded} ${docName}]` } : m
      ));
      setForwardingId(null);
      toast.success(`${t.caseForwarded} ${docName}`, {
        duration: 4000,
        position: 'top-center',
        style: {
          background: '#10b981',
          color: '#fff',
          fontWeight: 'bold'
        }
      });
    }, 1000);
  };

  const handleDirectMessage = () => {
    if (!directMsg.trim() || !activeMessageModal) return;
    toast.success(`Message sent to ${activeMessageModal.name}`, {
      position: 'top-center'
    });
    setDirectMsg("");
    setActiveMessageModal(null);
  };

  const startVideoCall = async (doc: Doctor) => {
    setActiveVideoCall(doc);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      toast.error("Could not access camera for video call");
      setActiveVideoCall(null);
    }
  };

  const endVideoCall = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setActiveVideoCall(null);
    streamRef.current = null;
    toast("Video call ended", { icon: '📞' });
  };

  const handleMedicalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newRecord = {
        name: file.name,
        date: new Date().toLocaleDateString(),
        type: file.type.includes('pdf') ? 'PDF' : 'Image'
      };
      setMedicalRecords(prev => [newRecord, ...prev]);
      toast.success(t.fileUploaded);
    }
  };

  const handleLogin = () => {
    setIsLoggedIn(true);
    toast.success(`Welcome back, ${getUserName(email)}`);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md"
        >
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="p-3 bg-blue-600 rounded-2xl text-white">
              <Stethoscope size={32} />
            </div>
            <h1 className="text-3xl font-bold text-blue-600 tracking-tight">MedAI</h1>
          </div>
          
          <div className="space-y-4">
            <AnimatePresence mode='wait'>
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase ml-1">{t.email}</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full mt-1 bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase ml-1">{t.password}</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full mt-1 bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <button 
                  onClick={handleLogin}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg mt-4"
                >
                  {t.login}
                </button>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    );
  }

  // Mobile UI Render
  if (isMobile) {
    return (
      <div className="mobile-ui-container" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Mobile Header */}
        <div className="mobile-header-bar">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 rounded-lg text-white">
              <Stethoscope size={16} />
            </div>
            <span className="text-sm font-bold text-blue-600">MedAI</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">AI Online</span>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <User size={14} className="text-blue-600" />
            </div>
          </div>
        </div>

        {/* Feature Buttons Bar */}
        <div className="mobile-feature-bar">
          <button onClick={() => setMobileFeatureModal('symptoms')} className="mobile-feature-btn">
            🩺 Symptoms
          </button>
          <button onClick={() => setMobileFeatureModal('language')} className="mobile-feature-btn">
            🌐 Language
          </button>
          <button onClick={() => setMobileFeatureModal('doctors')} className="mobile-feature-btn">
            👨‍⚕️ Doctors
          </button>
          <button onClick={() => setMobileFeatureModal('history')} className="mobile-feature-btn">
            📋 History
          </button>
        </div>

        {/* Risk Badge */}
        {riskLevel && (
          <div className={cn(
            "mobile-risk-badge",
            riskLevel === 'high' && "mobile-risk-high",
            riskLevel === 'medium' && "mobile-risk-medium",
            riskLevel === 'low' && "mobile-risk-low"
          )}>
            <AlertTriangle size={10} className="inline mr-1" />
            {riskLevel} Risk
          </div>
        )}

        {/* Selected Symptoms Chips */}
        {selectedSymptoms.length > 0 && (
          <div className="mobile-symptoms-chips" style={{ marginTop: '100px', marginLeft: '1rem', marginRight: '1rem' }}>
            {selectedSymptoms.map(symptom => (
              <span key={symptom} className="mobile-symptom-chip">
                {symptom} ×
              </span>
            ))}
          </div>
        )}

        {/* Chat Area */}
        <div className="mobile-chat-area" style={{ marginTop: '100px' }}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex max-w-[85%] flex-col mb-4",
                msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div className={cn(
                "p-3 rounded-2xl text-xs",
                msg.role === 'user' 
                  ? "bg-blue-600 text-white rounded-br-none" 
                  : "bg-white border border-slate-100 text-slate-700 rounded-bl-none shadow-sm"
              )}>
                {msg.content}
                {msg.risk && (
                  <div className={cn(
                    "mt-2 pt-2 border-t text-[10px] font-bold",
                    msg.risk === 'high' ? "text-red-400" : 
                    msg.risk === 'medium' ? "text-amber-600" : 
                    "text-emerald-600"
                  )}>
                    Risk: {msg.risk.toUpperCase()}
                  </div>
                )}
                {msg.role === 'assistant' && !msg.isForwarded && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-[9px] text-slate-400 mb-1 uppercase font-bold">Forward to:</p>
                    <div className="flex flex-wrap gap-1">
                      {DOCTORS.map(doc => (
                        <button
                          key={doc.id}
                          onClick={() => forwardCase(msg.id, doc.name)}
                          disabled={forwardingId === msg.id}
                          className="flex items-center gap-1 px-2 py-1 bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded text-[9px] font-medium transition-all"
                        >
                          {forwardingId === msg.id ? (
                            <RefreshCw size={8} className="animate-spin" />
                          ) : (
                            <ArrowRight size={8} />
                          )}
                          {doc.name.split(' ').slice(1).join(' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {msg.isForwarded && (
                  <div className="mt-2 flex items-center gap-1 text-emerald-500 font-bold text-[9px]">
                    <Check size={10} />
                    Case Forwarded
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                <Bot size={12} className="text-white" />
              </div>
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="mobile-input-bar">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-500"
          >
            <ImageIcon size={20} />
          </button>
          <input 
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={t.placeholder}
            className="flex-1 bg-slate-100 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          />
          <button 
            onClick={toggleListening}
            className={cn(
              "p-2 rounded-full",
              isListening ? "bg-red-100 text-red-600" : "text-slate-500"
            )}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button
            onClick={handleSendMessage}
            disabled={isLoading}
            className="p-2 bg-blue-600 text-white rounded-full disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </div>

        {/* Feature Modal */}
        <AnimatePresence>
          {mobileFeatureModal && (
            <div className="mobile-feature-modal" onClick={() => setMobileFeatureModal(null)}>
              <motion.div 
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                exit={{ y: 100 }}
                className="mobile-feature-modal-content"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-800">
                    {mobileFeatureModal === 'symptoms' && 'Select Symptoms'}
                    {mobileFeatureModal === 'language' && 'Select Language'}
                    {mobileFeatureModal === 'doctors' && 'Available Doctors'}
                    {mobileFeatureModal === 'history' && 'Session History'}
                  </h3>
                  <button onClick={() => setMobileFeatureModal(null)} className="p-2">
                    <X size={20} />
                  </button>
                </div>

                {/* Symptoms Modal */}
                {mobileFeatureModal === 'symptoms' && (
                  <div className="flex flex-wrap gap-2">
                    {t.symptomOptions.map(symptom => (
                      <button
                        key={symptom}
                        onClick={() => toggleSymptom(symptom)}
                        className={cn(
                          "px-3 py-2 rounded-full text-xs font-medium",
                          selectedSymptoms.includes(symptom)
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {symptom}
                      </button>
                    ))}
                  </div>
                )}

                {/* Language Modal */}
                {mobileFeatureModal === 'language' && (
                  <div className="grid grid-cols-2 gap-2">
                    {(['en', 'ur', 'ar', 'hi'] as Language[]).map((l) => (
                      <button
                        key={l}
                        onClick={() => setLang(l)}
                        className={cn(
                          "p-3 rounded-lg text-sm font-medium",
                          lang === l 
                            ? "bg-blue-600 text-white" 
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}

                {/* Doctors Modal */}
                {mobileFeatureModal === 'doctors' && (
                  <div className="space-y-3">
                    {DOCTORS.map(doc => (
                      <div key={doc.id} className="p-3 bg-slate-50 rounded-xl flex items-center gap-3">
                        <img src={doc.image} alt={doc.name} className="w-12 h-12 rounded-full" />
                        <div className="flex-1">
                          <h4 className="text-sm font-bold">{doc.name}</h4>
                          <p className="text-xs text-blue-600">{doc.specialty}</p>
                          <span className={cn(
                            "text-[10px] font-bold",
                            doc.status === 'available' ? "text-emerald-600" : "text-red-500"
                          )}>
                            {doc.status === 'available' ? 'Available' : 'Busy'}
                          </span>
                        </div>
                        <button 
                          onClick={() => setActiveMessageModal(doc)}
                          className="p-2 bg-blue-100 text-blue-600 rounded-lg"
                        >
                          <MessageSquare size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            if (doc.status === 'available') {
                              setPaymentDoctor(doc);
                              setMobileFeatureModal(null);
                            }
                          }}
                          disabled={doc.status === 'busy'}
                          className={cn(
                            "p-2 rounded-lg",
                            doc.status === 'available' ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                          )}
                        >
                          <Video size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* History Modal */}
                {mobileFeatureModal === 'history' && (
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-sm text-slate-600">{messages.length} messages in this session</p>
                    <button 
                      onClick={() => {
                        setMessages([{
                          id: Date.now().toString(),
                          role: 'assistant',
                          content: translations[lang].welcome,
                          timestamp: new Date(),
                        }]);
                        setRiskLevel(null);
                        setSelectedSymptoms([]);
                      }}
                      className="mt-3 w-full py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium"
                    >
                      Clear Chat
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Message Modal */}
        <AnimatePresence>
          {activeMessageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setActiveMessageModal(null)}>
              <motion.div 
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-white rounded-2xl w-full max-w-sm p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-4">
                  <img src={activeMessageModal.image} alt="" className="w-12 h-12 rounded-full" />
                  <div>
                    <h3 className="font-bold">{activeMessageModal.name}</h3>
                    <p className="text-xs text-blue-600">{activeMessageModal.specialty}</p>
                  </div>
                </div>
                <textarea
                  value={directMsg}
                  onChange={(e) => setDirectMsg(e.target.value)}
                  placeholder="Type message..."
                  className="w-full h-20 p-3 bg-slate-50 rounded-xl text-sm resize-none"
                />
                <button
                  onClick={handleDirectMessage}
                  className="w-full mt-3 py-2 bg-blue-600 text-white rounded-xl font-medium"
                >
                  Send
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div 
      dir={isRTL ? 'rtl' : 'ltr'}
      className={cn(
        "flex h-screen bg-slate-50 text-slate-900 font-sans",
        isRTL ? "flex-row-reverse text-right" : "flex-row text-left"
      )}
    >
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 320 : 0 }}
        className={cn(
          "sidebar bg-white border-slate-200 overflow-hidden flex flex-col shadow-xl z-20",
          isRTL ? "border-l" : "border-r",
          isMobile && "mobile-sidebar"
        )}
      >
        <div className={cn(
          "p-6 flex flex-col h-full",
          isMobile ? "mobile-sidebar-content" : "min-w-[320px]"
        )}>
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-blue-600 rounded-xl text-white">
              <Stethoscope size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-blue-600">{t.title}</h1>
          </div>

          <div className="mb-8">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 block">
              {t.selectLanguage}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['en', 'ur', 'ar', 'hi'] as Language[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-all border",
                    lang === l 
                      ? "bg-blue-50 border-blue-200 text-blue-600" 
                      : "bg-white border-slate-100 text-slate-600 hover:border-slate-300"
                  )}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 block">
              {t.symptoms}
            </label>
            <div className="flex flex-wrap gap-2 mb-8">
              {t.symptomOptions.map((symptom) => (
                <button
                  key={symptom}
                  onClick={() => toggleSymptom(symptom)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                    selectedSymptoms.includes(symptom)
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  {symptom}
                </button>
              ))}
            </div>

            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 block">
              {t.history}
            </label>
            <div className="space-y-2">
              <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex items-center gap-3">
                <HistoryIcon size={16} className="text-slate-400" />
                <span className="text-xs text-slate-500">{messages.length} Messages in this session</span>
              </div>
            </div>

            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 mt-8 block">
              {t.patientHistory}
            </label>
            <div className="space-y-2">
              <input 
                type="file" 
                className="hidden" 
                ref={medicalFileInputRef} 
                onChange={handleMedicalFileUpload} 
              />
              <button 
                onClick={() => medicalFileInputRef.current?.click()}
                className="w-full flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-600 hover:bg-blue-100 transition-colors"
              >
                <Upload size={16} />
                <span className="text-xs font-bold">{t.uploadMedical}</span>
              </button>
              
              <div className="max-h-40 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                {medicalRecords.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic text-center py-2">{t.noHistory}</p>
                ) : (
                  medicalRecords.map((record, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 bg-white border border-slate-100 rounded-lg">
                      <FileText size={14} className="text-slate-400" />
                      <div className="flex-1 overflow-hidden">
                        <p className="text-[10px] font-bold text-slate-700 truncate">{record.name}</p>
                        <p className="text-[9px] text-slate-400">{record.date} • {record.type}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 mt-8 block">
              {t.doctors}
            </label>
            <div className="space-y-3">
              {DOCTORS.map(doc => (
                <div key={doc.id} className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
                  <div className={cn(
                    "absolute top-0 right-0 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                    doc.status === 'available' ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                  )}>
                    {doc.status === 'available' ? t.available : t.busy}
                  </div>
                  <div className="flex items-center gap-3 mb-3 mt-2">
                    <img src={doc.image} alt={doc.name} className="w-10 h-10 rounded-full bg-slate-100" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 leading-tight">{doc.name}</h4>
                      <p className="text-[11px] text-blue-600 font-medium">{doc.specialty}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors">
                      <Phone size={12} />
                      {t.consult}
                    </button>
                    <button 
                      onClick={() => setActiveMessageModal(doc)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors"
                    >
                      <MessageSquare size={12} />
                      {t.message}
                    </button>
                  </div>
                  <button 
                    onClick={() => setPaymentDoctor(doc)}
                    disabled={doc.status === 'busy'}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:bg-slate-200"
                  >
                    <Video size={14} />
                    {t.videoCall}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100">
             <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
               <div className="flex items-center gap-2 mb-2">
                 <Shield size={16} className="text-blue-600" />
                 <span className="text-sm font-semibold">{t.riskLevel}</span>
               </div>
               {!riskLevel ? (
                 <p className="text-xs text-slate-400 italic">No symptoms analyzed yet</p>
               ) : (
                 <div className={cn(
                   "flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-bold",
                   riskLevel === 'high' ? "bg-red-100 text-red-600" :
                   riskLevel === 'medium' ? "bg-amber-100 text-amber-600" :
                   "bg-emerald-100 text-emerald-600"
                 )}>
                   <AlertTriangle size={14} />
                   {riskLevel === 'high' ? t.riskHigh : riskLevel === 'medium' ? t.riskMedium : t.riskLow}
                 </div>
               )}
             </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className={cn(
        "chat-panel flex-1 flex flex-col relative overflow-hidden",
        isMobile && "mobile-chat"
      )}>
        {/* Header */}
        <header className="mobile-header bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 flex items-center justify-between sticky top-0 z-10">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="mobile-toggle-btn p-2 hover:bg-slate-100 rounded-lg text-slate-600"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <span className="animate-pulse h-2 w-2 rounded-full bg-emerald-500"></span>
            AI Assistant Online
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setMessages([{
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: translations[lang].welcome,
                  timestamp: new Date(),
                }]);
                setRiskLevel(null);
                setSelectedSymptoms([]);
              }}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              title="Clear Chat"
            >
              <Trash2 size={18} />
            </button>
            <button 
              onClick={() => setIsLoggedIn(false)}
              className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
              title={t.logout}
            >
              <LogOut size={18} />
            </button>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tight leading-none mb-1">{getUserName(email)}</span>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border-2 border-white shadow-sm">
                <User size={20} />
              </div>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
        >
          {messages.map((msg) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id}
              className={cn(
                "flex max-w-[80%] flex-col",
                msg.role === 'user' 
                  ? (isRTL ? "mr-auto items-end" : "ml-auto items-end") 
                  : (isRTL ? "ml-auto items-start" : "mr-auto items-start")
              )}
            >
              <div className={cn(
                "flex items-center gap-2 mb-1",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}>
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center",
                  msg.role === 'user' ? "bg-slate-200" : "bg-blue-600"
                )}>
                  {msg.role === 'user' ? <User size={12} className="text-slate-600" /> : <Bot size={12} className="text-white" />}
                </div>
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                  {msg.role === 'user' ? 'You' : 'MedAI'}
                </span>
              </div>
              
              <div className={cn(
                "p-4 rounded-2xl shadow-sm text-sm leading-relaxed",
                msg.role === 'user' 
                  ? "bg-blue-600 text-white rounded-tr-none" 
                  : "bg-white border border-slate-100 text-slate-700 rounded-tl-none"
              )}>
                {msg.image && (
                  <img src={msg.image} alt="Upload" className="mb-3 rounded-lg max-h-48 w-full object-cover border border-white/20" />
                )}
                {msg.content}
                
                {msg.risk && (
                  <div className={cn(
                    "mt-3 pt-3 border-t flex items-center gap-2 text-[11px] font-bold uppercase",
                    msg.risk === 'high' ? "text-red-500 border-red-100" : 
                    msg.risk === 'medium' ? "text-amber-500 border-amber-100" : 
                    "text-emerald-500 border-emerald-100"
                  )}>
                    <AlertCircle size={12} />
                    {t.riskLevel}: {msg.risk.toUpperCase()}
                  </div>
                )}

                {msg.role === 'assistant' && !msg.isForwarded && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-[10px] text-slate-400 mb-2 uppercase font-bold tracking-tight">{t.forwardCase}</p>
                    <div className="flex flex-wrap gap-2">
                      {DOCTORS.map(doc => (
                        <button
                          key={doc.id}
                          onClick={() => forwardCase(msg.id, doc.name)}
                          disabled={forwardingId === msg.id}
                          className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-md text-[10px] font-bold border border-slate-100 transition-all"
                        >
                          {forwardingId === msg.id ? (
                             <RefreshCw size={10} className="animate-spin" />
                          ) : (
                            <ArrowRight size={10} className={isRTL ? "rotate-180" : ""} />
                          )}
                          {doc.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {msg.isForwarded && (
                  <div className="mt-2 flex items-center gap-1 text-emerald-600 font-bold text-[10px]">
                    <Check size={12} />
                    CASE SHARED
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 px-1">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </motion.div>
          ))}
          {isLoading && (
            <div className={cn(
              "flex items-start gap-3",
              isRTL ? "flex-row-reverse" : "flex-row"
            )}>
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center animate-pulse">
                <Bot size={16} className="text-white" />
              </div>
              <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-none shadow-sm">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="px-6 py-2 bg-amber-50 border-y border-amber-100 flex items-center gap-3">
          <AlertCircle size={14} className="text-amber-500 shrink-0" />
          <p className="text-[10px] text-amber-700 leading-tight">{t.disclaimer}</p>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100">
          {previewImage && (
            <div className="mb-3 relative inline-block">
              <img src={previewImage} alt="Preview" className="h-20 w-20 object-cover rounded-lg border-2 border-blue-500" />
              <button 
                onClick={() => setPreviewImage(null)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImageUpload}
            />
            <div className="flex gap-1">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                title={t.uploadImg}
              >
                <ImageIcon size={20} />
              </button>
              <button 
                onClick={() => cameraInputRef.current?.click()}
                className="p-3 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                title={t.camera}
              >
                <Camera size={20} />
              </button>
              <button 
                onClick={() => selfieInputRef.current?.click()}
                className="p-3 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                title={t.selfie}
              >
                <UserCircle size={20} />
              </button>
              <button 
                onClick={toggleListening}
                className={cn(
                  "p-3 rounded-xl transition-colors",
                  isListening ? "bg-red-50 text-red-600 animate-pulse" : "text-slate-500 hover:bg-slate-100"
                )}
                title={t.voiceInput}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            </div>

            <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={t.placeholder}
              className={cn(
                "w-full bg-slate-100 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-blue-500 text-sm",
                isRTL ? "text-right" : "text-left"
              )}
            />
          </div>

          <input 
            type="file" 
            accept="image/*" 
            capture="environment"
            className="hidden" 
            ref={cameraInputRef}
            onChange={handleImageUpload}
          />
          <input 
            type="file" 
            accept="image/*" 
            capture="user"
            className="hidden" 
            ref={selfieInputRef}
            onChange={handleImageUpload}
          />

            <button
              disabled={isLoading}
              onClick={handleSendMessage}
              className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-50"
            >
              <Send size={20} className={isRTL ? "rotate-180" : ""} />
            </button>
          </div>
        </div>
      </main>

      {/* Message Modal */}
      <AnimatePresence>
        {activeMessageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-blue-600 text-white">
                <div className="flex items-center gap-3">
                  <img src={activeMessageModal.image} alt="" className="w-10 h-10 rounded-full border-2 border-white/20" />
                  <div>
                    <h3 className="font-bold">{activeMessageModal.name}</h3>
                    <p className="text-[10px] opacity-80 uppercase tracking-widest">{activeMessageModal.specialty}</p>
                  </div>
                </div>
                <button onClick={() => setActiveMessageModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6">
                <textarea
                  autoFocus
                  value={directMsg}
                  onChange={(e) => setDirectMsg(e.target.value)}
                  placeholder={`${t.message} to Dr. ${activeMessageModal.name.split(' ').pop()}...`}
                  className="w-full h-32 p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                />
                <button
                  onClick={handleDirectMessage}
                  className="w-full mt-4 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <Send size={18} />
                  {t.message}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Video Call Modal */}
      <AnimatePresence>
        {activeVideoCall && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-4xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Doctor's Camera (Simulated) */}
              <div className="absolute inset-0 flex items-center justify-center">
                 <img src={activeVideoCall.image} alt="" className="w-full h-full object-cover opacity-50 blur-xl scale-110" />
                 <div className="relative text-center">
                    <img src={activeVideoCall.image} alt="" className="w-32 h-32 rounded-full border-4 border-white/20 mx-auto mb-4" />
                    <h2 className="text-white text-2xl font-bold">{activeVideoCall.name}</h2>
                    <p className="text-emerald-400 font-medium">{t.joining}</p>
                 </div>
              </div>

              {/* User's Camera Feed */}
              <div className="absolute top-6 right-6 w-48 aspect-video bg-slate-800 rounded-2xl border-2 border-white/10 overflow-hidden shadow-xl z-10">
                {!isVideoOff ? (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover scale-x-[-1]" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <VideoOff size={32} className="opacity-40" />
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="mt-auto relative z-10 p-8 flex justify-center items-center gap-6 bg-gradient-to-t from-black/80 to-transparent">
                <button 
                  onClick={() => setIsMuted(!isMuted)}
                  className={cn(
                    "p-4 rounded-full transition-all",
                    isMuted ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
                  )}
                >
                  {isMuted ? <MicOff size={24} /> : <MicIcon size={24} />}
                </button>
                
                <button 
                  onClick={endVideoCall}
                  className="p-5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all shadow-lg"
                >
                  <Phone size={28} className="rotate-[135deg]" />
                </button>

                <button 
                  onClick={() => setIsVideoOff(!isVideoOff)}
                  className={cn(
                    "p-4 rounded-full transition-all",
                    isVideoOff ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
                  )}
                >
                  {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                </button>
              </div>

              <div className="absolute bottom-10 left-8 z-10 text-white/60 text-sm font-medium">
                Encrypted Peer-to-Peer Connection
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {paymentDoctor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-600 text-white">
                <h3 className="font-bold text-lg">{t.bookTitle}</h3>
                <button onClick={() => setPaymentDoctor(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <img src={paymentDoctor.image} alt="" className="w-16 h-16 rounded-2xl bg-white border border-slate-100" />
                  <div>
                    <h4 className="font-bold text-slate-800">{paymentDoctor.name}</h4>
                    <p className="text-xs text-blue-600 font-medium">{paymentDoctor.specialty}</p>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 font-bold uppercase">
                      <Clock size={10} />
                      {t.appointmentTime}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-2 block">{t.paymentMethod}</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setPaymentMethod('card')}
                      className={cn(
                        "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                        paymentMethod === 'card' ? "border-emerald-500 bg-emerald-50" : "border-slate-100 hover:border-slate-200"
                      )}
                    >
                      <CreditCard size={24} className={paymentMethod === 'card' ? "text-emerald-600" : "text-slate-400"} />
                      <span className="text-xs font-bold">{t.card}</span>
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('online')}
                      className={cn(
                        "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                        paymentMethod === 'online' ? "border-emerald-500 bg-emerald-50" : "border-slate-100 hover:border-slate-200"
                      )}
                    >
                      <Landmark size={24} className={paymentMethod === 'online' ? "text-emerald-600" : "text-slate-400"} />
                      <span className="text-xs font-bold">{t.online}</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex justify-between items-center">
                  <span className="text-sm font-bold text-emerald-800">{t.amount}</span>
                  <div className="flex items-center gap-1 text-emerald-600">
                    <Shield size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-tight">Secure</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const doc = paymentDoctor;
                    setPaymentDoctor(null);
                    setScheduledAppointment(doc);
                    toast.success(t.bookedSuccess, { icon: '📅' });
                  }}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                >
                  {t.payNow}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Scheduled Appointment Modal */}
      <AnimatePresence>
        {scheduledAppointment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600">
                  <Calendar size={40} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">{t.bookedSuccess}</h3>
                <p className="text-slate-500 text-sm mb-8">{t.waitMsg}</p>
                
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-8 flex items-center gap-4 text-left">
                  <img src={scheduledAppointment.image} alt="" className="w-12 h-12 rounded-full" />
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">With Specialist</p>
                    <p className="font-bold text-slate-800">{scheduledAppointment.name}</p>
                    <p className="text-emerald-600 text-sm font-bold mt-1">Today @ 2:30 PM</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => {
                      const doc = scheduledAppointment;
                      setScheduledAppointment(null);
                      startVideoCall(doc);
                    }}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all"
                  >
                    {t.startNow}
                  </button>
                  <button
                    onClick={() => setScheduledAppointment(null)}
                    className="w-full py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Toaster />
    </div>
  );
}
