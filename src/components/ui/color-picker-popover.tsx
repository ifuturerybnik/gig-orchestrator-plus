import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EyedropperButton } from '@/components/ui/eyedropper-button';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const PRESETY = [
  '#000000', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#FFFFFF',
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E',
  '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1',
  '#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#F43F5E', '#78350F',
];

interface Props {
  icon: LucideIcon;
  ariaLabel: string;
  value?: string | null;
  onChange: (color: string) => void;
  onClear?: () => void;
  active?: boolean;
  preventMouseDown?: boolean;
}

export function ColorPickerPopover({
  icon: Icon,
  ariaLabel,
  value,
  onChange,
  onClear,
  active,
  preventMouseDown,
}: Props) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value || '#000000');

  const wybierz = (color: string) => {
    setHex(color);
    onChange(color);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={ariaLabel}
          title={ariaLabel}
          onMouseDown={preventMouseDown ? (e) => e.preventDefault() : undefined}
          className={cn('h-8 w-8 p-0 relative', active && 'bg-accent')}
        >
          <Icon className="h-4 w-4" />
          <span
            className="absolute bottom-1 left-1 right-1 h-1 rounded-sm border border-border"
            style={{ background: value || 'transparent' }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3"
        align="start"
        onOpenAutoFocus={(e) => preventMouseDown && e.preventDefault()}
      >
        <div className="grid grid-cols-6 gap-1.5 mb-3">
          {PRESETY.map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={preventMouseDown ? (e) => e.preventDefault() : undefined}
              onClick={() => wybierz(c)}
              className="h-7 w-7 rounded-md border border-border hover:scale-110 transition-transform"
              style={{ background: c }}
              aria-label={c}
              title={c}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            onBlur={() => /^#[0-9a-fA-F]{6}$/.test(hex) && onChange(hex)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && /^#[0-9a-fA-F]{6}$/.test(hex)) {
                onChange(hex);
                setOpen(false);
              }
            }}
            className="h-8 text-xs flex-1 font-mono"
            placeholder="#000000"
          />
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#000000'}
            onChange={(e) => wybierz(e.target.value)}
            className="h-8 w-8 cursor-pointer rounded border border-input bg-background p-0"
            aria-label="Próbnik koloru"
          />
          <EyedropperButton
            size="sm"
            preventMouseDown={preventMouseDown}
            onPick={(c) => wybierz(c)}
          />
        </div>
        {onClear && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={preventMouseDown ? (e) => e.preventDefault() : undefined}
            onClick={() => { onClear(); setOpen(false); }}
            className="w-full mt-2 h-7 text-xs"
          >
            Wyczyść kolor
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
