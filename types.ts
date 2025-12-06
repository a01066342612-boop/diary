export enum WeatherType {
  SUNNY = '맑음',
  CLOUDY = '흐림',
  RAINY = '비',
  SNOWY = '눈'
}

export type VoiceGender = 'MALE' | 'FEMALE';

export type FontFamily = 'flower' | 'hand' | 'pen' | 'melody' | 'jua' | 'dongle' | 'single' | 'myeongjo' | 'gulim';

export interface FontOption {
  label: string;
  value: FontFamily;
}

export const FONT_OPTIONS: FontOption[] = [
  { label: '감자꽃', value: 'flower' },
  { label: '개구쟁이', value: 'hand' },
  { label: '나눔펜', value: 'pen' },
  { label: '하이멜로디', value: 'melody' },
  { label: '주아', value: 'jua' },
  { label: '동글', value: 'dongle' },
  { label: '싱글데이', value: 'single' },
  { label: '명조체', value: 'myeongjo' },
  { label: '굴림체', value: 'gulim' },
];

export interface DiaryEntry {
  date: string;
  weather: WeatherType;
  content: string;
  imageUrl?: string;
  title?: string;
}

export const GRID_COLS = 10;