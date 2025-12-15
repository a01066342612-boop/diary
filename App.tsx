import React, { useState, useRef, useEffect } from 'react';
import { WeatherType, GRID_COLS, FontFamily, FONT_OPTIONS } from './types';
import WeatherSelector from './components/WeatherSelector';
import GridNotebook from './components/GridNotebook';
import { generateDiaryImage, streamDiarySpeech } from './services/geminiService';
import { Pencil, Image as ImageIcon, Loader2, Save, Plus, Minus, Volume2, Eye, ArrowLeft, Type, BookOpen, X } from 'lucide-react';

// Helper to decode base64 string
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to decode raw PCM audio data
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Helper to calculate exact rows needed based on GridNotebook logic
const calculateRequiredRows = (text: string) => {
  // Logic must match GridNotebook.tsx exactly
  const cleanText = ' ' + text.replace(/\n/g, ' ').replace(/([.,!?])\s+/g, '$1');
  let cellCount = 0;
  let textIndex = 0;

  while (textIndex < cleanText.length) {
    const char = cleanText[textIndex];
    
    // Skip spaces at start of new line (except very first char)
    if (char === ' ' && cellCount > 0 && cellCount % GRID_COLS === 0) {
      textIndex++;
      continue;
    }

    const nextChar = cleanText[textIndex + 1];
    const isNextPunctuation = ['.', ',', '!', '?'].includes(nextChar);
    const isEndOfLine = (cellCount + 1) % GRID_COLS === 0;

    if (isEndOfLine && isNextPunctuation) {
      cellCount++; // Squeeze 2 chars into 1 cell
      textIndex += 2;
    } else {
      cellCount++;
      textIndex++;
    }
  }
  
  return Math.max(5, Math.ceil(cellCount / GRID_COLS));
};

const App: React.FC = () => {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [weather, setWeather] = useState<WeatherType>(WeatherType.SUNNY);
  const [font, setFont] = useState<FontFamily>('flower');
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<number>(5);
  const [isViewMode, setIsViewMode] = useState<boolean>(false);
  const [isTwoPageMode, setIsTwoPageMode] = useState<boolean>(false);
  const [isFontMenuOpen, setIsFontMenuOpen] = useState<boolean>(false);
  
  const diaryRef = useRef<HTMLDivElement>(null);

  // Load data when date changes
  useEffect(() => {
    const savedData = localStorage.getItem(`diary_${date}`);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setTitle(parsed.title || '');
        setContent(parsed.content || '');
        setWeather(parsed.weather || WeatherType.SUNNY);
        setFont(parsed.font || 'flower');
        setGeneratedImage(parsed.generatedImage || null);
        
        // Recalculate rows based on loaded content
        if (parsed.content) {
          setRows(calculateRequiredRows(parsed.content));
        } else {
          setRows(5);
        }
      } catch (e) {
        console.error("Failed to parse saved diary", e);
      }
    } else {
      // Reset if no data for this date
      setTitle('');
      setContent('');
      setWeather(WeatherType.SUNNY);
      setGeneratedImage(null);
      setRows(5);
      // We keep the current font preference intentionally or reset it? 
      // Let's keep the font as is for better UX, or reset to flower if strict per-day styling is needed.
      // Resetting to default for new entries ensures consistency.
      setFont('flower'); 
    }
  }, [date]);

  // Auto-save when content changes
  // Note: We exclude 'date' from dependency array to prevent saving old content to new date 
  // during the split second where date changed but content hasn't updated yet.
  useEffect(() => {
    const dataToSave = {
      title,
      content,
      weather,
      font,
      generatedImage
    };
    localStorage.setItem(`diary_${date}`, JSON.stringify(dataToSave));
  }, [title, content, weather, font, generatedImage]); // Intentionally omitting 'date'

  // Helper to get day of week
  const getDayOfWeek = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      // Create date using local time arguments
      const dateObj = new Date(year, month - 1, day);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      return days[dateObj.getDay()];
    } catch (e) {
      return '';
    }
  };

  const dayOfWeek = getDayOfWeek(date);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    
    // Automatically calculate required rows based on exact text layout
    const requiredRows = calculateRequiredRows(newText);
    
    // Update rows to fit content, respecting minimum of 5
    if (requiredRows !== rows) {
        setRows(requiredRows);
    }
    
    setContent(newText);
  };

  const handleGenerateImage = async () => {
    if (!content.trim()) {
      setError("일기 내용을 먼저 적어주세요!");
      return;
    }

    setError(null);
    setIsGenerating(true);
    setGeneratedImage(null);

    try {
      // Pass both title and content for better context
      const prompt = title ? `Title: ${title}. ${content}` : content;
      const imageUrl = await generateDiaryImage(prompt);
      setGeneratedImage(imageUrl);
    } catch (err) {
      setError("그림을 그리는데 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSpeak = async () => {
    if (!content.trim()) return;
    if (isPlayingAudio) return;
    
    setIsPlayingAudio(true);
    setError(null);

    let audioContext: AudioContext | null = null;

    try {
      const textToSay = `${title ? title + '. ' : ''}${content}`;
      const stream = streamDiarySpeech(textToSay);

      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      const outputNode = audioContext.createGain();
      outputNode.connect(audioContext.destination);
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      let nextStartTime = audioContext.currentTime;
      let sources: AudioBufferSourceNode[] = [];

      for await (const chunkBase64 of stream) {
        const audioBuffer = await decodeAudioData(
          decode(chunkBase64),
          audioContext,
          24000,
          1,
        );
        
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputNode);
        
        const startTime = Math.max(nextStartTime, audioContext.currentTime);
        source.start(startTime);
        nextStartTime = startTime + audioBuffer.duration;
        sources.push(source);
      }
      
      // When all chunks are scheduled, wait for the last one to finish
      if (sources.length > 0) {
        sources[sources.length - 1].onended = () => {
          setIsPlayingAudio(false);
          // Optional: close context to free resources
          // audioContext?.close(); 
        };
      } else {
        setIsPlayingAudio(false);
      }
      
    } catch (e) {
      console.error("Audio playback failed", e);
      setError("소리를 재생하는데 실패했어요.");
      setIsPlayingAudio(false);
      audioContext?.close();
    }
  };

  const handleAddLine = () => {
    setRows(prev => prev + 1);
  };

  const handleRemoveLine = () => {
    setRows(prev => Math.max(5, prev - 1)); // Ensure we don't go below minimum 5 when manually removing
  };

  const handleSave = async () => {
    if (!diaryRef.current) return;
    
    // Check if html2canvas is loaded
    if (typeof (window as any).html2canvas === 'undefined') {
      alert("저장 기능을 준비 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    try {
      const canvas = await (window as any).html2canvas(diaryRef.current, {
        scale: 2, // Higher quality
        backgroundColor: '#fdfbf7', // Paper color
        useCORS: true // Allow loading cross-origin images if any
      });
      
      const image = canvas.toDataURL("image/png");
      const link = document.createElement('a');
      link.href = image;
      link.download = `나의그림일기_${date}.png`;
      link.click();
    } catch (e) {
      console.error("Save failed", e);
      alert("저장에 실패했어요. 인쇄 기능을 사용해보세요!");
    }
  };

  return (
    <div className={`min-h-screen bg-yellow-50 py-8 px-4 font-${font}`}>
      {/* Two Page View Modal */}
      {isTwoPageMode && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 sm:p-8 overflow-y-auto font-flower animate-in fade-in duration-300">
          <div className="relative w-full max-w-7xl flex flex-col lg:flex-row shadow-2xl rounded-3xl overflow-hidden">
            <button 
              onClick={() => setIsTwoPageMode(false)}
              className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors lg:fixed lg:top-8 lg:right-8 lg:p-3"
            >
              <X className="w-8 h-8 lg:w-10 lg:h-10" />
            </button>

            {/* Left Page - Image */}
            <div className="flex-1 bg-[#fdfbf7] p-8 lg:p-12 min-h-[50vh] flex flex-col items-center justify-center border-b-2 lg:border-b-0 lg:border-r border-gray-200 relative">
              {/* Spine shadow for left page */}
              <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black/5 to-transparent pointer-events-none hidden lg:block"></div>
              
              <div className="w-full h-full max-h-[80vh] border-8 border-white shadow-xl rotate-1 transition-transform hover:rotate-0 duration-500 bg-white">
                  {generatedImage ? (
                    <img src={generatedImage} alt="Diary" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center text-gray-300 min-h-[300px]">
                        <ImageIcon className="w-24 h-24 mb-4 opacity-30" />
                        <span className="text-3xl font-bold opacity-50">그림이 없어요</span>
                    </div>
                  )}
              </div>
            </div>

            {/* Right Page - Text */}
            <div className="flex-1 bg-[#fdfbf7] p-8 lg:p-12 min-h-[50vh] relative">
               {/* Spine shadow for right page */}
               <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black/5 to-transparent pointer-events-none hidden lg:block"></div>

               <div className="h-full flex flex-col gap-8">
                   {/* Header Info */}
                   <div className="border-b-4 border-gray-800 pb-6">
                       <div className="flex flex-wrap justify-between items-end border-b-2 border-gray-300 pb-4 mb-6 border-dashed gap-4">
                          <div className="flex gap-3 items-end">
                            <span className="text-2xl font-bold text-gray-500">날짜:</span>
                            <span className={`text-3xl font-${font} text-gray-800`}>
                              {date} <span className="text-2xl text-gray-500">({dayOfWeek})</span>
                            </span>
                          </div>
                          <div className="flex gap-3 items-center">
                             <span className="text-2xl font-bold text-gray-500">날씨:</span>
                             <span className={`text-4xl font-${font} text-gray-800`}>{weather}</span>
                          </div>
                       </div>
                       <div className="flex gap-3 items-end">
                          <span className="text-3xl font-bold text-gray-500 whitespace-nowrap">제목:</span>
                          <span className={`text-5xl text-gray-900 w-full truncate leading-none pb-1 font-${font}`}>{title}</span>
                       </div>
                   </div>

                   {/* Grid */}
                   <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                      <GridNotebook text={content} rows={Math.max(rows, 8)} font={font} />
                   </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Max width increased to 7xl to allow larger notebook */}
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        
        {/* Header Section - Hidden on Print */}
        {!isViewMode && (
          <header className="bg-white rounded-3xl shadow-xl p-6 border-4 border-yellow-300 border-dashed flex flex-col xl:flex-row items-center justify-between gap-6 no-print transform hover:scale-[1.01] transition-transform">
            <h1 className="text-2xl md:text-3xl font-bold text-yellow-900 flex flex-col md:flex-row items-center gap-2 text-center md:text-left">
              <div className="flex items-center gap-3 bg-yellow-100 px-4 py-2 rounded-2xl border-2 border-yellow-200">
                <span className="text-5xl drop-shadow-sm">📒</span> 
                <span className="whitespace-nowrap tracking-tight">나의 그림일기</span>
                <span className="text-5xl drop-shadow-sm">🖍️</span>
              </div>
              <span className="text-lg md:text-xl text-yellow-600 font-medium mt-2 md:mt-0 px-2">
                 ✨ (하루 중 가장 기억에 남는 일을 써보세요!) ✨
              </span>
            </h1>
            <div className="flex flex-col gap-2 w-full md:w-auto">
               <div className="flex items-center gap-2 bg-yellow-50 px-5 py-3 rounded-full border-2 border-yellow-200 justify-center shadow-inner">
                <span className="font-bold text-xl text-gray-600 flex items-center gap-1">📅 날짜:</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`font-bold text-xl bg-transparent border-none focus:ring-0 text-gray-800 cursor-pointer font-${font}`}
                />
                <span className={`font-bold text-xl text-gray-800 font-${font}`}>({dayOfWeek}요일)</span>
              </div>
            </div>
          </header>
        )}

        {/* Main Content Area */}
        <div className={`grid gap-6 ${isViewMode ? 'place-items-center' : 'lg:grid-cols-2'}`}>
          
          {/* Controls Section - Hidden in View Mode & Print */}
          {!isViewMode && (
            <section className="space-y-6 no-print w-full">
               <div className="bg-white p-6 rounded-3xl shadow-xl border-2 border-yellow-200">
                 
                 <div className="mb-6 flex justify-center">
                  <WeatherSelector selected={weather} onSelect={setWeather} />
                </div>

                <div className="flex flex-col md:flex-row gap-3 mb-6">
                   {/* Font Picker Button with Popup */}
                  <div className="relative flex-1 w-full">
                    <button
                      onClick={() => setIsFontMenuOpen(!isFontMenuOpen)}
                      className="w-full py-3 bg-white text-teal-600 border-2 border-teal-200 rounded-2xl font-bold text-xl hover:bg-teal-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                       <Type className="w-6 h-6" /> 🔡 글씨체
                    </button>
                    
                    {isFontMenuOpen && (
                      <div className="absolute top-full mt-2 left-0 right-0 bg-white border-4 border-teal-200 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto p-2">
                        <div className="grid gap-2">
                          {FONT_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => {
                                    setFont(option.value);
                                    setIsFontMenuOpen(false);
                                  }}
                              className={`
                                w-full text-left px-4 py-3 rounded-xl transition-colors font-bold text-xl flex items-center justify-between
                                font-${option.value}
                                ${font === option.value ? 'bg-teal-100 text-teal-800' : 'hover:bg-gray-100 text-gray-600'}
                              `}
                            >
                              <span>{option.label}</span>
                              {font === option.value && <span>✅</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                   <button
                    onClick={() => setIsViewMode(true)}
                    className="flex-1 w-full py-3 bg-white text-purple-600 border-2 border-purple-200 rounded-2xl font-bold text-xl hover:bg-purple-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                     <Eye className="w-6 h-6" /> 📄 한 장 보기
                  </button>

                  <button
                    onClick={() => setIsTwoPageMode(true)}
                    className="flex-1 w-full py-3 bg-white text-indigo-600 border-2 border-indigo-200 rounded-2xl font-bold text-xl hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                     <BookOpen className="w-6 h-6" /> 📖 두 쪽 보기
                  </button>
                </div>

                <div className="space-y-5">
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                     <label className="block text-xl font-bold text-blue-800 mb-2 flex items-center gap-2">
                       <span>📛</span> 제목
                     </label>
                     <input 
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="오늘 일기의 제목은 무엇인가요? 🤔"
                        className={`w-full p-3 text-2xl border-2 border-blue-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-300 font-${font} placeholder:text-blue-300`}
                     />
                  </div>

                  <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                    <label className="block text-xl font-bold text-orange-800 mb-2 flex items-center gap-2">
                      <span>📝</span> 오늘의 이야기
                    </label>
                    <textarea
                      className={`w-full h-48 p-4 text-2xl border-2 border-orange-200 rounded-xl focus:ring-4 focus:ring-orange-100 focus:border-orange-300 resize-none font-${font} placeholder:text-orange-300 leading-relaxed`}
                      placeholder={`여기에 일기를 써보세요.\n(재미있었던 일을 떠올려보세요!) 🎈\n\n칸에 맞춰서 써져요.`}
                      value={content}
                      onChange={handleContentChange}
                    />
                    <div className="flex justify-between items-center mt-3">
                      <div className="flex gap-2">
                        <button 
                          onClick={handleAddLine}
                          className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-white px-3 py-1.5 rounded-full border-2 border-blue-100 shadow-sm hover:bg-blue-50 transition-colors"
                        >
                          <Plus className="w-4 h-4" /> ➕ 줄 추가
                        </button>
                        <button 
                          onClick={handleRemoveLine}
                          disabled={rows <= 5}
                          className={`text-sm font-bold flex items-center gap-1 px-3 py-1.5 rounded-full border-2 transition-colors shadow-sm ${
                            rows <= 5
                            ? 'text-gray-400 bg-gray-50 border-gray-100 cursor-not-allowed' 
                            : 'text-red-500 hover:text-red-700 bg-white border-red-100 hover:bg-red-50'
                          }`}
                        >
                          <Minus className="w-4 h-4" /> ➖ 줄 삭제
                        </button>
                      </div>
                      <span className="text-orange-400 font-bold bg-white px-3 py-1 rounded-full border border-orange-100">
                        {content.length} 글자
                      </span>
                    </div>
                  </div>

                  {error && (
                    <div className="p-4 bg-red-100 text-red-700 rounded-2xl text-lg font-bold text-center border-2 border-red-200 animate-pulse">
                      🚨 {error}
                    </div>
                  )}

                  <div className="pt-2 flex flex-col gap-3">
                    <div className="flex gap-3">
                      <button
                        onClick={handleGenerateImage}
                        disabled={isGenerating || !content}
                        className={`
                          flex-1 py-4 rounded-2xl font-bold text-2xl text-white shadow-lg flex items-center justify-center gap-2 transition-all transform hover:-translate-y-1 active:translate-y-0
                          ${isGenerating || !content ? 'bg-blue-300 cursor-not-allowed' : 'bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600'}
                        `}
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-8 h-8 animate-spin" /> 🎨 그리는 중...
                          </>
                        ) : (
                          <>
                            <ImageIcon className="w-8 h-8" /> 🎨 그림 그리기
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleSpeak}
                        disabled={isPlayingAudio || !content}
                        className={`
                          w-24 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center transition-all transform hover:-translate-y-1 active:translate-y-0
                          ${isPlayingAudio ? 'bg-orange-300 cursor-not-allowed' : 'bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600'}
                        `}
                        aria-label="소리 듣기"
                      >
                        {isPlayingAudio ? (
                          <Loader2 className="w-8 h-8 animate-spin" />
                        ) : (
                          <Volume2 className="w-8 h-8" />
                        )}
                      </button>
                    </div>
                    
                    <button
                      onClick={handleSave}
                      className="w-full py-3 bg-white text-green-600 border-2 border-green-200 rounded-2xl font-bold text-xl hover:bg-green-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Save className="w-6 h-6" /> 💾 내 일기 이미지로 저장하기
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Preview Section (The "Notebook") */}
          <main className={`flex flex-col items-center w-full ${isViewMode ? 'justify-center' : ''}`}>
             
             {isViewMode && (
                <div className="w-full max-w-5xl mb-6 flex justify-between items-center no-print">
                   <button 
                      onClick={() => setIsViewMode(false)}
                      className="bg-white hover:bg-yellow-50 text-yellow-700 border-2 border-yellow-200 px-6 py-3 rounded-2xl font-bold text-xl flex items-center gap-2 shadow-md transition-all transform hover:-translate-y-1"
                   >
                     <ArrowLeft className="w-6 h-6" /> ✏️ 다시 쓰기
                   </button>
                   <button
                    onClick={handleSave}
                    className="bg-white hover:bg-green-50 text-green-700 border-2 border-green-200 px-6 py-3 rounded-2xl font-bold text-xl flex items-center gap-2 shadow-md transition-all transform hover:-translate-y-1"
                  >
                    <Save className="w-6 h-6" /> 💾 저장하기
                  </button>
                </div>
             )}

             {/* This div is what we capture with html2canvas. Increased max-width for larger cells. */}
            <div 
              ref={diaryRef}
              className={`w-full max-w-5xl bg-paper shadow-2xl overflow-hidden relative print:shadow-none print:max-w-none print:w-[100%] font-${font}`}
            >
               {/* Notebook Binding Effect - Hide in print if preferred, but nice to keep */}
               <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-gray-200/50 to-transparent z-10 pointer-events-none"></div>

               {/* Top Info Area - Increased sizes for Title and Date */}
               <div className="border-b-4 border-gray-800 p-8 bg-white">
                 <div className="flex justify-between items-center border-b-2 border-gray-300 pb-4 mb-6 border-dashed">
                    <div className="flex gap-4 items-end">
                      <span className="text-2xl font-bold text-gray-600">날짜 :</span>
                      <span className={`text-3xl font-${font} text-gray-800`}>
                        {date.split('-')[0]}년 {date.split('-')[1]}월 {date.split('-')[2]}일 <span className="text-2xl text-gray-600">({dayOfWeek}요일)</span>
                      </span>
                    </div>
                    <div className="flex gap-4 items-center">
                       <span className="text-2xl font-bold text-gray-600">날씨 :</span>
                       <span className={`text-3xl font-${font} text-gray-800`}>{weather}</span>
                    </div>
                 </div>
                 <div className="flex gap-4 items-end min-h-[3.5rem]">
                    <span className="text-3xl font-bold text-gray-600 whitespace-nowrap">제목 :</span>
                    <span className={`text-5xl text-gray-900 w-full truncate leading-none pb-1 pl-2 font-${font}`}>{title}</span>
                 </div>
               </div>

              {/* Picture Area */}
              <div className="aspect-[4/3] w-full border-b-4 border-gray-800 bg-gray-50 flex items-center justify-center overflow-hidden relative group">
                {generatedImage ? (
                  <img
                    src={generatedImage}
                    alt="Generated Diary Illustration"
                    className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                ) : (
                  <div className="text-center text-gray-300 p-10 border-4 border-dashed border-gray-200 rounded-3xl m-8">
                    <ImageIcon className="w-24 h-24 mx-auto mb-4 opacity-30" />
                    <p className="text-2xl font-bold opacity-60">
                      ✨ 여기에 멋진 그림이 그려질 거예요 ✨
                    </p>
                  </div>
                )}
              </div>

              {/* Grid Text Area */}
              <div className="p-6 bg-white min-h-[250px]">
                 <GridNotebook text={content} rows={rows} font={font} />
              </div>
            </div>
            
            {!isViewMode && (
              <div className="mt-8 mb-4 text-center no-print">
                 <p className="inline-block bg-yellow-100 text-yellow-800 text-2xl px-8 py-4 rounded-full font-bold animate-bounce shadow-lg border-2 border-yellow-200">
                    🌈 ⭐ 참 잘했어요! 내일도 써볼까요? ⭐ 🌈
                 </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default App;