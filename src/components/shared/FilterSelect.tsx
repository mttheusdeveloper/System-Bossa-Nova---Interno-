import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, ChevronUpDownIcon } from './SelectIcons';
import { OriginButton } from '../ui/origin-button';

const TRIGGER_CLASS =
  'w-full h-9 px-3 rounded-lg justify-start text-[.8rem] font-semibold tracking-[-0.02em] [--ic-foreground:#fff]';
const OPTION_CLASS =
  'w-full h-auto min-h-9 justify-start py-2 px-2.5 rounded-lg text-[.8rem] [--ic-foreground:#fff]';

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  staticStyle?: boolean;
}

// Dropdown de filtro reaproveitado por todas as abas com filtros em lista
// (Captação, Designers, ...) — sempre inclui "Todos" como primeira opção.
export function FilterSelect({ label, value, options, onChange, staticStyle = true }: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const menuId = useId();
  const selectedLabel = value === 'all' ? 'Todos' : options.find((option) => option.value === value)?.label || value;
  const entries = [{ value: 'all', label: 'Todos' }, ...options];

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, []);

  function select(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="kpi-label">
        {label}
      </span>
      <div
        ref={wrapRef}
        className={`month-select ${open ? 'open' : ''}`}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || !open) return;
          event.preventDefault();
          setOpen(false);
          triggerRef.current?.focus();
        }}
      >
        {staticStyle ? (
          <button
            ref={triggerRef}
            type="button"
            className={`${TRIGGER_CLASS} vec-static-select-trigger ${open ? 'active' : ''}`}
            aria-controls={menuId}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-labelledby={labelId}
            onClick={(event) => {
              event.stopPropagation();
              setOpen((current) => !current);
            }}
          >
            <span className="flex w-full min-w-0 items-center justify-between gap-2">
              <span className="truncate">{selectedLabel}</span>
              <ChevronUpDownIcon className="month-select-chevron" />
            </span>
          </button>
        ) : (
          <OriginButton
            ref={triggerRef}
            className={TRIGGER_CLASS}
            active={open}
            aria-controls={menuId}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-labelledby={labelId}
            onClick={(event) => {
              event.stopPropagation();
              setOpen((current) => !current);
            }}
          >
            <span className="flex w-full min-w-0 items-center justify-between gap-2">
              <span className="truncate">{selectedLabel}</span>
              <ChevronUpDownIcon className="month-select-chevron" />
            </span>
          </OriginButton>
        )}

        <AnimatePresence>
          {open && (
            <motion.div
              id={menuId}
              role="listbox"
              aria-labelledby={labelId}
              className="month-select-menu"
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              style={{ transformOrigin: 'top left', width: '100%' }}
            >
              {entries.map((entry) => {
                const selected = entry.value === value;
                const content = (
                  <span className="flex w-full min-w-0 items-center gap-2">
                    <span className="flex-1 truncate text-left">{entry.label}</span>
                    {selected && <CheckIcon className="category-option-check" />}
                  </span>
                );
                return staticStyle ? (
                  <button
                    key={entry.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`${OPTION_CLASS} vec-static-select-option ${selected ? 'active' : ''}`}
                    onClick={() => select(entry.value)}
                  >
                    {content}
                  </button>
                ) : (
                  <OriginButton
                    key={entry.value}
                    role="option"
                    aria-selected={selected}
                    className={OPTION_CLASS}
                    active={selected}
                    onClick={() => select(entry.value)}
                  >
                    {content}
                  </OriginButton>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
