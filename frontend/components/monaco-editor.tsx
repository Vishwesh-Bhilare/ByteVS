// frontend/components/monaco-editor.tsx
'use client';

import { useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

interface MonacoEditorProps {
  language: string;
  value: string;
  onChange: (value: string) => void;
  theme?: string;
  readOnly?: boolean;
}

export default function MonacoEditor({
  language,
  value,
  onChange,
  theme = 'vs-dark',
  readOnly = false,
}: MonacoEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
    
    // Configure editor options
    editor.updateOptions({
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 14,
      wordWrap: 'on',
      automaticLayout: true,
      padding: { top: 16 },
      readOnly,
    });

    // Add custom keybindings
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      // Save functionality handled by parent
    });
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
      }
    };
  }, []);

  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      theme={theme}
      onChange={(value) => onChange(value || '')}
      onMount={handleEditorDidMount}
      options={{
        readOnly,
        fontFamily: "'Fira Code', 'Courier New', monospace",
        fontLigatures: true,
        tabSize: 2,
      }}
    />
  );
}