import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { SettingsManager } from '@/services/SettingsManager';
import { getApiBaseAsync } from '@/services/api';

interface EditorPanelProps {
  projectName: string;
  filePath: string | null;
  onContentChange?: (path: string, content: string, isDirty: boolean) => void;
  onSave?: (path: string, content: string) => void;
  onCursorPositionChange?: (line: number, column: number) => void;
  onEditorMount?: (editor: any) => void;
  theme?: string;
}

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'py': 'python',
    'css': 'css',
    'html': 'html',
    'json': 'json',
    'md': 'markdown',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'sql': 'sql',
    'sh': 'shell',
    'bash': 'shell'
  };

  return languageMap[ext || ''] || 'plaintext';
}

function handleBeforeMount(monaco: any) {
  monaco.editor.defineTheme('cubos-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'cccccc', fontStyle: 'bold' },
      { token: 'keyword.operator', foreground: 'bbbbbb' },
      { token: 'type', foreground: 'bbbbbb' },
      { token: 'type.identifier', foreground: 'bbbbbb' },
      { token: 'entity.name.function', foreground: 'eeeeee' },
      { token: 'entity.name.type', foreground: 'bbbbbb' },
      { token: 'variable', foreground: 'cccccc' },
      { token: 'variable.parameter', foreground: 'aaaaaa' },
      { token: 'string', foreground: '999999' },
      { token: 'string.escape', foreground: '888888' },
      { token: 'number', foreground: 'aaaaaa' },
      { token: 'comment', foreground: '666666', fontStyle: 'italic' },
      { token: 'identifier', foreground: 'cccccc' },
      { token: 'delimiter', foreground: '888888' },
      { token: 'tag', foreground: 'bbbbbb' },
      { token: 'attribute.name', foreground: 'aaaaaa' },
      { token: 'attribute.value', foreground: '999999' },
      { token: '', foreground: 'cccccc', background: '1e1e1e' },
    ],
    colors: {
      'editor.background': '#1e1e1e',
      'editor.foreground': '#cccccc',
      'editor.selectionBackground': '#444444',
      'editor.inactiveSelectionBackground': '#3a3a3a',
      'editor.lineHighlightBackground': '#282828',
      'editor.lineHighlightBorder': '#282828',
      'editorCursor.foreground': '#ffffff',
      'editorCursor.background': '#1e1e1e',
      'editorWhitespace.foreground': '#333333',
      'editorIndentGuide.background': '#333333',
      'editorIndentGuide.activeBackground': '#555555',
      'editorRuler.foreground': '#333333',
      'editor.selectionHighlightBackground': '#3a3a3a',
      'editor.wordHighlightBackground': '#3a3a3a',
      'editor.wordHighlightStrongBackground': '#444444',
      'editor.findMatchBackground': '#555555',
      'editor.findMatchHighlightBackground': '#444444',
      'editorBracketMatch.background': '#3a3a3a',
      'editorBracketMatch.border': '#666666',
      'editorLink.activeForeground': '#aaaaaa',
      'editorWidget.background': '#252526',
      'editorWidget.border': '#444444',
      'editorWidget.resizeBorder': '#555555',
      'editorSuggestWidget.background': '#252526',
      'editorSuggestWidget.border': '#444444',
      'editorSuggestWidget.selectedBackground': '#3a3a3a',
      'editorSuggestWidget.highlightForeground': '#ffffff',
      'editorSuggestWidget.focusHighlightForeground': '#ffffff',
      'editorHoverWidget.background': '#252526',
      'editorHoverWidget.border': '#444444',
      'editorHoverWidget.foreground': '#cccccc',
      'editorInfo.foreground': '#888888',
      'editorWarning.foreground': '#ccaa00',
      'editorError.foreground': '#cc4444',
      'editorGutter.background': '#1e1e1e',
      'editorGutter.commentRangeForeground': '#555555',
      'editorLineNumber.foreground': '#555555',
      'editorLineNumber.activeForeground': '#999999',
      'editorOverviewRuler.border': '#333333',
      'editorOverviewRuler.findMatchForeground': '#666666',
      'editorOverviewRuler.rangeHighlightForeground': '#666666',
      'editorOverviewRuler.selectionHighlightForeground': '#888888',
      'editorOverviewRuler.wordHighlightForeground': '#666666',
      'editorOverviewRuler.wordHighlightStrongForeground': '#888888',
      'editorOverviewRuler.errorForeground': '#cc4444',
      'editorOverviewRuler.warningForeground': '#ccaa00',
      'scrollbar.shadow': '#000000',
      'scrollbarSlider.activeBackground': '#888888aa',
      'scrollbarSlider.background': '#44444488',
      'scrollbarSlider.hoverBackground': '#666666aa',
      'peekViewEditor.background': '#1e1e1e',
      'peekViewEditorGutter.background': '#252526',
      'peekViewResult.background': '#252526',
      'peekViewResult.selectionBackground': '#3a3a3a',
      'peekViewTitle.background': '#2d2d2d',
      'peekViewTitleDescription.foreground': '#888888',
      'peekViewTitleLabel.foreground': '#cccccc',
      'focusBorder': '#555555',
      'contrastBorder': '#333333',
    }
  });
}

function getMonacoTheme(theme: string): string {
  if (theme === 'light') return 'vs';
  return 'cubos-dark';
}

export default function EditorPanel({ projectName, filePath, onContentChange, onSave, onCursorPositionChange, onEditorMount, theme }: EditorPanelProps) {
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<any>(null);

  const [fontSize, setFontSize] = useState(SettingsManager.get('editor.fontSize'));
  const [fontFamily, setFontFamily] = useState(SettingsManager.get('editor.fontFamily'));
  const [tabSize, setTabSize] = useState(SettingsManager.get('editor.tabSize'));
  const [wordWrap, setWordWrap] = useState(SettingsManager.get('editor.wordWrap'));
  const [minimap, setMinimap] = useState(SettingsManager.get('editor.minimap'));
  const [lineNumbers, setLineNumbers] = useState(SettingsManager.get('editor.lineNumbers'));

  useEffect(() => {
    const unsubscribe = SettingsManager.onChange((settings) => {
      if (settings['editor.fontSize'] !== undefined) setFontSize(settings['editor.fontSize']);
      if (settings['editor.fontFamily'] !== undefined) setFontFamily(settings['editor.fontFamily']);
      if (settings['editor.tabSize'] !== undefined) setTabSize(settings['editor.tabSize']);
      if (settings['editor.wordWrap'] !== undefined) setWordWrap(settings['editor.wordWrap']);
      if (settings['editor.minimap'] !== undefined) setMinimap(settings['editor.minimap']);
      if (settings['editor.lineNumbers'] !== undefined) setLineNumbers(settings['editor.lineNumbers']);

      if (editorRef.current) {
        editorRef.current.updateOptions({
          fontSize: settings['editor.fontSize'] ?? fontSize,
          fontFamily: settings['editor.fontFamily'] ?? fontFamily,
          tabSize: settings['editor.tabSize'] ?? tabSize,
          wordWrap: settings['editor.wordWrap'] ?? wordWrap,
          minimap: { enabled: settings['editor.minimap'] ?? minimap },
          lineNumbers: (settings['editor.lineNumbers'] ?? lineNumbers) ? 'on' : 'off'
        });
      }
    });

    return () => unsubscribe();
  }, [fontSize, fontFamily, tabSize, wordWrap, minimap, lineNumbers]);

  useEffect(() => {
    if (!filePath) {
      setContent('');
      setOriginalContent('');
      return;
    }

    const loadFile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${await getApiBaseAsync()}/project/${projectName}/file?path=${encodeURIComponent(filePath)}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const fileContent = data.content || '';
        setContent(fileContent);
        setOriginalContent(fileContent);
      } catch (err) {
        console.error('Error loading file:', err);
        setError('Failed to load file');
        setContent('');
        setOriginalContent('');
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();
  }, [projectName, filePath]);

  useEffect(() => {
    const handleSave = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (filePath && content !== originalContent) {
          try {
            const response = await fetch(`${await getApiBaseAsync()}/project/${projectName}/file/overwrite`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: filePath, content })
            });
            if (response.ok) {
              setOriginalContent(content);
              onSave?.(filePath, content);
              console.log(`File saved: ${filePath}`);
            }
          } catch (err) {
            console.error('Error saving file:', err);
          }
        }
      }
    };

    window.addEventListener('keydown', handleSave);
    return () => window.removeEventListener('keydown', handleSave);
  }, [projectName, filePath, content, originalContent, onSave]);

  const handleEditorChange = (value: string | undefined) => {
    const newContent = value || '';
    setContent(newContent);
    if (filePath) {
      onContentChange?.(filePath, newContent, newContent !== originalContent);
    }
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;

    editor.onDidChangeCursorPosition((e: any) => {
      onCursorPositionChange?.(e.position.lineNumber, e.position.column);
    });

    onEditorMount?.(editor);
  };

  if (!filePath) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#666',
        fontSize: '14px',
        fontFamily: 'Segoe UI, system-ui, sans-serif'
      }}>
        No file selected
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#666',
        fontSize: '14px',
        fontFamily: 'Segoe UI, system-ui, sans-serif'
      }}>
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#f48771',
        fontSize: '14px',
        fontFamily: 'Segoe UI, system-ui, sans-serif'
      }}>
        {error}
      </div>
    );
  }

  return (
    <Editor
      height="100%"
      language={getLanguageFromPath(filePath)}
      value={content}
      onChange={handleEditorChange}
      onMount={handleEditorDidMount}
      beforeMount={handleBeforeMount}
      theme={getMonacoTheme(theme || 'dark')}
      options={{
        fontSize,
        fontFamily,
        minimap: { enabled: minimap },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize,
        insertSpaces: true,
        renderWhitespace: 'selection',
        lineNumbers: lineNumbers ? 'on' : 'off',
        wordWrap
      }}
    />
  );
}
