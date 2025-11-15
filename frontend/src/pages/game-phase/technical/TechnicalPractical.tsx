import React, { useState, useRef, useEffect } from 'react';
import styles from './TechnicalPractical.module.css';

const TAB_IDE = 'IDE' as const;
const TAB_TEXT = 'TEXT' as const;
const TAB_DRAW = 'DRAW' as const;
type TabType = typeof TAB_IDE | typeof TAB_TEXT | typeof TAB_DRAW;
const TAB_OPTIONS: TabType[] = [TAB_IDE, TAB_TEXT, TAB_DRAW];

const SUPPORTED_LANGS = [
  { value: 'javascript', label: 'JavaScript', ext: ['js', 'javascript'] },
  { value: 'typescript', label: 'TypeScript', ext: ['ts', 'typescript'] },
  { value: 'python', label: 'Python', ext: ['py', 'python'] },
  { value: 'java', label: 'Java', ext: ['java'] },
  { value: 'cpp', label: 'C++', ext: ['cpp', 'cc', 'cxx'] },
  { value: 'c', label: 'C', ext: ['c'] },
  { value: 'shell', label: 'Bash (sh)', ext: ['sh', 'bash'] },
  { value: 'yaml', label: 'YAML', ext: ['yaml', 'yml'] },
  { value: 'sql', label: 'SQL', ext: ['sql'] },
  { value: 'dockerfile', label: 'Dockerfile', ext: ['dockerfile'] },
  { value: 'html', label: 'HTML', ext: ['html', 'htm'] },
  { value: 'css', label: 'CSS', ext: ['css'] },
  { value: 'json', label: 'JSON', ext: ['json'] },
  { value: 'markdown', label: 'Markdown', ext: ['md', 'markdown'] },
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

// Minimal file structure for editor
interface CodeFile {
  name: string;
  code: string;
  language: string;
}

const initialFile: CodeFile = {
  name: 'main.js',
  code: '// Start coding here...\n',
  language: 'javascript',
};

const TechnicalPractical: React.FC = () => {
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
          fontSize: 14,
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
      arr[currentFileIdx] = { ...arr[currentFileIdx], language: lang };
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

  // Draw tab logic (unchanged)
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

      <div className={styles.tabpanel} style={{display:'flex', flexDirection:'row', width:'100%'}}>
        {/* -- Minimal file sidebar, only in IDE tab -- */}
        {activeTab === TAB_IDE && (
          <aside style={{minWidth:120, background:'#f5f5f5', borderRight:'2px solid #ddd', padding:'1rem 0.5rem', display:'flex', flexDirection:'column', alignItems:'stretch', gap:2}}>
            <div style={{marginBottom:5, fontWeight:700, fontSize:'1.08em'}}>Files</div>
            <ul style={{listStyle:'none',padding:0, margin:0, flex:1}}>
              {files.map((f, idx) => (
                <li key={f.name}>
                  <button style={{
                      display:'flex', alignItems:'center', width:'100%', fontWeight:idx===currentFileIdx?700:400, background:idx===currentFileIdx?'#ffe838':'transparent',
                      color:'#222', border:'none', borderRadius:5, marginBottom:2, cursor:'pointer', padding:'0.23em 0.4em'}}
                    onClick={()=>setCurrentFileIdx(idx)}
                  >{f.name}
                    {files.length > 1 ? (
                      <span onClick={e => { e.stopPropagation(); handleRemoveFile(idx);}} style={{marginLeft:'auto',color:'#aa2020',paddingLeft:6, fontWeight:900,cursor:'pointer'}}>×</span>) : null}
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={handleAddFile} style={{marginTop:10, width:'100%', background:'#e3e3e9',border:'1px solid #bbb', borderRadius:5, cursor:'pointer', padding:'0.3em 0'}}>+ File</button>
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
        )}
        {activeTab === TAB_IDE && (
          <div className="px-4 py-2" style={{width:'100%', display:'flex', flexDirection:'column'}}>
            {/* LANG DROPDOWN RESTORED */}
            <div className="mb-2 flex items-center gap-2">
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
            <div style={{flexGrow:0}}>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10}}>
                <button
                  title={files[currentFileIdx].language === 'javascript'? undefined : 'Only JavaScript files can be run in browser.'}
                  disabled={files[currentFileIdx].language !== 'javascript'}
                  onClick={()=>{
                    // Run JS
                    const code = files[currentFileIdx].code;
                    let logs: string[] = [];
                    let error:
string | null = null;
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
                    setOutputLog(logs.concat(error? ["[Error] "+error] : []));
                  }}
                  style={{fontWeight:700,background:'#406cd7',color:'#fff',padding:'0.29em 1.4em',borderRadius:5,border:'none',fontSize:'1em',opacity:files[currentFileIdx].language==='javascript'?1:0.65,cursor:files[currentFileIdx].language==='javascript'?'pointer':'not-allowed'}}
                >Run</button>
                <button
                  onClick={()=>setShowClearModal(true)}
                  style={{fontWeight:600,background:'#f8f8ff',color:'#cc3400',padding:'0.29em 1.08em',borderRadius:5,border:'1px solid #e0e0e0',fontSize:'1em',cursor:'pointer'}}
                >Reset</button>
                <button
                  onClick={async()=>{
                    try {
                      await navigator.clipboard.writeText(files[currentFileIdx].code);
                      setCopySuccess(true); setTimeout(()=>setCopySuccess(false),1650);
                    } catch{}
                  }}
                  style={{fontWeight:600,background:'#f8f8ff',color:'#205568',padding:'0.29em 1.08em',borderRadius:5,border:'1px solid #e0e0e0',fontSize:'1em',cursor:'pointer'}}
                >Copy</button>
                <button
                  onClick={()=>{
                    const blob = new Blob([files[currentFileIdx].code], {type: 'text/plain'});
                    const link = document.createElement('a');
                    link.download = files[currentFileIdx].name;
                    link.href = URL.createObjectURL(blob);
                    document.body.appendChild(link); link.click(); link.remove();
                  }}
                  style={{fontWeight:600,background:'#f8f8ff',color:'#205568',padding:'0.29em 1.08em',borderRadius:5,border:'1px solid #e0e0e0',fontSize:'1em',cursor:'pointer'}}
                >Download</button>
                {copySuccess && <span style={{color:'#27c379',fontWeight:700,marginLeft:7,fontSize:'0.95em'}}>Copied!</span>}
              </div>
            </div>
            <div style={{width:'100%'}}>
              <div style={{width:'100%', height:440, minHeight:220, marginBottom:18}}>
                <div
                  id="code-editor"
                  ref={editorContainerRef}
                  style={{ width: '100%', height: '100%', minHeight:200, border: '3px solid #222', borderRadius: 8, background: '#1e1e20', overflow: 'hidden' }}
                />
              </div>
              <div style={{background:'#111',borderRadius:8,padding:'0.7em 1.02em 0.72em', color:'#d4e2cc', fontFamily:'monospace', fontSize:'1.04em', minHeight:58, maxHeight:160, boxShadow:'0 2px 8px #0002', width:'100%', whiteSpace:'pre-wrap',position:'relative',overflowY:'auto'}}>
                <div style={{fontWeight:600,letterSpacing:'.025em',fontSize:'0.96em',color:'#ffe838',marginBottom:2}}>Output</div>
                <div style={{overflowX:'auto', wordBreak:'break-all'}}>{(outputLog.length > 0)?outputLog.join('\n'):'(No output yet)'}</div>
                <button onClick={()=>setOutputLog([])} style={{position:'absolute',top:8,right:15,fontSize:'0.95em',background:'none',border:'none',color:'#ffe838',cursor:'pointer'}}>Clear Output</button>
              </div>
            </div>
          </div>
        )}
        {activeTab === TAB_TEXT && (
          <div className="px-4 py-2 w-full">
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
        {activeTab === TAB_DRAW && (
          <div className="px-4 py-2 flex flex-col items-center w-full">
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
                  setFiles(f=>{const arr=[...f];arr[currentFileIdx]={...arr[currentFileIdx],code:'\n'};return arr;});
                  setShowClearModal(false);
                  if(monacoEditorRef.current) monacoEditorRef.current.setValue('\n');
                }}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicalPractical;


