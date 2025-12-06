import React from 'react';
import { GRID_COLS, FontFamily } from '../types';

interface GridNotebookProps {
  text: string;
  rows: number;
  font: FontFamily;
}

const GridNotebook: React.FC<GridNotebookProps> = ({ text, rows, font }) => {
  const maxChars = rows * GRID_COLS;
  
  // Rule 1: Replace newlines with spaces to treat text as continuous
  // Rule 2: Remove spaces immediately following punctuation marks (., !, ?)
  // Rule 3: Always add a leading space to the content so the first cell is empty (Indentation for the very first start)
  const cleanText = ' ' + text.replace(/\n/g, ' ').replace(/([.,!?])\s+/g, '$1');

  // Process text to handle "squeezing" punctuation and "skipping" start-of-line spaces
  const displayCells: { char: string, subChar?: string }[] = [];
  let textIndex = 0;

  while (textIndex < cleanText.length && displayCells.length < maxChars) {
    const char = cleanText[textIndex];
    
    // Rule: Skip spaces if they fall at the start of a new line (index % 10 === 0)
    // Exception: Do NOT skip the very first space (indentation for the start of the diary)
    if (char === ' ' && displayCells.length > 0 && displayCells.length % GRID_COLS === 0) {
      textIndex++;
      continue;
    }

    // Look ahead logic for end-of-line punctuation
    const nextChar = cleanText[textIndex + 1];
    const isNextPunctuation = ['.', ',', '!', '?'].includes(nextChar);
    
    // Current cell index (visual index)
    const currentCellIndex = displayCells.length;
    // Check if this cell is the last in the row (e.g., 9, 19, 29...)
    const isEndOfLine = (currentCellIndex + 1) % GRID_COLS === 0;

    if (isEndOfLine && isNextPunctuation) {
      // Squeeze: Put current char and next punctuation in the same cell
      displayCells.push({ char: char, subChar: nextChar });
      textIndex += 2; // Skip both
    } else {
      displayCells.push({ char: char });
      textIndex++;
    }
  }

  // Fill remaining cells with empty strings
  while (displayCells.length < maxChars) {
    displayCells.push({ char: '' });
  }

  return (
    <div className="w-full bg-white">
      <div 
        className="grid border-2 border-gray-800 bg-white" 
        style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
      >
        {displayCells.map((cell, index) => {
          // Check alignment rules
          // Standalone '.' and ',' go to bottom-left
          const isDotOrComma = ['.', ','].includes(cell.char);
          
          return (
            <div
              key={index}
              className={`notebook-grid-cell aspect-square text-3xl sm:text-4xl md:text-5xl font-${font} ${
                isDotOrComma && !cell.subChar ? '!justify-start !items-end p-1' : ''
              }`}
            >
              <span className={`notebook-text ${isDotOrComma && !cell.subChar ? 'translate-y-1' : ''}`}>
                {cell.char}
              </span>
              {cell.subChar && (
                <span className="absolute bottom-0 right-1 text-2xl font-bold leading-none">
                  {cell.subChar}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GridNotebook;