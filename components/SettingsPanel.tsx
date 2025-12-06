import React from 'react';
import { VoiceGender } from '../types';

interface SettingsPanelProps {
  voice: VoiceGender;
  setVoice: (voice: VoiceGender) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ voice, setVoice }) => {
  return (
    <div className="flex gap-3 items-center justify-center p-3 bg-orange-50 rounded-2xl border-2 border-orange-100 w-fit mx-auto shadow-sm">
      <span className="font-bold text-gray-700 flex items-center gap-2 text-lg">
        🎤 목소리:
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => setVoice('MALE')}
          className={`px-4 py-2 rounded-xl text-lg font-bold border-2 transition-all flex items-center gap-2 ${
            voice === 'MALE' 
              ? 'bg-blue-100 border-blue-400 text-blue-700 shadow-sm scale-105' 
              : 'bg-white border-transparent text-gray-400 hover:bg-gray-50'
          }`}
        >
          <span>👦</span> 남자
        </button>
        <button
          onClick={() => setVoice('FEMALE')}
          className={`px-4 py-2 rounded-xl text-lg font-bold border-2 transition-all flex items-center gap-2 ${
            voice === 'FEMALE' 
              ? 'bg-pink-100 border-pink-400 text-pink-700 shadow-sm scale-105' 
              : 'bg-white border-transparent text-gray-400 hover:bg-gray-50'
          }`}
        >
          <span>👧</span> 여자
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;