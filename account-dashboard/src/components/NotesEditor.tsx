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
  FileText,
  Check,
  Loader2,
} from 'lucide-react';

interface NotesEditorProps {
  content: string;
  lastSaved: string | null;
  onSave: (content: string) => Promise<void>;
  accountId?: string;
}

export function NotesEditor({ content, lastSaved, onSave, accountId }: NotesEditorProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();
  const { height, onResizeStart } = useResizableHeight({
    storageKey: accountId ? `accountNotesHeight_${accountId}` : 'accountNotesHeight_default',
    defaultHeight: 500,
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({
        placeholder: 'Add account notes here... (auto-saves)',
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
        console.error('Failed to save notes:', err);
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

  return (
    <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-dark-700/50">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-dark-200">Account Notes</h2>
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
        </div>
      </div>

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
