(function(global) {
  let monacoLoaderPromise = null;

  function loadMonaco() {
    if (!monacoLoaderPromise) {
      console.log("[Monaco] Starting Monaco loader...");
      monacoLoaderPromise = new Promise((resolve, reject) => {
        if (typeof window.require === 'undefined') {
          reject(new Error("Monaco loader script not found! Did you add it to <head>?"));
          return;
        }
        window.require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs" } });
        window.require(["vs/editor/editor.main"], () => {
          console.log("[Monaco] Monaco loaded successfully!");
          resolve(window.monaco);
        });
      });
    }
    return monacoLoaderPromise;
  }

  /**
   * Initializes a Monaco Editor instance in a given container
   * @param {string} containerId - The DOM id for the editor's container <div>
   * @param {string} initialCode - Initial code (string)
   * @param {string} language - Language, e.g. 'javascript', 'python', etc.
   * @returns {Promise<monaco.editor.IStandaloneCodeEditor|null>}
   */
  global.initMonacoEditor = function(containerId, initialCode = '', language = 'javascript') {
    return loadMonaco()
      .then(monaco => {
        const container = document.getElementById(containerId);
        if (!container) {
          console.warn(`[Monaco] Container with id "${containerId}" not found.`);
          return null;
        }
        // Dispose existing instance if present
        if (container.__monacoInstance) {
          try { container.__monacoInstance.dispose(); } catch {}
        }
        const editor = monaco.editor.create(container, {
          value: initialCode,
          language: language,
          automaticLayout: true,
          minimap: { enabled: false },
          theme: "vs-dark",
          fontSize: 18,
          roundedSelection: true,
        });
        container.__monacoInstance = editor;
        console.log(`[Monaco] Editor initialized in #${containerId} [lang=${language}]`);
        return editor;
      })
      .catch(e => {
        console.error("[Monaco] Failed to load/init Monaco:", e);
        return null;
      });
  };

  console.log("[Monaco] monaco-setup.js loaded. Use initMonacoEditor(containerId, initialCode, language)");
})(window);
