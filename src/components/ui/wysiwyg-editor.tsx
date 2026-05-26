import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { TextStyle, FontSize, FontFamily } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { useEffect, useMemo } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Link2, Heading1, Heading2, Heading3,
  Undo, Redo, Quote, Minus, Code, Type, Highlighter, Eraser,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Table as TableIcon, Trash2, Rows3, Columns3,
  ArrowUpToLine, ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine,
  Merge, Split, Settings2, EyeOff, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColorPickerPopover } from '@/components/ui/color-picker-popover';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * GLOBALNY EDYTOR WYSIWYG (Tiptap) — używany WSZĘDZIE w aplikacji.
 *
 * REGUŁA: Nie tworzymy własnych edytorów — wszędzie gdzie potrzebne jest
 * formatowanie tekstu (poczta, autokorespondencja, szablony, opisy
 * wydarzeń, regulaminy, itd.) używamy <WysiwygEditor /> z tego pliku.
 *
 * Funkcje:
 *  - nagłówki H1/H2/H3, B / I / U / S / kod
 *  - czcionka (FontFamily) i rozmiar (FontSize)
 *  - kolor tekstu i tła (paleta + hex + EyeDropper)
 *  - wyrównanie (lewo/środek/prawo/justuj)
 *  - listy, cytaty, linia pozioma
 *  - linki (auto https://)
 *  - tabele (wstaw/edytuj, ramka konfigurowalna)
 *  - czyszczenie formatowania, undo/redo
 *  - imperatywne API `onReady({ insertText, editor })` — do wstawiania tokenów/pól
 *  - `toolbarExtras` — dodatkowe kontrolki w toolbarze (np. picker szablonów)
 */

const FONT_FAMILIES = [
  { label: 'Domyślna', value: '' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, sans-serif' },
];

const FONT_SIZES = [
  { label: 'Bardzo mały', value: '10px' },
  { label: 'Mały', value: '13px' },
  { label: 'Normalny', value: '16px' },
  { label: 'Średni', value: '18px' },
  { label: 'Duży', value: '24px' },
  { label: 'Bardzo duży', value: '32px' },
  { label: 'Ogromny', value: '48px' },
];

const toEditorHtml = (input: string) => {
  const text = input || '';
  if (!text || /<\/?[a-z][\s\S]*>/i.test(text)) return text;
  const escapeHtml = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  return text
    .split(/\n{2,}/)
    .map((paragraph) => {
      const lines = paragraph.split(/\n/).map(escapeHtml);
      return lines.some((line) => line.trim())
        ? `<p>${lines.join('<br>')}</p>`
        : '<p><br></p>';
    })
    .join('');
};

export interface WysiwygEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  disabled?: boolean;
  hideHeadings?: boolean;
  onReady?: (api: { insertText: (text: string) => void; editor: Editor }) => void;
  toolbarExtras?: React.ReactNode;
}

export function WysiwygEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = '400px',
  disabled,
  hideHeadings,
  onReady,
  toolbarExtras,
}: WysiwygEditorProps) {
  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: hideHeadings ? false : { levels: [1, 2, 3] },
      link: false,
      underline: false,
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: { class: 'text-primary underline underline-offset-2', target: '_blank', rel: 'noopener noreferrer' },
    }),
    TextStyle,
    FontFamily,
    FontSize,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Table.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          borderWidth: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).getAttribute('data-border-width'),
            renderHTML: (attrs) => {
              if (!attrs.borderWidth) return {};
              return { 'data-border-width': attrs.borderWidth };
            },
          },
          borderColor: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).getAttribute('data-border-color'),
            renderHTML: (attrs) => {
              if (!attrs.borderColor) return {};
              return { 'data-border-color': attrs.borderColor };
            },
          },
          borderHidden: {
            default: false,
            parseHTML: (el) => (el as HTMLElement).getAttribute('data-border-hidden') === 'true',
            renderHTML: (attrs) => {
              if (!attrs.borderHidden) return {};
              return { 'data-border-hidden': 'true' };
            },
          },
          styleAttr: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).getAttribute('style'),
            renderHTML: (attrs) => {
              const parts: string[] = [];
              if (attrs.borderHidden) {
                // styling handled via CSS data attr
              } else if (attrs.borderWidth || attrs.borderColor) {
                const w = attrs.borderWidth || '1px';
                const c = attrs.borderColor || 'currentColor';
                parts.push(`--cell-border: ${w} solid ${c}`);
              }
              return parts.length ? { style: parts.join('; ') } : {};
            },
          },
        };
      },
    }).configure({ resizable: true, HTMLAttributes: { class: 'wysiwyg-table' } }),
    TableRow,
    TableHeader,
    TableCell,
  ], [hideHeadings]);

  const editor = useEditor({
    extensions,
    content: toEditorHtml(value),
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          'wysiwyg-content prose prose-sm max-w-none dark:prose-invert focus:outline-none px-4 py-3 min-h-full w-full',
          'prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg',
          'prose-p:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0',
          'prose-a:text-primary',
        ),
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const normalize = (s: string) => (s || '').trim().replace(/^<p><\/p>$/, '');
    const nextContent = toEditorHtml(value);
    if (normalize(nextContent) !== normalize(current)) {
      editor.commands.setContent(nextContent, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor || !onReady) return;
    onReady({
      insertText: (text: string) => {
        editor.chain().focus().insertContent(text).run();
      },
      editor,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) {
    return <div className={cn('rounded-md border bg-background', className)} style={{ minHeight }} />;
  }

  const ustawLink = () => {
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const raw = window.prompt('Adres URL (puste aby usunąć link):', previousUrl ?? '');
    if (raw === null) return;
    const trimmed = raw.trim();
    if (trimmed === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    let url = trimmed;
    if (!/^([a-z]+:|#|\/)/i.test(url)) url = `https://${url}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const aktualnyFontFamily = (editor.getAttributes('textStyle').fontFamily as string) || '';
  const aktualnyFontSize = (editor.getAttributes('textStyle').fontSize as string) || '';

  return (
    <div className={cn('rounded-md border bg-background overflow-hidden', className)}>
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 px-2 py-1.5">
        <Select
          value={aktualnyFontFamily || '__default__'}
          onValueChange={(v) => {
            if (v === '__default__') editor.chain().focus().unsetFontFamily().run();
            else editor.chain().focus().setFontFamily(v).run();
          }}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Czcionka" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__" className="text-xs">Domyślna</SelectItem>
            {FONT_FAMILIES.filter((f) => f.value).map((f) => (
              <SelectItem key={f.value} value={f.value} className="text-xs">
                <span style={{ fontFamily: f.value }}>{f.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={aktualnyFontSize || '__default__'}
          onValueChange={(v) => {
            if (v === '__default__') editor.chain().focus().unsetFontSize().run();
            else editor.chain().focus().setFontSize(v).run();
          }}
        >
          <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue placeholder="Rozmiar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__" className="text-xs">Normalny</SelectItem>
            {FONT_SIZES.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!hideHeadings && (
          <>
            <div className="mx-1 h-5 w-px bg-border" />
            <Toggle size="sm" pressed={editor.isActive('heading', { level: 1 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} aria-label="Nagłówek 1"><Heading1 className="h-4 w-4" /></Toggle>
            <Toggle size="sm" pressed={editor.isActive('heading', { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} aria-label="Nagłówek 2"><Heading2 className="h-4 w-4" /></Toggle>
            <Toggle size="sm" pressed={editor.isActive('heading', { level: 3 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} aria-label="Nagłówek 3"><Heading3 className="h-4 w-4" /></Toggle>
          </>
        )}
        <div className="mx-1 h-5 w-px bg-border" />
        <Toggle size="sm" pressed={editor.isActive('bold')} onPressedChange={() => editor.chain().focus().toggleBold().run()} aria-label="Pogrubienie"><Bold className="h-4 w-4" /></Toggle>
        <Toggle size="sm" pressed={editor.isActive('italic')} onPressedChange={() => editor.chain().focus().toggleItalic().run()} aria-label="Kursywa"><Italic className="h-4 w-4" /></Toggle>
        <Toggle size="sm" pressed={editor.isActive('underline')} onPressedChange={() => editor.chain().focus().toggleUnderline().run()} aria-label="Podkreślenie"><UnderlineIcon className="h-4 w-4" /></Toggle>
        <Toggle size="sm" pressed={editor.isActive('strike')} onPressedChange={() => editor.chain().focus().toggleStrike().run()} aria-label="Przekreślenie"><Strikethrough className="h-4 w-4" /></Toggle>
        <Toggle size="sm" pressed={editor.isActive('code')} onPressedChange={() => editor.chain().focus().toggleCode().run()} aria-label="Kod"><Code className="h-4 w-4" /></Toggle>
        <div className="mx-1 h-5 w-px bg-border" />
        <ColorPickerPopover
          icon={Type}
          ariaLabel="Kolor tekstu"
          preventMouseDown
          value={(editor.getAttributes('textStyle').color as string) || undefined}
          onChange={(c) => editor.chain().focus().setColor(c).run()}
          onClear={() => editor.chain().focus().unsetColor().run()}
          active={editor.isActive('textStyle', { color: /.+/ } as never)}
        />
        <ColorPickerPopover
          icon={Highlighter}
          ariaLabel="Kolor tła (zakreślacz)"
          preventMouseDown
          value={(editor.getAttributes('highlight').color as string) || undefined}
          onChange={(c) => editor.chain().focus().toggleHighlight({ color: c }).run()}
          onClear={() => editor.chain().focus().unsetHighlight().run()}
          active={editor.isActive('highlight')}
        />
        <div className="mx-1 h-5 w-px bg-border" />
        <Toggle size="sm" pressed={editor.isActive({ textAlign: 'left' })} onPressedChange={() => editor.chain().focus().setTextAlign('left').run()} aria-label="Do lewej"><AlignLeft className="h-4 w-4" /></Toggle>
        <Toggle size="sm" pressed={editor.isActive({ textAlign: 'center' })} onPressedChange={() => editor.chain().focus().setTextAlign('center').run()} aria-label="Wyśrodkuj"><AlignCenter className="h-4 w-4" /></Toggle>
        <Toggle size="sm" pressed={editor.isActive({ textAlign: 'right' })} onPressedChange={() => editor.chain().focus().setTextAlign('right').run()} aria-label="Do prawej"><AlignRight className="h-4 w-4" /></Toggle>
        <Toggle size="sm" pressed={editor.isActive({ textAlign: 'justify' })} onPressedChange={() => editor.chain().focus().setTextAlign('justify').run()} aria-label="Justuj"><AlignJustify className="h-4 w-4" /></Toggle>
        <div className="mx-1 h-5 w-px bg-border" />
        <Toggle size="sm" pressed={editor.isActive('bulletList')} onPressedChange={() => editor.chain().focus().toggleBulletList().run()} aria-label="Lista punktowana"><List className="h-4 w-4" /></Toggle>
        <Toggle size="sm" pressed={editor.isActive('orderedList')} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Lista numerowana"><ListOrdered className="h-4 w-4" /></Toggle>
        <Toggle size="sm" pressed={editor.isActive('blockquote')} onPressedChange={() => editor.chain().focus().toggleBlockquote().run()} aria-label="Cytat"><Quote className="h-4 w-4" /></Toggle>
        <Button type="button" size="sm" variant="ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().setHorizontalRule().run()} aria-label="Linia pozioma" className="h-8 w-8 p-0"><Minus className="h-4 w-4" /></Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Toggle size="sm" pressed={editor.isActive('link')} onPressedChange={ustawLink} aria-label="Link"><Link2 className="h-4 w-4" /></Toggle>
        <Button type="button" size="sm" variant="ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} aria-label="Wyczyść formatowanie" title="Wyczyść formatowanie" className="h-8 w-8 p-0"><Eraser className="h-4 w-4" /></Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant={editor.isActive('table') ? 'secondary' : 'ghost'} onMouseDown={(e) => e.preventDefault()} aria-label="Tabela" title="Tabela" className="h-8 w-8 p-0">
              <TableIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onSelect={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
              <TableIcon className="mr-2 h-4 w-4" /> Wstaw tabelę 3×3
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => {
              const cols = Number(window.prompt('Liczba kolumn:', '3'));
              const rows = Number(window.prompt('Liczba wierszy:', '3'));
              if (cols > 0 && rows > 0) {
                editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
              }
            }}>
              <TableIcon className="mr-2 h-4 w-4" /> Wstaw tabelę…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!editor.can().addRowBefore()} onSelect={() => editor.chain().focus().addRowBefore().run()}>
              <ArrowUpToLine className="mr-2 h-4 w-4" /> Wstaw wiersz powyżej
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!editor.can().addRowAfter()} onSelect={() => editor.chain().focus().addRowAfter().run()}>
              <ArrowDownToLine className="mr-2 h-4 w-4" /> Wstaw wiersz poniżej
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!editor.can().deleteRow()} onSelect={() => editor.chain().focus().deleteRow().run()}>
              <Rows3 className="mr-2 h-4 w-4" /> Usuń wiersz
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!editor.can().addColumnBefore()} onSelect={() => editor.chain().focus().addColumnBefore().run()}>
              <ArrowLeftToLine className="mr-2 h-4 w-4" /> Wstaw kolumnę z lewej
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!editor.can().addColumnAfter()} onSelect={() => editor.chain().focus().addColumnAfter().run()}>
              <ArrowRightToLine className="mr-2 h-4 w-4" /> Wstaw kolumnę z prawej
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!editor.can().deleteColumn()} onSelect={() => editor.chain().focus().deleteColumn().run()}>
              <Columns3 className="mr-2 h-4 w-4" /> Usuń kolumnę
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!editor.can().toggleHeaderRow()} onSelect={() => editor.chain().focus().toggleHeaderRow().run()}>
              Przełącz wiersz nagłówkowy
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!editor.can().toggleHeaderColumn()} onSelect={() => editor.chain().focus().toggleHeaderColumn().run()}>
              Przełącz kolumnę nagłówkową
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!editor.can().mergeCells()} onSelect={() => editor.chain().focus().mergeCells().run()}>
              <Merge className="mr-2 h-4 w-4" /> Scal komórki
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!editor.can().splitCell()} onSelect={() => editor.chain().focus().splitCell().run()}>
              <Split className="mr-2 h-4 w-4" /> Podziel komórkę
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!editor.can().deleteTable()} onSelect={() => editor.chain().focus().deleteTable().run()} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Usuń tabelę
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {editor.isActive('table') && (
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" size="sm" variant="ghost" onMouseDown={(e) => e.preventDefault()} aria-label="Konfiguracja tabeli" title="Konfiguracja ramki tabeli" className="h-8 w-8 p-0">
                <Settings2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 space-y-3" align="start">
              <div className="text-sm font-medium">Ramka tabeli</div>
              {(() => {
                const attrs = editor.getAttributes('table') as { borderWidth?: string; borderColor?: string; borderHidden?: boolean };
                const width = attrs.borderWidth || '1px';
                const color = attrs.borderColor || '#d1d5db';
                const hidden = !!attrs.borderHidden;
                const update = (patch: Record<string, unknown>) => editor.chain().focus().updateAttributes('table', patch).run();
                return (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="tbl-hide" className="text-xs flex items-center gap-2">
                        {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        Ramka niewidoczna
                      </Label>
                      <input
                        id="tbl-hide"
                        type="checkbox"
                        checked={hidden}
                        onChange={(e) => update({ borderHidden: e.target.checked })}
                        className="h-4 w-4 accent-primary"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Grubość</Label>
                      <Select value={width} onValueChange={(v) => update({ borderWidth: v })}>
                        <SelectTrigger className="h-8 text-xs" disabled={hidden}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['1px','2px','3px','4px','6px','8px'].map((w) => (
                            <SelectItem key={w} value={w} className="text-xs">{w}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Kolor ramki</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={color.startsWith('#') ? color : '#d1d5db'}
                          onChange={(e) => update({ borderColor: e.target.value })}
                          disabled={hidden}
                          className="h-8 w-12 rounded border bg-background disabled:opacity-50"
                        />
                        <Input
                          value={color}
                          onChange={(e) => update({ borderColor: e.target.value })}
                          disabled={hidden}
                          placeholder="#d1d5db lub red"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </>
                );
              })()}
            </PopoverContent>
          </Popover>
        )}
        <div className="mx-1 h-5 w-px bg-border" />
        <Button type="button" size="sm" variant="ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} aria-label="Cofnij" className="h-8 w-8 p-0"><Undo className="h-4 w-4" /></Button>
        <Button type="button" size="sm" variant="ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} aria-label="Ponów" className="h-8 w-8 p-0"><Redo className="h-4 w-4" /></Button>
        {toolbarExtras && (
          <div className="ml-auto flex items-center gap-1">{toolbarExtras}</div>
        )}
      </div>
      <div
        style={{ minHeight }}
        className="overflow-auto cursor-text flex"
        data-placeholder={placeholder}
        onClick={(e) => {
          if (e.target === e.currentTarget && !editor.isFocused) {
            editor.chain().focus('end').run();
          }
        }}
      >
        <EditorContent editor={editor} className="flex-1 min-w-0" />
      </div>
    </div>
  );
}
