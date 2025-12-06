import React from 'react';
import { WeatherType } from '../types';

interface WeatherSelectorProps {
  selected: WeatherType;
  onSelect: (weather: WeatherType) => void;
}

const WeatherSelector: React.FC<WeatherSelectorProps> = ({ selected, onSelect }) => {
  const options = [
    { type: WeatherType.SUNNY, emoji: '☀️', color: 'bg-red-50 border-red-200 text-red-600' },
    { type: WeatherType.CLOUDY, emoji: '☁️', color: 'bg-gray-50 border-gray-200 text-gray-600' },
    { type: WeatherType.RAINY, emoji: '☔', color: 'bg-blue-50 border-blue-200 text-blue-600' },
    { type: WeatherType.SNOWY, emoji: '☃️', color: 'bg-cyan-50 border-cyan-200 text-cyan-600' },
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-center justify-center p-3 bg-white rounded-2xl border-2 border-yellow-100">
      <span className="text-xl font-bold text-gray-700 flex items-center gap-2">
        🌈 날씨:
      </span>
      <div className="flex gap-2">
        {options.map((option) => (
          <button
            key={option.type}
            onClick={() => onSelect(option.type)}
            className={`
              flex items-center gap-1 px-3 py-2 rounded-xl border-2 transition-all shadow-sm
              ${selected === option.type 
                ? `${option.color.replace('bg-', 'bg-opacity-100 ')} border-current ring-2 ring-offset-1 ring-yellow-200 scale-105` 
                : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
              }
            `}
            aria-label={option.type}
          >
            <span className="text-2xl filter drop-shadow-sm">{option.emoji}</span>
            <span className={`text-lg font-bold ${selected === option.type ? 'font-black' : ''}`}>{option.type}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default WeatherSelector;