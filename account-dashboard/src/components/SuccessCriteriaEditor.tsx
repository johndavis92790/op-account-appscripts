import { useCallback, useRef, useState } from 'react';
import { useResizableHeight } from '../hooks/useResizableHeight';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading2,
  Quote,
  Code,
  Target,
  Check,
  Loader2,
  Maximize2,
  Minimize2,
  X,
  ExternalLink,
} from 'lucide-react';

interface SuccessCriteriaEditorProps {
  content: string;
  lastSaved: string | null;
  onSave: (content: string) => Promise<void>;
  accountName: string;
  accountId?: string;
}

export function SuccessCriteriaEditor({ content, lastSaved, onSave, accountName, accountId }: SuccessCriteriaEditorProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();
  const { height, onResizeStart } = useResizableHeight({
    storageKey: accountId ? `successCriteriaHeight_${accountId}` : 'successCriteriaHeight_default',
    defaultHeight: 500,
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({
        placeholder: 'Define success criteria for this account...',
      }),
    ],
    content: content || '',
    editorProps: {
      attributes: {
        class: 'tiptap',
      },
    },
    onUpdate: ({ editor }) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        handleSave(editor.getHTML());
      }, 1500);
    },
  });

  const handleSave = useCallback(
    async (html: string) => {
      setSaving(true);
      try {
        await onSave(html);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        console.error('Failed to save success criteria:', err);
      } finally {
        setSaving(false);
      }
    },
    [onSave]
  );

  if (!editor) return null;

  const ToolBtn = ({
    onClick,
    active,
    children,
    title,
  }: {
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-accent/20 text-accent'
          : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700'
      }`}
    >
      {children}
    </button>
  );

  const toolbar = (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-dark-700/30 bg-dark-850/50 overflow-x-auto">
      <ToolBtn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold"
      >
        <Bold className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic"
      >
        <Italic className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        title="Underline"
      >
        <UnderlineIcon className="w-3.5 h-3.5" />
      </ToolBtn>
      <div className="w-px h-4 bg-dark-700 mx-1" />
      <ToolBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Heading"
      >
        <Heading2 className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <List className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <ListOrdered className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Quote"
      >
        <Quote className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        title="Code Block"
      >
        <Code className="w-3.5 h-3.5" />
      </ToolBtn>
    </div>
  );

  const header = (isFullscreen: boolean) => (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-dark-700/50">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-blue-400" />
        <h2 className={`font-semibold text-dark-200 ${isFullscreen ? 'text-lg' : 'text-sm'}`}>
          Success Criteria
        </h2>
        {isFullscreen && (
          <span className="text-sm text-dark-400 ml-2">— {accountName}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {saving && (
          <span className="flex items-center gap-1 text-dark-500 text-xs">
            <Loader2 className="w-3 h-3 animate-spin" /> Saving
          </span>
        )}
        {saved && !saving && (
          <span className="flex items-center gap-1 text-emerald-400 text-xs">
            <Check className="w-3 h-3" /> Saved
          </span>
        )}
        {lastSaved && !saving && !saved && (
          <span className="text-dark-500 text-xs hidden sm:block">
            Last saved: {new Date(lastSaved).toLocaleString()}
          </span>
        )}
        {accountId && (
          <button
            onClick={() => window.open(`/account/${accountId}/success-criteria`, '_blank')}
            className="p-1.5 rounded text-dark-400 hover:text-dark-200 hover:bg-dark-700 transition-colors ml-2"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => setFullscreen(!fullscreen)}
          className="p-1.5 rounded text-dark-400 hover:text-dark-200 hover:bg-dark-700 transition-colors"
          title={isFullscreen ? 'Exit fullscreen' : 'Present fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        {isFullscreen && (
          <button
            onClick={() => setFullscreen(false)}
            className="p-1.5 rounded text-dark-400 hover:text-dark-200 hover:bg-dark-700 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  // Fullscreen modal overlay
  if (fullscreen) {
    return (
      <>
        {/* Inline placeholder so the layout doesn't collapse */}
        <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl overflow-hidden">
          {header(false)}
          <div className="px-4 py-6 text-center text-dark-500 text-sm">
            Editing in fullscreen mode...
          </div>
        </div>

        {/* Modal overlay */}
        <div className="fixed inset-0 z-50 bg-dark-950 flex flex-col">
          <div className="bg-dark-800 border-b border-dark-700">
            {header(true)}
            {toolbar}
          </div>
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
            <EditorContent editor={editor} />
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl overflow-hidden">
      {header(false)}
      {toolbar}
      <div className="overflow-y-auto" style={{ maxHeight: height }}>
        <EditorContent editor={editor} />
      </div>
      <div
        onMouseDown={onResizeStart}
        className="h-1.5 cursor-row-resize hover:bg-accent/20 transition-colors flex items-center justify-center group"
        title="Drag to resize"
      >
        <div className="w-8 h-0.5 bg-dark-600 group-hover:bg-accent/40 rounded-full transition-colors" />
      </div>
    </div>
  );
}
