import { useEffect, useRef, useState } from 'react';
import { normKey } from '../../lib/parse';
import { categoryIcon, categoryLabel, categoryTone } from '../../lib/categoryUi';

interface CategorySelectProps {
  value: string;
  categories: string[];
  onChange: (value: string) => void;
}

// Porta do dropdown custom de categoria (script.js:793-859): não é um <select>
// visual, é um menu próprio com busca e ícones por categoria.
export function CategorySelect({ value, categories, onChange }: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const options = ['all', ...categories];
  const q = normKey(search);
  const filtered = options.filter((o) => !q || normKey(categoryLabel(o)).includes(q));

  function select(v: string) {
    onChange(v);
    setOpen(false);
  }

  function toggleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) setTimeout(() => searchRef.current?.focus(), 40);
  }

  return (
    <div className="category-filter-shell">
      <div className="kpi-label mb-1">Categoria</div>
      <div ref={wrapRef} className={`category-select ${open ? 'open' : ''}`}>
        <button type="button" className="category-select-trigger" aria-expanded={open} onClick={toggleOpen}>
          <span className="category-select-main-icon">▣</span>
          <span className="category-select-text">{categoryLabel(value)}</span>
          <span className="category-select-chevron">⌄</span>
        </button>
        <div className={`category-select-menu ${open ? '' : 'hidden'}`}>
          <div className="category-select-search">
            <span>⌕</span>
            <input
              ref={searchRef}
              type="text"
              autoComplete="off"
              placeholder="Buscar categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="category-select-options">
            {filtered.length ? (
              filtered.map((o) => (
                <button
                  key={o}
                  type="button"
                  className={`category-option ${o === value ? 'active' : ''} ${categoryTone(o)}`}
                  title={categoryLabel(o)}
                  onClick={() => select(o)}
                >
                  <span className="category-option-icon">{categoryIcon(o)}</span>
                  <span className="category-option-label">{categoryLabel(o)}</span>
                  {o === value && <span className="category-option-check">✓</span>}
                </button>
              ))
            ) : (
              <div className="category-option empty">Nenhuma categoria encontrada</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
