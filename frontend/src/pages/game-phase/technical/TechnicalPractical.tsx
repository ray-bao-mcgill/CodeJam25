import React, { useState, useRef, useEffect } from 'react';
import styles from './TechnicalPractical.module.css';

const TAB_IDE = 'IDE' as const;
const TAB_TEXT = 'TEXT' as const;
const TAB_DRAW = 'DRAW' as const;
type TabType = typeof TAB_IDE | typeof TAB_TEXT | typeof TAB_DRAW;
const TAB_OPTIONS: TabType[] = [TAB_IDE, TAB_TEXT, TAB_DRAW];

const SUPPORTED_LANGS = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' }
];

const CANVAS_WIDTH = 540;
const CANVAS_HEIGHT = 320;
const MONACO_LOADER_SRC = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js";

function loadMonacoLoaderScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).require) return resolve();
    if (document.getElementById('monaco-loader')) return resolve();
    const script = document.createElement('script');
    script.id = 'monaco-loader';
    script.src = MONACO_LOADER_SRC;
    script.onload = () => {
      console.log('[Monaco] Loader script loaded');
      resolve();
    };
    script.onerror = e => reject(e);
    document.head.appendChild(script);
  });
}

function loadMonaco(): Promise<any> {
  return loadMonacoLoaderScript().then(() => {
    return new Promise((resolve, reject) => {
      if ((window as any).monaco && (window as any).monaco.editor) {
        console.log('[Monaco] Monaco already loaded');
        resolve((window as any).monaco);
        return;
      }
      (window as any).require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs" } });
      (window as any).require(["vs/editor/editor.main"], () => {
        console.log('[Monaco] Monaco loaded successfully!');
        resolve((window as any).monaco);
      });
    });
  });
}

const TechnicalPractical: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>(TAB_IDE);
  const [codeValue, setCodeValue] = useState('// Start coding here...');
  const [editorLang, setEditorLang] = useState('javascript');
  const [textValue, setTextValue] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const monacoEditorRef = useRef<any>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{x:number, y:number} | null>(null);

  // MONACO INTEGRATION: Only load when IDE tab is active
  useEffect(() => {
    (async () => {
      if (activeTab !== TAB_IDE) return;
      await new Promise(r => setTimeout(r, 0));
      const container = editorContainerRef.current;
      if (!container) {
        console.warn('[Monaco] #code-editor container missing');
        return;
      }
      // Clean up previous instance
      if (monacoEditorRef.current) {
        try { monacoEditorRef.current.dispose(); } catch {}
        monacoEditorRef.current = null;
      }
      try {
        const monaco = await loadMonaco();
        const editor = monaco.editor.create(container, {
          value: codeValue,
          language: editorLang,
          automaticLayout: true,
          minimap: { enabled: false },
          theme: "vs-dark",
          fontSize: 14,
          roundedSelection: true,
        });
        monacoEditorRef.current = editor;
        // Listen for changes
        editor.onDidChangeModelContent(() => {
          setCodeValue(editor.getValue());
        });
        // Clean up on unmount
        console.log('[Monaco] Editor initialized in IDE tab');
      } catch (e) {
        console.error('[Monaco] Error initializing Monaco:', e);
      }
    })();
    // Clean up on unmount or tab switch
    return () => {
      if (monacoEditorRef.current) {
        try { monacoEditorRef.current.dispose(); } catch {}
        monacoEditorRef.current = null;
        console.log('[Monaco] Editor disposed');
      }
    };
    // eslint-disable-next-line
  }, [activeTab]);

  // Handle Monaco language switching
  useEffect(() => {
    if (activeTab !== TAB_IDE) return;
    if (monacoEditorRef.current && (window as any).monaco) {
      const monaco = (window as any).monaco;
      const currModel = monacoEditorRef.current.getModel();
      if (currModel) monaco.editor.setModelLanguage(currModel, editorLang);
      console.log('[Monaco] Language switched to', editorLang);
    }
    // eslint-disable-next-line
  }, [editorLang, activeTab]);

  // Draw tab: attach event listeners
  useEffect(() => {
    if (activeTab !== TAB_DRAW) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#222';
    let mouseDownListener: (e: MouseEvent) => void;
    let mouseMoveListener: (e: MouseEvent) => void;
    let mouseUpListener: (e: MouseEvent) => void;
    let mouseLeaveListener: (e: MouseEvent) => void;

    mouseDownListener = (e) => {
      const rect = canvas.getBoundingClientRect();
      lastPoint.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      drawing.current = true;
    };
    mouseMoveListener = (e) => {
      if (!drawing.current) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (lastPoint.current && ctx) {
        ctx.beginPath();
        ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        lastPoint.current = { x, y };
      }
    };
    mouseUpListener = () => {
      drawing.current = false;
      lastPoint.current = null;
    };
    mouseLeaveListener = () => {
      drawing.current = false;
      lastPoint.current = null;
    };
    canvas.addEventListener('mousedown', mouseDownListener);
    canvas.addEventListener('mousemove', mouseMoveListener);
    window.addEventListener('mouseup', mouseUpListener);
    canvas.addEventListener('mouseleave', mouseLeaveListener);
    return () => {
      canvas.removeEventListener('mousedown', mouseDownListener);
      canvas.removeEventListener('mousemove', mouseMoveListener);
      window.removeEventListener('mouseup', mouseUpListener);
      canvas.removeEventListener('mouseleave', mouseLeaveListener);
    };
  }, [activeTab]);

  // Clear canvas on tab switch
  useEffect(() => {
    if (activeTab !== TAB_DRAW && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }, [activeTab]);

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
            <div className="mb-2 flex items-center gap-2">
              <label className="font-bold text-gray-700">Code Editor:</label>
              <select
                className="game-sharp px-3 py-1 border-2 border-gray-600 bg-white rounded text-base font-bold"
                style={{ minWidth: 120 }}
                value={editorLang}
                onChange={e => setEditorLang(e.target.value)}
                aria-label="Choose editor language"
              >
                {SUPPORTED_LANGS.map(lang => (
                  <option value={lang.value} key={lang.value}>{lang.label}</option>
                ))}
              </select>
            </div>
            <div
              id="code-editor"
              ref={editorContainerRef}
              style={{ width: '100%', height: 400, border: '3px solid #222', borderRadius: 8, background: '#1e1e20', overflow: 'hidden' }}
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
                ref={canvasRef}
                className={styles.drawcanvas}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                style={{ border: '4px solid #222', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
              />
              <div className="mt-2 text-xs text-gray-500">🖊 Draw with your mouse!</div>
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


