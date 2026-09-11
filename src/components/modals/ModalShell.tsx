import type { MouseEvent, ReactNode } from 'react';

interface ModalShellProps {
  onBackdropClick: () => void;
  children: ReactNode;
}

// Backdrop compartilhado pelos 4 modais — fecha ao clicar fora do card.
// O fechamento via tecla Escape é tratado globalmente em ModalsContext.
export function ModalShell({ onBackdropClick, children }: ModalShellProps) {
  function handleClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onBackdropClick();
  }

  return (
    <div className="modal-shell-backdrop fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4" onClick={handleClick}>
      <div className="flex min-h-full items-center justify-center" onClick={handleClick}>
        {children}
      </div>
    </div>
  );
}
