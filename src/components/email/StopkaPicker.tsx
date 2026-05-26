// Concertivo — selektor stopki (dropdown). Stopka jest trzymana POZA edytorem
// WYSIWYG, jako oddzielny stan — analogicznie do Gmaila/Outlooka.

import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDostepneStopki, type EmailStopkaPelna } from '@/hooks/useEmailStopki';
import { renderStopkaHtml } from '@/lib/emailStopkaRender';

interface Props {
  /** Aktualny HTML stopki (osobny stan, NIE część treści maila). */
  signatureHtml: string;
  onSignatureHtmlChange: (html: string) => void;
  /** Kontekst — jeśli podany, dostępne też stopki tej organizacji. */
  orgId?: string | null;
  /** Auto-wstaw domyślną przy pierwszym otwarciu, jeśli puste. */
  autoInsertDefault?: boolean;
  disabled?: boolean;
  label?: string;
}

const NONE_VALUE = '__none__';

export function StopkaPicker({
  signatureHtml,
  onSignatureHtmlChange,
  orgId,
  autoInsertDefault = true,
  disabled,
  label,
}: Props) {
  const { t } = useTranslation();
  const { data: stopki = [], isLoading } = useDostepneStopki(orgId);
  const autoAppliedRef = useRef(false);

  const domyslna = useMemo(() => stopki.find(s => s.domyslna) ?? null, [stopki]);

  const currentSignatureId = useMemo(() => {
    const m = signatureHtml.match(/data-email-signature="([^"]+)"/);
    return m?.[1] ?? null;
  }, [signatureHtml]);

  useEffect(() => {
    if (!autoInsertDefault || autoAppliedRef.current) return;
    if (isLoading) return;
    autoAppliedRef.current = true;
    if (!domyslna) return;
    if (currentSignatureId === domyslna.id) return;
    onSignatureHtmlChange(renderStopkaHtml(domyslna));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, domyslna]);

  function applyStopka(s: EmailStopkaPelna | null) {
    onSignatureHtmlChange(s ? renderStopkaHtml(s) : '');
  }

  function handleChange(v: string) {
    if (v === NONE_VALUE) { applyStopka(null); return; }
    applyStopka(stopki.find(x => x.id === v) ?? null);
  }

  if (!isLoading && stopki.length === 0) return null;

  return (
    <div>
      <Label className="text-xs">{label ?? t('stopki.picker_label')}</Label>
      <Select value={currentSignatureId ?? NONE_VALUE} onValueChange={handleChange} disabled={disabled || isLoading}>
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? t('common.loading') : t('stopki.picker_placeholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>{t('stopki.picker_none')}</SelectItem>
          {stopki.map(s => (
            <SelectItem key={s.id} value={s.id}>
              {s.nazwa}
              {s.domyslna ? ' ★' : ''}
              {s.organization_id ? ` · ${t('stopki.scope_org')}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
