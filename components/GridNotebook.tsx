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
  // Rule 2: Remove spaces immediately following punctuation marks (., !, ?) to allow tight packing
  // Rule 3: Remove spaces after Opening Quotes and before Closing Quotes to simulate "half-width" tightness
  // Rule 4: Always add a leading space to the content so the first cell is empty (Indentation)
  const cleanText = ' ' + text
    .replace(/\n/g, ' ')
    .replace(/([.,!?])\s+/g, '$1') // Remove space after punctuation
    .replace(/([“‘])\s+/g, '$1')   // Remove space after Opening Quote
    .replace(/\s+([”’])/g, '$1');  // Remove space before Closing Quote

  const displayCells: { char: string, subChar?: string }[] = [];
  let textIndex = 0;

  const OPEN_QUOTES = ['“', '‘', '"', "'", '(']; // Added parens just in case
  const CLOSE_QUOTES = ['”', '’', '"', "'", ')'];
  const PUNCTUATION = ['.', ',', '!', '?'];
  
  // Specific alignment targets (Smart quotes)
  const ALIGN_TR = ['“', '‘']; // Top Right
  const ALIGN_TL = ['”', '’']; // Top Left

  // Characters that should not start a new line (squeeze target)
  const FORBIDDEN_START_CHARS = [...PUNCTUATION, '”', '’', ')'];

  while (textIndex < cleanText.length && displayCells.length < maxChars) {
    const char = cleanText[textIndex];
    
    // Rule: Skip spaces if they fall at the start of a new line
    if (char === ' ' && displayCells.length > 0 && displayCells.length % GRID_COLS === 0) {
      textIndex++;
      continue;
    }

    const nextChar = cleanText[textIndex + 1];
    
    const currentCellIndex = displayCells.length;
    const isEndOfLine = (currentCellIndex + 1) % GRID_COLS === 0;
    const isNextForbiddenStart = FORBIDDEN_START_CHARS.includes(nextChar);

    // Logic: Only squeeze at the end of the line
    // If we are at the last cell of the row, and the NEXT character is something that shouldn't 
    // be at the start of the next line (like . , ! ? ” ’), we pull it into this cell.
    if (isEndOfLine && isNextForbiddenStart) {
      displayCells.push({ char: char, subChar: nextChar });
      textIndex += 2;
    } 
    else {
      displayCells.push({ char: char });
      textIndex++;
    }
  }

  // Fill remaining cells with empty strings
  while (displayCells.length < maxChars) {
    displayCells.push({ char: '' });
  }

  // Group cells into rows
  const gridRows: { char: string, subChar?: string }[][] = [];
  for (let i = 0; i < displayCells.length; i += GRID_COLS) {
    gridRows.push(displayCells.slice(i, i + GRID_COLS));
  }

  return (
    <div className="w-full bg-white border-2 border-gray-800 overflow-hidden">
      <table className="w-full table-fixed border-collapse">
        <tbody>
          {gridRows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, colIndex) => {
                const isLastCol = colIndex === row.length - 1;
                const isLastRow = rowIndex === gridRows.length - 1;

                // Character Type Analysis for Alignment
                const isOpenQuote = ALIGN_TR.includes(cell.char);
                const isCloseQuote = ALIGN_TL.includes(cell.char);
                const isDotOrComma = ['.', ','].includes(cell.char);
                
                // Determine if subChar is a quote to adjust its size/pos when squeezed
                const isSubCharQuote = CLOSE_QUOTES.includes(cell.subChar || '');
                const isPunctuationWithQuote = PUNCTUATION.includes(cell.char) && isSubCharQuote;

                // Base Font Size vs Quote Font Size (Half-width effect)
                const baseTextSize = 'text-3xl sm:text-4xl md:text-5xl';
                // Reduced size for quotes and squeezed punctuation to visually look like "half-width" chars
                const quoteTextSize = 'text-lg sm:text-xl md:text-2xl'; 
                
                // Alignment Logic
                let justifyClass = 'justify-center';
                let itemsClass = 'items-center';
                let translateClass = '';
                let fontSizeClass = baseTextSize;

                if (isDotOrComma) {
                  // Dots/Commas: Bottom Left
                  justifyClass = '!justify-start';
                  itemsClass = '!items-end';
                  translateClass = 'translate-x-1 -translate-y-1';
                } else if (isOpenQuote) {
                  // Opening Quote: Top Right
                  // Removed x-translation to keep it at the right edge
                  justifyClass = '!justify-end';
                  itemsClass = '!items-start';
                  translateClass = 'translate-y-1'; // Slight adjustment from top
                  fontSizeClass = quoteTextSize;
                } else if (isCloseQuote) {
                  // Closing Quote: Top Left
                  // Removed x-translation to keep it at the left edge
                  justifyClass = '!justify-start';
                  itemsClass = '!items-start';
                  translateClass = 'translate-y-1'; // Slight adjustment from top
                  fontSizeClass = quoteTextSize;
                }

                return (
                  <td 
                    key={colIndex}
                    className={`
                      p-0 align-bottom border-gray-300
                      ${!isLastCol ? 'border-r' : ''}
                      ${!isLastRow ? 'border-b' : ''}
                    `}
                  >
                    <div className={`
                      aspect-square w-full relative flex ${justifyClass} ${itemsClass}
                      ${fontSizeClass} font-${font}
                      p-1
                    `}>
                      <span className={`notebook-text z-10 leading-none ${translateClass}`}>
                        {cell.char}
                      </span>
                      
                      {cell.subChar && (
                        <span className={`
                          absolute leading-none z-10
                          ${isPunctuationWithQuote 
                            ? `top-2 right-2 ${quoteTextSize}` // Quote attached to punctuation: Top Right
                            : `bottom-0 right-1 ${quoteTextSize}` // Normal squeeze: Bottom Right (Consistent Size)
                          }
                          font-bold
                        `}>
                          {cell.subChar}
                        </span>
                      )}
                      
                      {/* Dotted midline guide (Horizontal) */}
                      <div className="absolute top-1/2 left-0 right-0 border-b border-gray-200 border-dashed pointer-events-none z-0 opacity-50"></div>
                      {/* Dotted midline guide (Vertical) */}
                      <div className="absolute left-1/2 top-0 bottom-0 border-l border-gray-200 border-dashed pointer-events-none z-0 opacity-50"></div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default GridNotebook;