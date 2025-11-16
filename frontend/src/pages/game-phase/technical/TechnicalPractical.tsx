import React, { useState, useRef, useEffect } from 'react';
import styles from './TechnicalPractical.module.css';
import { useGameSync } from '@/hooks/useGameSync';
import { API_URL } from '@/config';

const TAB_IDE = 'IDE' as const;
const TAB_TEXT = 'TEXT' as const;
const TAB_DRAW = 'DRAW' as const;
type TabType = typeof TAB_IDE | typeof TAB_TEXT | typeof TAB_DRAW;
const TAB_OPTIONS: TabType[] = [TAB_IDE, TAB_TEXT, TAB_DRAW];

// Languages that support code execution
const EXECUTABLE_LANGS = ['python', 'java', 'javascript'];

// Ordered by usage frequency: most popular first, validation languages last
const SUPPORTED_LANGS = [
  // Most popular executable languages
  { value: 'python', label: 'Python', ext: ['py', 'python'] },
  { value: 'java', label: 'Java', ext: ['java'] },
  { value: 'javascript', label: 'JavaScript', ext: ['js', 'javascript'] },
  { value: 'typescript', label: 'TypeScript', ext: ['ts', 'typescript'] },
  { value: 'cpp', label: 'C++', ext: ['cpp', 'cc', 'cxx'] },
  { value: 'c', label: 'C', ext: ['c'] },
  { value: 'shell', label: 'Bash', ext: ['sh', 'bash'] },
  { value: 'sql', label: 'SQL', ext: ['sql'] },
  // Validation-only languages
  { value: 'yaml', label: 'YAML', ext: ['yaml', 'yml'] },
  { value: 'json', label: 'JSON', ext: ['json'] },
  { value: 'html', label: 'HTML', ext: ['html', 'htm'] },
  { value: 'css', label: 'CSS', ext: ['css'] },
  { value: 'markdown', label: 'Markdown', ext: ['md', 'markdown'] },
  { value: 'dockerfile', label: 'Dockerfile', ext: ['dockerfile'] },
];
const getLanguageFromFilename = (filename: string) => {
  const lowerName = filename.toLowerCase();
  // Match via extension or special Dockerfile
  if (lowerName === 'dockerfile') return 'dockerfile';
  const parts = lowerName.split('.')
  const ext = parts.length > 1 ? parts.pop() : '';
  for (const lang of SUPPORTED_LANGS) {
    if (lang.ext && lang.ext.includes(ext || '')) return lang.value;
  }
  return 'javascript'; // fallback
}

const MONACO_LOADER_SRC = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js";

// Color options for the drawing canvas
const DRAWING_COLORS = [
  '#000000', // Black
  '#FF0000', // Red
  '#0000FF', // Blue
  '#00FF00', // Green
  '#FFFF00', // Yellow
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#FFA500', // Orange
  '#800080', // Purple
  '#A52A2A', // Brown
];

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

// Minimal file structure for editor
interface CodeFile {
  name: string;
  code: string;
  language: string;
}

const initialFile: CodeFile = {
  name: 'main.js',
  code: '',
  language: 'javascript',
};

const TechnicalPractical: React.FC = () => {
  const { gameState } = useGameSync();
  const [activeTab, setActiveTab] = useState<TabType>(TAB_IDE);
  const [files, setFiles] = useState<CodeFile[]>([initialFile]);
  const [currentFileIdx, setCurrentFileIdx] = useState(0);
  const [textValue, setTextValue] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const monacoEditorRef = useRef<any>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{x:number, y:number} | null>(null);
  const [showFileModal, setShowFileModal] = useState(false);
  const [showDeleteFileIdx, setShowDeleteFileIdx] = useState<number | null>(null);
  const [fileInput, setFileInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [outputLog, setOutputLog] = useState<string[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Split panel state
  const [leftPanelWidth, setLeftPanelWidth] = useState(30); // Percentage, default 30% (right gets 70%)
  const [isResizing, setIsResizing] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const resizerRef = useRef<HTMLDivElement | null>(null);
  
  // Store initial mouse position and panel width when resizing starts
  const resizeStartRef = useRef<{ x: number; leftWidth: number } | null>(null);
  
  // Drawing color state
  const [selectedColor, setSelectedColor] = useState(DRAWING_COLORS[0]); // Default to black
  const [isEraserMode, setIsEraserMode] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const cursorOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  
  // Get question text
  const question = gameState?.question || 'Outline a production ML architecture including data ingestion, training, inference, and monitoring, with example configs.';

  // Effect to focus input when modal shown
  useEffect(() => {
    if (showFileModal && fileInputRef.current) {
      fileInputRef.current.focus();
    }
  }, [showFileModal]);

  // Monaco integration for multi-file
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
        const file = files[currentFileIdx];
        const editor = monaco.editor.create(container, {
          value: file.code,
          language: file.language,
          automaticLayout: true,
          minimap: { enabled: false },
          theme: "vs-dark",
          fontSize: 24,
          roundedSelection: true,
        });
        monacoEditorRef.current = editor;
        // Listen for changes
        editor.onDidChangeModelContent(() => {
          setFiles(f => {
            const newFiles = [...f];
            newFiles[currentFileIdx] = {
              ...newFiles[currentFileIdx],
              code: editor.getValue(),
            };
            return newFiles;
          });
        });
        console.log('[Monaco] Editor loaded for', file.name, `[${file.language}]`);
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
  }, [activeTab, currentFileIdx]);

  // Monaco language switching per file
  useEffect(() => {
    if (activeTab !== TAB_IDE) return;
    if (monacoEditorRef.current && (window as any).monaco) {
      const monaco = (window as any).monaco;
      const currModel = monacoEditorRef.current.getModel();
      if (currModel) monaco.editor.setModelLanguage(currModel, files[currentFileIdx].language);
      console.log('[Monaco] Language switched to', files[currentFileIdx].language, 'for', files[currentFileIdx].name);
    }
    // eslint-disable-next-line
  }, [activeTab, currentFileIdx, files[currentFileIdx].language]);

  // -- File sidebar logic --
  function handleAddFile() {
    setFileInput('');
    setShowFileModal(true);
  }
  function handleRemoveFile(idx: number) {
    setShowDeleteFileIdx(idx);
  }
  function handleConfirmDeleteFile() {
    if (showDeleteFileIdx === null) return;
    setFiles(f => {
      const arr = [...f];
      arr.splice(showDeleteFileIdx, 1);
      return arr;
    });
    setCurrentFileIdx(i => i === showDeleteFileIdx ? 0 : i > (showDeleteFileIdx || 0) ? i - 1 : i);
    setShowDeleteFileIdx(null);
  }
  function handleCancelDeleteFile() {
    setShowDeleteFileIdx(null);
  }
  function handleChangeLanguage(lang: string) {
    setFiles(f => {
      const arr = [...f];
      let code = arr[currentFileIdx].code;
      
      // Clean up invalid comment lines for the new language
      const lines = code.split('\n');
      const cleanedLines = lines.map(line => {
        const trimmedLine = line.trim();
        // Remove JavaScript-style comments if switching to Python/Shell
        if ((lang === 'python' || lang === 'shell') && trimmedLine.startsWith('//')) {
          return line.replace(/^\s*\/\/\s*/, '# ');
        }
        // Remove Python-style comments if switching to JavaScript/TypeScript
        if ((lang === 'javascript' || lang === 'typescript') && trimmedLine.startsWith('#')) {
          return line.replace(/^\s*#\s*/, '// ');
        }
        return line;
      });
      code = cleanedLines.join('\n');
      
      arr[currentFileIdx] = { ...arr[currentFileIdx], language: lang, code };
      return arr;
    });
  }
  function handleFileModalSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const fname = fileInput.trim();
    if (!fname) return;
    if (files.some(f => f.name === fname)) {
      alert('File already exists!');
      return;
    }
    // Guess default language by extension
    const lang = getLanguageFromFilename(fname);
    setFiles(f => [...f, { name: fname, code: '', language: lang }]);
    setCurrentFileIdx(files.length); // Focus new file
    setShowFileModal(false);
    setFileInput('');
  }
  function handleFileModalCancel() {
    setShowFileModal(false);
    setFileInput('');
  }
  // -- END sidebar logic --

  // Draw tab logic with color support and eraser
  useEffect(() => {
    if (activeTab !== TAB_DRAW) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = isEraserMode ? 30 : 3; // Larger eraser for better usability
    
    let mouseDownListener: (e: MouseEvent) => void;
    let mouseMoveListener: (e: MouseEvent) => void;
    let mouseUpListener: (e: MouseEvent) => void;
    let mouseLeaveListener: (e: MouseEvent) => void;
    
    mouseDownListener = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      lastPoint.current = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
      drawing.current = true;
    };
    
    mouseMoveListener = (e) => {
      if (!drawing.current) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      if (lastPoint.current && ctx) {
        if (isEraserMode) {
          // Eraser mode: use destination-out to erase
          ctx.globalCompositeOperation = 'destination-out';
        } else {
          // Drawing mode: use normal composite operation
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = selectedColor;
        }
        
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
      // Reset composite operation after drawing
      if (ctx) {
        ctx.globalCompositeOperation = 'source-over';
      }
    };
    
    mouseLeaveListener = () => {
      drawing.current = false;
      lastPoint.current = null;
      // Reset composite operation after drawing
      if (ctx) {
        ctx.globalCompositeOperation = 'source-over';
      }
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
  }, [activeTab, selectedColor, isEraserMode]);
  
  // Function to clear the canvas
  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
  
  // Eraser cursor overlay effect
  useEffect(() => {
    if (activeTab !== TAB_DRAW || !isEraserMode) {
      setMousePosition(null);
      const overlay = cursorOverlayRef.current;
      if (overlay) {
        const ctx = overlay.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, overlay.width, overlay.height);
        }
      }
      return;
    }
    
    const canvas = canvasRef.current;
    const overlay = cursorOverlayRef.current;
    const container = canvasContainerRef.current;
    if (!canvas || !overlay || !container) return;
    
    // Set overlay size to match container
    const updateOverlaySize = () => {
      const rect = container.getBoundingClientRect();
      overlay.width = rect.width;
      overlay.height = rect.height;
    };
    updateOverlaySize();
    
    const handleMouseMove = (e: MouseEvent) => {
      const containerRect = container.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      
      // Calculate position relative to the canvas (accounting for scaling)
      const x = e.clientX - canvasRect.left;
      const y = e.clientY - canvasRect.top;
      
      setMousePosition({ x, y });
      
      // Draw cursor circle - radius matches eraser size (30px = 15px radius)
      // Scale the radius based on canvas scaling
      const scaleX = canvasRect.width / canvas.width;
      const scaleY = canvasRect.height / canvas.height;
      const scale = Math.min(scaleX, scaleY);
      const radius = 15 * scale; // 15px radius scaled
      
      const ctx = overlay.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    };
    
    const handleMouseLeave = () => {
      setMousePosition(null);
      const ctx = overlay.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, overlay.width, overlay.height);
      }
    };
    
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('resize', updateOverlaySize);
    
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', updateOverlaySize);
    };
  }, [activeTab, isEraserMode]);
  
  // Initialize canvas size
  useEffect(() => {
    if (activeTab !== TAB_DRAW) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set a high-resolution canvas that will be scaled down via CSS
    // This preserves drawing quality while allowing responsive sizing
    if (canvas.width === 0 || canvas.height === 0) {
      canvas.width = 1200;
      canvas.height = 675;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = selectedColor;
      }
    }
  }, [activeTab, selectedColor]);
  
  useEffect(() => {
    if (activeTab !== TAB_DRAW && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [activeTab]);

  // Handle resizer drag
  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      // Find the active split container (works for both IDE and TEXT tabs)
      const container = splitContainerRef.current;
      if (!container || !resizeStartRef.current) return;
      
      const containerRect = container.getBoundingClientRect();
      const totalWidth = containerRect.width;
      
      // Calculate delta from start position
      const deltaX = e.clientX - resizeStartRef.current.x;
      const deltaPercent = (deltaX / totalWidth) * 100;
      
      // Calculate new width based on initial width + delta
      const newLeftWidth = resizeStartRef.current.leftWidth + deltaPercent;
      
      // Constrain between 15% and 60% for left panel (more flexible)
      const constrainedWidth = Math.max(15, Math.min(60, newLeftWidth));
      setLeftPanelWidth(constrainedWidth);
      
      // Update Monaco editor layout during resize (only for IDE tab)
      if (monacoEditorRef.current && activeTab === TAB_IDE) {
        requestAnimationFrame(() => {
          monacoEditorRef.current?.layout();
        });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
      // Final layout update after resize completes
      if (monacoEditorRef.current && activeTab === TAB_IDE) {
        setTimeout(() => {
          monacoEditorRef.current?.layout();
        }, 50);
      }
    };

    // Prevent text selection while resizing
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, activeTab]);

  // Update Monaco editor layout when panel width changes
  useEffect(() => {
    if (monacoEditorRef.current && activeTab === TAB_IDE && !isResizing) {
      const timeoutId = setTimeout(() => {
        monacoEditorRef.current?.layout();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [leftPanelWidth, activeTab, isResizing]);

  // Update Monaco editor layout when output appears/disappears
  useEffect(() => {
    if (monacoEditorRef.current && activeTab === TAB_IDE) {
      const timeoutId = setTimeout(() => {
        monacoEditorRef.current?.layout();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [outputLog.length, activeTab]);

  return (
    <div className="game-bg w-full" style={{ minHeight: '100vh', padding: '1rem 0.5rem 4rem', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="mb-4 flex flex-col items-center" style={{ flexShrink: 0 }}>
        <div className="game-paper px-10 py-4 game-shadow-hard-lg mb-3">
          <h1 className="game-title text-3xl sm:text-4xl">TECHNICAL PRACTICAL</h1>
        </div>
        <div className="game-label-text text-center text-base">
          Complete the practical question using your preferred mode
        </div>
      </div>

      {/* TABS */}
      <nav className={`${styles.tabs} flex justify-center gap-2 mb-4`} role="tablist" style={{ flexShrink: 0 }}>
        {TAB_OPTIONS.map(tab => (
          <button
            key={tab}
            type="button"
            className={
              `${styles.tab} px-4 py-2 rounded-t-lg font-bold text-sm uppercase tracking-wide shadow-md transition-all duration-150 ` +
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

      {/* Split Panel Layout - Only for IDE tab */}
      {activeTab === TAB_IDE ? (
        <div className={styles.tabpanel} style={{display:'flex', flexDirection:'row', width:'100%', flex: '1 1 auto', minHeight: 0, height: 'calc(100vh - 180px)'}}>
          <div 
            ref={splitContainerRef}
            className={styles.splitContainer}
            style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', width: '100%', height: '100%' }}
          >
          {/* Left Panel - Question */}
          <div 
            className={styles.questionPanel}
            style={{ 
              flex: `0 0 ${leftPanelWidth}%`,
              minWidth: '200px',
              maxWidth: 'none',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              transition: isResizing ? 'none' : 'flex-basis 0.1s ease-out'
            }}
          >
            <div className={styles.questionContent}>
              <div className="game-paper px-6 py-5 game-shadow-hard-lg" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div className={styles.questionLabel} style={{ flexShrink: 0 }}>QUESTION</div>
                <div 
                  className="font-bold text-gray-800 whitespace-pre-wrap"
                  style={{ 
                    flex: '1 1 auto',
                    overflowY: 'auto',
                    paddingRight: '0.5rem',
                    lineHeight: '1.7',
                    minHeight: 0
                  }}
                >
                  {question}
                </div>
              </div>
            </div>
          </div>

          {/* Resizer */}
          <div
            ref={resizerRef}
            className={styles.resizer}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const container = splitContainerRef.current;
              if (container) {
                resizeStartRef.current = {
                  x: e.clientX,
                  leftWidth: leftPanelWidth
                };
              }
              setIsResizing(true);
            }}
            style={{
              flex: '0 0 8px',
              cursor: 'col-resize',
              backgroundColor: isResizing ? '#999' : '#ddd',
              position: 'relative',
              zIndex: 10,
              userSelect: 'none',
              transition: isResizing ? 'none' : 'background-color 0.2s'
            }}
          >
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '4px',
              height: '60px',
              backgroundColor: isResizing ? '#666' : '#999',
              borderRadius: '2px',
              pointerEvents: 'none',
              transition: isResizing ? 'none' : 'background-color 0.2s'
            }} />
          </div>

          {/* Right Panel - Editor */}
          <div 
            className={styles.editorPanel}
            style={{ 
              flex: '1 1 auto',
              minWidth: '300px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              transition: isResizing ? 'none' : 'flex-basis 0.1s ease-out'
            }}
          >
            <div className={styles.tabpanel} style={{display:'flex', flexDirection:'row', width:'100%', flex: '1 1 auto', minHeight: 0, height: 'calc(100vh - 180px)'}}>
              {/* -- Minimal file sidebar, only in IDE tab -- */}
              <aside style={{minWidth:120, maxWidth:220, flexShrink:0, background:'#f5f5f5', borderRight:'2px solid #ddd', padding:'1rem 0.5rem', display:'flex', flexDirection:'column', alignItems:'stretch', gap:2}}>
                <div style={{marginBottom:5, fontWeight:700, fontSize:'1.08em'}}>Files</div>
                <ul style={{listStyle:'none',padding:0, margin:0, flex:1}}>
                  {files.map((f, idx) => (
                    <li key={f.name}>
                      <button 
                        type="button"
                        style={{
                          display:'flex', alignItems:'center', width:'100%', fontWeight:idx===currentFileIdx?700:400, background:idx===currentFileIdx?'#ffe838':'transparent',
                          color:'#222', border:'none', borderRadius:5, marginBottom:2, cursor:'pointer', padding:'0.23em 0.4em'}}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCurrentFileIdx(idx);
                        }}
                      >{f.name}
                        {files.length > 1 ? (
                          <span onClick={e => { e.stopPropagation(); handleRemoveFile(idx);}} style={{marginLeft:'auto',color:'#aa2020',paddingLeft:6, fontWeight:900,cursor:'pointer'}}>×</span>) : null}
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={handleAddFile} style={{marginTop:10, width:'100%', background:'#e3e3e9',border:'1px solid #bbb', borderRadius:5, cursor:'pointer', padding:'0.3em 0'}}>+ File</button>
                {showFileModal && (
              <div style={{position:'fixed',left:0,top:0,width:'100vw',height:'100vh',background:'rgba(32,32,32,0.22)',zIndex:40,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={handleFileModalCancel}>
                <form onSubmit={handleFileModalSubmit} style={{background:'#fff', minWidth:270, borderRadius:10, boxShadow:'0 8px 32px #0003', padding:'2rem 1.6rem', zIndex:50, display:'flex',flexDirection:'column', gap:14}} onClick={e => e.stopPropagation()}>
                  <label htmlFor="newfileinput" style={{fontWeight:700, fontSize:'1.11em', marginBottom:4}}>New File Name</label>
                  <input
                    ref={fileInputRef}
                    id="newfileinput"
                    value={fileInput}
                    onChange={e => setFileInput(e.target.value)}
                    placeholder="e.g. app.py, Dockerfile"
                    autoComplete="off"
                    style={{fontSize:18, border:'2px solid #bbb', borderRadius:5, padding:'0.28em 0.7em', marginBottom:4}}
                    onKeyDown={e => {if (e.key==='Escape'){handleFileModalCancel();}}}
                  />
                  <div style={{display:'flex', gap:12, marginTop:5, justifyContent:'flex-end'}}>
                    <button type="button" onClick={handleFileModalCancel} style={{fontWeight:600, color:'#666',background:'#efefef',border:'1px solid #bbb',borderRadius:4, padding:'0.25em 0.95em'}}>Cancel</button>
                    <button type="submit" style={{fontWeight:700, background:'#ffe838',color:'#271',borderRadius:4, border:'none', padding:'0.25em 1.4em'}}>Create</button>
                  </div>
                </form>
              </div>
            )}
            {showDeleteFileIdx !== null && (
              <div style={{position:'fixed',left:0,top:0,width:'100vw',height:'100vh',background:'rgba(32,32,32,0.23)',zIndex:41,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={handleCancelDeleteFile}>
                <div style={{background:'#fff', minWidth:290, borderRadius:10, boxShadow:'0 8px 32px #0004', padding:'2rem 1.5rem', zIndex:50, display:'flex',flexDirection:'column', gap:18}} onClick={e => e.stopPropagation()}>
                  <div style={{fontWeight:700, fontSize:'1.08em',marginBottom:3}}>Delete file '{files[showDeleteFileIdx].name}'?</div>
                  <div style={{display:'flex', gap:12, marginTop:6, justifyContent:'flex-end'}}>
                    <button type="button" onClick={handleCancelDeleteFile} style={{fontWeight:600, color:'#666',background:'#efefef',border:'1px solid #bbb',borderRadius:4, padding:'0.23em 0.92em'}}>Cancel</button>
                    <button type="button" style={{fontWeight:700, background:'#e23d3d',color:'#fff',borderRadius:4, border:'none', padding:'0.23em 1.32em'}} onClick={handleConfirmDeleteFile}>Delete</button>
                  </div>
                </div>
              </div>
                )}
              </aside>
            <div className="px-4 py-2" style={{flex:1, minWidth:0, width:'auto', display:'flex', flexDirection:'column', minHeight:0}}>
              {/* LANG DROPDOWN RESTORED */}
              <div className="mb-2 flex items-center gap-2" style={{ flexShrink: 0 }}>
              <label className="font-bold text-gray-700">Code Editor:</label>
              <select
                className="game-sharp px-3 py-1 border-2 border-gray-600 bg-white rounded text-base font-bold"
                style={{ minWidth: 120 }}
                value={files[currentFileIdx].language}
                onChange={e => handleChangeLanguage(e.target.value)}
                aria-label="Choose editor language"
              >
                {SUPPORTED_LANGS.map(lang => (
                  <option value={lang.value} key={lang.value}>{lang.label}</option>
                ))}
              </select>
            </div>
            <div style={{flexShrink:0}}>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap'}}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={async (e)=>{
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.nativeEvent) {
                      e.nativeEvent.stopImmediatePropagation();
                    }
                    const language = files[currentFileIdx].language;
                    const code = files[currentFileIdx].code;
                    setOutputLog(['Running...']);
                    
                    if (language === 'javascript') {
                      // Run JS locally in browser
                      let logs: string[] = [];
                      let error: string | null = null;
                      const originalLog = window.console.log;
                      try {
                        (window as any).console.log = (...args:any[]) => {logs.push(args.map(a=>typeof a==='object'?JSON.stringify(a):String(a)).join(' '));};
                        // eslint-disable-next-line no-new-func
                        new Function(code)();
                      } catch(e) {
                        error = (e as Error).message;
                      } finally {
                        (window as any).console.log = originalLog;
                      }
                      const jsOutput = logs.filter(log => log.trim() !== '');
                      if (error) {
                        jsOutput.push(`[Error] ${error}`);
                      }
                      setOutputLog(jsOutput);
                    } else {
                      // Run Python/Java via backend
                      try {
                        const url = `${API_URL}/api/run`;
                        console.log(`[Code Runner] Sending request to: ${url}`, { language, codeLength: code.length });
                        
                        const response = await fetch(url, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ language, code }),
                        });
                        
                        if (!response.ok) {
                          const errorText = await response.text();
                          console.error(`[Code Runner] HTTP error: ${response.status}`, errorText);
                          setOutputLog([`[HTTP Error ${response.status}] ${errorText || response.statusText}`]);
                          return;
                        }
                        
                        const result = await response.json();
                        console.log('[Code Runner] Response:', result);
                        
                        let output: string[] = [];
                        if (result.stdout) {
                          // Trim trailing whitespace and split by lines, filter out empty lines
                          const stdoutLines = result.stdout.trim().split('\n').filter((line: string) => line.trim() !== '');
                          output.push(...stdoutLines);
                        }
                        if (result.stderr) {
                          output.push(`[Error] ${result.stderr.trim()}`);
                        }
                        if (result.error && !result.stderr) {
                          output.push(`[Error] ${result.error}`);
                        }
                        if (result.execution_time) {
                          output.push(`[Execution time: ${result.execution_time.toFixed(2)}s]`);
                        }
                        if (output.length === 0) {
                          output.push(result.success ? '(No output)' : '(Execution failed)');
                        }
                        
                        setOutputLog(output);
                      } catch (e) {
                        console.error('[Code Runner] Network error:', e);
                        const errorMsg = e instanceof Error ? e.message : 'Failed to connect to server';
                        const isNetworkError = errorMsg.includes('fetch') || errorMsg.includes('Failed to fetch');
                        if (isNetworkError) {
                          setOutputLog([
                            `[Network Error] Cannot connect to backend server.`,
                            `\nPlease ensure:`,
                            `1. Backend server is running (python backend/main.py)`,
                            `2. Server is accessible at ${API_URL}`,
                            `3. CORS is properly configured`,
                            `\n[API URL: ${API_URL}/api/run]`
                          ]);
                        } else {
                          setOutputLog([`[Error] ${errorMsg}`]);
                        }
                      }
                    }
                  }}
                  disabled={!EXECUTABLE_LANGS.includes(files[currentFileIdx].language)}
                  title={!EXECUTABLE_LANGS.includes(files[currentFileIdx].language) ? 'Run feature not supported for this language yet' : 'Run code'}
                  style={{
                    fontWeight:700,
                    background: EXECUTABLE_LANGS.includes(files[currentFileIdx].language) ? '#406cd7' : '#cccccc',
                    color: EXECUTABLE_LANGS.includes(files[currentFileIdx].language) ? '#fff' : '#888888',
                    padding:'0.29em 1.4em',
                    borderRadius:5,
                    border:'none',
                    fontSize:'1em',
                    cursor: EXECUTABLE_LANGS.includes(files[currentFileIdx].language) ? 'pointer' : 'not-allowed',
                    opacity: EXECUTABLE_LANGS.includes(files[currentFileIdx].language) ? 1 : 0.6
                  }}
                >Run</button>
                <button
                  type="button"
                  onClick={()=>setShowClearModal(true)}
                  style={{fontWeight:600,background:'#f8f8ff',color:'#cc3400',padding:'0.29em 1.08em',borderRadius:5,border:'1px solid #e0e0e0',fontSize:'1em',cursor:'pointer'}}
                >Reset</button>
                <button
                  type="button"
                  onClick={async()=>{
                    try {
                      await navigator.clipboard.writeText(files[currentFileIdx].code);
                      setCopySuccess(true); setTimeout(()=>setCopySuccess(false),1650);
                    } catch{}
                  }}
                  style={{
                    fontWeight:600,
                    background: copySuccess ? '#27c379' : '#f8f8ff',
                    color: copySuccess ? '#fff' : '#205568',
                    padding:'0.29em 1.08em',
                    borderRadius:5,
                    border:'1px solid #e0e0e0',
                    fontSize:'1em',
                    cursor:'pointer',
                    transition: 'background 0.2s, color 0.2s'
                  }}
                >{copySuccess ? 'Copied!' : 'Copy'}</button>
                <button
                  type="button"
                  onClick={()=>{
                    const blob = new Blob([files[currentFileIdx].code], {type: 'text/plain'});
                    const link = document.createElement('a');
                    link.download = files[currentFileIdx].name;
                    link.href = URL.createObjectURL(blob);
                    document.body.appendChild(link); link.click(); link.remove();
                  }}
                  style={{fontWeight:600,background:'#f8f8ff',color:'#205568',padding:'0.29em 1.08em',borderRadius:5,border:'1px solid #e0e0e0',fontSize:'1em',cursor:'pointer'}}
                >Download</button>
              </div>
            </div>
            <div style={{width:'100%', minWidth:0, flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0}}>
              <div className={styles.editorWrapper} style={{flex: outputLog.length > 0 ? '0 1 auto' : '1 1 auto'}}>
                <div
                  id="code-editor"
                  ref={editorContainerRef}
                  className={styles.editorContainer}
                />
              </div>
              {outputLog.length > 0 && (
                <div className={styles.outputSection}>
                  <div style={{fontWeight:600,letterSpacing:'.025em',fontSize:'1.5em',color:'#ffe838',marginBottom:2}}>Output</div>
                  <div style={{overflowX:'auto', wordBreak:'break-all', fontSize:'1.5em', lineHeight:'1.4', whiteSpace:'pre-wrap'}}>{outputLog.join('\n')}</div>
                  <button type="button" onClick={()=>setOutputLog([])} style={{position:'absolute',top:8,right:15,fontSize:'1.2em',background:'none',border:'none',color:'#ffe838',cursor:'pointer'}}>Clear Output</button>
                </div>
              )}
            </div>
          </div>
            </div>
          </div>
        </div>
        </div>
      ) : (
        <div className={styles.tabpanel} style={{display:'flex', flexDirection:'row', width:'100%', flex: '1 1 auto', minHeight: 0, height: 'calc(100vh - 180px)'}}>
          {activeTab === TAB_TEXT && (
            <div 
              ref={splitContainerRef}
              className={styles.splitContainer}
              style={{ 
                display: 'flex', 
                flexDirection: 'row', 
                width: '100%', 
                height: '100%',
                flex: '1 1 auto',
                minHeight: 0
              }}
            >
              {/* Left Panel - Question */}
              <div 
                className={styles.questionPanel}
                style={{ 
                  flex: `0 0 ${leftPanelWidth}%`,
                  minWidth: '200px',
                  maxWidth: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transition: isResizing ? 'none' : 'flex-basis 0.1s ease-out'
                }}
              >
                <div className={styles.questionContent}>
                  <div className="game-paper px-6 py-5 game-shadow-hard-lg" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div className={styles.questionLabel} style={{ flexShrink: 0 }}>QUESTION</div>
                    <div 
                      className="font-bold text-gray-800 whitespace-pre-wrap"
                      style={{ 
                        flex: '1 1 auto',
                        overflowY: 'auto',
                        paddingRight: '0.5rem',
                        lineHeight: '1.7',
                        minHeight: 0
                      }}
                    >
                      {question}
                    </div>
                  </div>
                </div>
              </div>

              {/* Resizer */}
              <div
                ref={resizerRef}
                className={styles.resizer}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const container = splitContainerRef.current;
                  if (container) {
                    resizeStartRef.current = {
                      x: e.clientX,
                      leftWidth: leftPanelWidth
                    };
                  }
                  setIsResizing(true);
                }}
                style={{
                  flex: '0 0 8px',
                  cursor: 'col-resize',
                  backgroundColor: isResizing ? '#999' : '#ddd',
                  position: 'relative',
                  zIndex: 10,
                  userSelect: 'none',
                  transition: isResizing ? 'none' : 'background-color 0.2s'
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '4px',
                  height: '60px',
                  backgroundColor: isResizing ? '#666' : '#999',
                  borderRadius: '2px',
                  pointerEvents: 'none',
                  transition: isResizing ? 'none' : 'background-color 0.2s'
                }} />
              </div>

              {/* Right Panel - Text Editor */}
              <div 
                className={styles.editorPanel}
                style={{ 
                  flex: '1 1 auto',
                  minWidth: '300px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transition: isResizing ? 'none' : 'flex-basis 0.1s ease-out'
                }}
              >
                <div className="px-4 py-2" style={{flex:1, minWidth:0, width:'auto', display:'flex', flexDirection:'column', minHeight:0}}>
                  <label className="block font-bold mb-2 text-gray-700" style={{ flexShrink: 0 }}>Text Answer:</label>
                  <textarea
                    className={`${styles.textarea} w-full border-4 border-gray-900 rounded-none p-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-600 game-shadow-hard`}
                    style={{
                      flex: '1 1 auto',
                      minHeight: 0,
                      resize: 'none'
                    }}
                    value={textValue}
                    onChange={e => setTextValue(e.target.value)}
                    placeholder="Type your explanation, reasoning, or answer here..."
                    spellCheck={true}
                  />
                </div>
              </div>
            </div>
          )}
        {activeTab === TAB_DRAW && (
          <div 
            ref={splitContainerRef}
            className={styles.splitContainer}
            style={{ 
              display: 'flex', 
              flexDirection: 'row', 
              width: '100%', 
              height: '100%',
              flex: '1 1 auto',
              minHeight: 0
            }}
          >
            {/* Left Panel - Question */}
            <div 
              className={styles.questionPanel}
              style={{ 
                flex: `0 0 ${leftPanelWidth}%`,
                minWidth: '200px',
                maxWidth: 'none',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: isResizing ? 'none' : 'flex-basis 0.1s ease-out'
              }}
            >
              <div className={styles.questionContent}>
                <div className="game-paper px-6 py-5 game-shadow-hard-lg" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div className={styles.questionLabel} style={{ flexShrink: 0 }}>QUESTION</div>
                  <div 
                    className="font-bold text-gray-800 whitespace-pre-wrap"
                    style={{ 
                      flex: '1 1 auto',
                      overflowY: 'auto',
                      paddingRight: '0.5rem',
                      lineHeight: '1.7',
                      minHeight: 0
                    }}
                  >
                    {question}
                  </div>
                </div>
              </div>
            </div>

            {/* Resizer */}
            <div
              ref={resizerRef}
              className={styles.resizer}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const container = splitContainerRef.current;
                if (container) {
                  resizeStartRef.current = {
                    x: e.clientX,
                    leftWidth: leftPanelWidth
                  };
                }
                setIsResizing(true);
              }}
              style={{
                flex: '0 0 8px',
                cursor: 'col-resize',
                backgroundColor: isResizing ? '#999' : '#ddd',
                position: 'relative',
                zIndex: 10,
                userSelect: 'none',
                transition: isResizing ? 'none' : 'background-color 0.2s'
              }}
            >
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '4px',
                height: '60px',
                backgroundColor: isResizing ? '#666' : '#999',
                borderRadius: '2px',
                pointerEvents: 'none',
                transition: isResizing ? 'none' : 'background-color 0.2s'
              }} />
            </div>

            {/* Right Panel - Drawing Canvas */}
            <div 
              className={styles.editorPanel}
              style={{ 
                flex: '1 1 auto',
                minWidth: '300px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: isResizing ? 'none' : 'flex-basis 0.1s ease-out'
              }}
            >
              <div style={{flex:1, minWidth:0, width:'auto', display:'flex', flexDirection:'column', minHeight:0, padding: '1rem'}}>
                {/* Toolbar: Color Picker, Eraser, and Clear */}
                <div style={{ flexShrink: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  {/* Color Picker */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <label className="block font-bold text-gray-700" style={{ fontSize: '1rem' }}>Colour:</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {DRAWING_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => {
                            setSelectedColor(color);
                            setIsEraserMode(false); // Disable eraser when selecting a color
                          }}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: color,
                            border: (selectedColor === color && !isEraserMode) ? '3px solid #222' : '2px solid #ccc',
                            cursor: 'pointer',
                            boxShadow: (selectedColor === color && !isEraserMode) ? '0 2px 8px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.2)',
                            transition: 'all 0.2s',
                            padding: 0,
                            outline: 'none',
                            opacity: isEraserMode ? 0.5 : 1
                          }}
                          onMouseEnter={(e) => {
                            if (!isEraserMode && selectedColor !== color) {
                              e.currentTarget.style.transform = 'scale(1.1)';
                              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isEraserMode && selectedColor !== color) {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
                            }
                          }}
                          aria-label={`Select colour ${color}`}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Eraser Button */}
                  <button
                    type="button"
                    onClick={() => setIsEraserMode(!isEraserMode)}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      background: isEraserMode ? '#ffe838' : '#f5f5f5',
                      color: isEraserMode ? '#222' : '#666',
                      border: isEraserMode ? '3px solid #222' : '2px solid #ccc',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      boxShadow: isEraserMode ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.1)',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (!isEraserMode) {
                        e.currentTarget.style.background = '#e8e8e8';
                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isEraserMode) {
                        e.currentTarget.style.background = '#f5f5f5';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                      }
                    }}
                    aria-label="Toggle eraser"
                  >
                    Eraser
                  </button>
                  
                  {/* Clear Button */}
                  <button
                    type="button"
                    onClick={handleClearCanvas}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      background: '#fff',
                      color: '#cc3300',
                      border: '2px solid #cc3300',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#ffe8e8';
                      e.currentTarget.style.boxShadow = '0 2px 6px rgba(204,51,0,0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#fff';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                    }}
                    aria-label="Clear drawing"
                  >
                    🗑️ Clear
                  </button>
                </div>
                
                {/* Canvas Container */}
                <div 
                  ref={canvasContainerRef}
                  style={{
                    flex: '1 1 auto',
                    minHeight: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    overflow: 'hidden',
                    width: '100%',
                    position: 'relative'
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    className={styles.drawcanvas}
                    width={1200}
                    height={675}
                    style={{ 
                      border: '4px solid #222', 
                      background: '#fff', 
                      borderRadius: 8, 
                      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                      maxWidth: '100%',
                      maxHeight: '100%',
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      cursor: isEraserMode ? 'none' : 'crosshair'
                    }}
                  />
                  {/* Eraser cursor overlay */}
                  {isEraserMode && (
                    <canvas
                      ref={cursorOverlayRef}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        zIndex: 10
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      )}

      <div className="flex justify-center mt-4" style={{ flexShrink: 0 }}>
        <button
          type="button"
          className="game-sharp game-block-blue px-12 py-4 text-lg font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover"
          style={{ border: '6px solid var(--game-text-primary)', color: 'var(--game-text-white)' }}
        >
          Submit Answer
        </button>
      </div>

      {/* Modals for file create, delete, and reset must remain in parent div! */}
      {showFileModal && (
        <div style={{position:'fixed',left:0,top:0,width:'100vw',height:'100vh',background:'rgba(32,32,32,0.22)',zIndex:40,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={handleFileModalCancel}>
          <form onSubmit={handleFileModalSubmit} style={{background:'#fff', minWidth:270, borderRadius:10, boxShadow:'0 8px 32px #0003', padding:'2rem 1.6rem', zIndex:50, display:'flex',flexDirection:'column', gap:14}} onClick={e => e.stopPropagation()}>
            <label htmlFor="newfileinput" style={{fontWeight:700, fontSize:'1.11em', marginBottom:4}}>New File Name</label>
            <input
              ref={fileInputRef}
              id="newfileinput"
              value={fileInput}
              onChange={e => setFileInput(e.target.value)}
              placeholder="e.g. app.py, Dockerfile"
              autoComplete="off"
              style={{fontSize:18, border:'2px solid #bbb', borderRadius:5, padding:'0.28em 0.7em', marginBottom:4}}
              onKeyDown={e => {if (e.key==='Escape'){handleFileModalCancel();}}}
            />
            <div style={{display:'flex', gap:12, marginTop:5, justifyContent:'flex-end'}}>
              <button type="button" onClick={handleFileModalCancel} style={{fontWeight:600, color:'#666',background:'#efefef',border:'1px solid #bbb',borderRadius:4, padding:'0.25em 0.95em'}}>Cancel</button>
              <button type="submit" style={{fontWeight:700, background:'#ffe838',color:'#271',borderRadius:4, border:'none', padding:'0.25em 1.4em'}}>Create</button>
            </div>
          </form>
        </div>
      )}
      {showDeleteFileIdx !== null && (
        <div style={{position:'fixed',left:0,top:0,width:'100vw',height:'100vh',background:'rgba(32,32,32,0.23)',zIndex:41,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={handleCancelDeleteFile}>
          <div style={{background:'#fff', minWidth:290, borderRadius:10, boxShadow:'0 8px 32px #0004', padding:'2rem 1.5rem', zIndex:50, display:'flex',flexDirection:'column', gap:18}} onClick={e => e.stopPropagation()}>
            <div style={{fontWeight:700, fontSize:'1.08em',marginBottom:3}}>Delete file '{files[showDeleteFileIdx].name}'?</div>
            <div style={{display:'flex', gap:12, marginTop:6, justifyContent:'flex-end'}}>
              <button type="button" onClick={handleCancelDeleteFile} style={{fontWeight:600, color:'#666',background:'#efefef',border:'1px solid #bbb',borderRadius:4, padding:'0.23em 0.92em'}}>Cancel</button>
              <button type="button" style={{fontWeight:700, background:'#e23d3d',color:'#fff',borderRadius:4, border:'none', padding:'0.23em 1.32em'}} onClick={handleConfirmDeleteFile}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {showClearModal && (
        <div style={{position:'fixed',left:0,top:0,width:'100vw',height:'100vh',background:'rgba(32,32,32,0.22)',zIndex:42,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowClearModal(false)}>
          <div style={{background:'#fff',minWidth:280,borderRadius:10,boxShadow:'0 8px 32px #0003',padding:'2rem 1.4rem',zIndex:50,display:'flex',flexDirection:'column',gap:14}} onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:700,fontSize:'1.08em'}}>Reset code in '{files[currentFileIdx].name}'?</div>
            <div style={{display:'flex',gap:12,marginTop:5,justifyContent:'flex-end'}}>
              <button type="button" onClick={()=>setShowClearModal(false)} style={{fontWeight:600,color:'#666',background:'#efefef',border:'1px solid #bbb',borderRadius:4,padding:'0.23em 0.92em'}}>Cancel</button>
              <button type="button" style={{fontWeight:700,background:'#ffe838',color:'#cc3300',borderRadius:4,border:'none',padding:'0.23em 1.36em'}}
                onClick={()=> {
                  setFiles(f=>{const arr=[...f];arr[currentFileIdx]={...arr[currentFileIdx],code:''};return arr;});
                  setShowClearModal(false);
                  if(monacoEditorRef.current) monacoEditorRef.current.setValue('');
                }}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicalPractical;


