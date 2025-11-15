import React, { useState } from 'react';
import styles from './TechnicalPractical.module.css';

const TAB_IDE = 'IDE' as const;
const TAB_TEXT = 'TEXT' as const;
const TAB_DRAW = 'DRAW' as const;
type TabType = typeof TAB_IDE | typeof TAB_TEXT | typeof TAB_DRAW;
const TAB_OPTIONS: TabType[] = [TAB_IDE, TAB_TEXT, TAB_DRAW];

const TechnicalPractical: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>(TAB_IDE);
  const [codeValue, setCodeValue] = useState('');
  const [textValue, setTextValue] = useState('');
  const [drawData, setDrawData] = useState<string | null>(null); // stub for canvas

  return (
    <div className="game-bg min-h-screen w-full p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col items-center">
        <div className="game-paper px-10 py-4 game-shadow-hard-lg mb-3">
          <h1 className="game-title text-3xl sm:text-4xl">TECHNICAL PRACTICAL</h1>
        </div>
        <div className="game-label-text text-center text-base">
          Complete the practical question using your preferred mode
        </div>
      </div>

      {/* TABS */}
      <nav className={`${styles.tabs} flex justify-center gap-4 mb-6`} role="tablist">
        {TAB_OPTIONS.map(tab => (
          <button
            key={tab}
            type="button"
            className={
              `${styles.tab} px-7 py-3 rounded-t-lg font-bold text-lg uppercase tracking-wide shadow-md transition-all duration-150 ` +
              (activeTab === tab ? styles.active : styles.inactive)
            }
            data-active={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            tabIndex={activeTab === tab ? 0 : -1}
            role="tab"
            aria-selected={activeTab === tab}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* TAB PANELS */}
      <div className={styles.tabpanel}>
        {/* IDE TAB */}
        {activeTab === TAB_IDE && (
          <div className="px-4 py-2">
            <label className="block font-bold mb-2 text-gray-700">Code Editor:</label>
            <textarea
              className={`${styles.idearea} w-full min-h-[280px] font-mono border-4 border-gray-900 rounded-none p-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-600 game-shadow-hard`}
              value={codeValue}
              onChange={e => setCodeValue(e.target.value)}
              placeholder="Write your code here..."
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </div>
        )}
        {/* TEXT TAB */}
        {activeTab === TAB_TEXT && (
          <div className="px-4 py-2">
            <label className="block font-bold mb-2 text-gray-700">Text Answer:</label>
            <textarea
              className={`${styles.textarea} w-full min-h-[180px] border-4 border-gray-900 rounded-none p-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-600 game-shadow-hard`}
              value={textValue}
              onChange={e => setTextValue(e.target.value)}
              placeholder="Type your explanation, reasoning, or answer here..."
              spellCheck={true}
            />
          </div>
        )}
        {/* DRAW TAB */}
        {activeTab === TAB_DRAW && (
          <div className="px-4 py-2 flex flex-col items-center">
            <label className="block font-bold mb-2 text-gray-700">Whiteboard:</label>
            <div className={styles.drawcanvascontainer}>
              <canvas
                className={styles.drawcanvas}
                width={540}
                height={320}
                style={{ border: '4px solid #222', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
                // This canvas is placeholder — implement drawing logic later!
              />
              <div className="mt-2 text-xs text-gray-500">🖊 Drawing coming soon...</div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center mt-8">
        <button
          className="game-sharp game-block-blue px-12 py-4 text-lg font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover"
          style={{ border: '6px solid var(--game-text-primary)', color: 'var(--game-text-white)' }}
        >
          Submit Answer
        </button>
      </div>
    </div>
  );
};

export default TechnicalPractical;


