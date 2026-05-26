import { useEffect, useState } from 'react';
import { Pipette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EyeDropperResult {
  sRGBHex: string;
}
interface EyeDropperLike {
  open(options?: { signal?: AbortSignal }): Promise<EyeDropperResult>;
}
declare global {
  interface Window {
    EyeDropper?: new () => EyeDropperLike;
  }
}

export function isEyedropperSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.EyeDropper === 'function';
}

export function EyedropperButton({
  onPick,
  className,
  size = 'icon',
  title = 'Pobierz kolor z ekranu',
  preventMouseDown = false,
  disabled,
}: {
  onPick: (hex: string) => void;
  className?: string;
  size?: 'icon' | 'sm';
  title?: string;
  preventMouseDown?: boolean;
  disabled?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupported(isEyedropperSupported());
  }, []);

  if (!supported) return null;

  async function handleClick() {
    if (busy || !window.EyeDropper) return;
    setBusy(true);
    try {
      const dropper = new window.EyeDropper();
      const res = await dropper.open();
      onPick(res.sRGBHex);
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name !== 'AbortError') {
        toast.error('Nie udało się pobrać koloru z ekranu');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={size === 'icon' ? 'icon' : 'sm'}
      title={title}
      disabled={disabled || busy}
      onMouseDown={preventMouseDown ? (e) => e.preventDefault() : undefined}
      onClick={handleClick}
      className={cn(size === 'icon' ? 'h-9 w-9 shrink-0' : 'h-8 px-2', className)}
    >
      <Pipette className="h-4 w-4" />
    </Button>
  );
}
