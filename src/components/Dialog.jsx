import { useEffect, useId, useRef } from "react";

// Native dialog provides modal focus containment and Escape handling.
export default function Dialog({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  const headingId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      previousFocus?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal--wide" : ""}`}
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        closeRef.current();
      }}
    >
      <header className="modal__header">
        <h2 id={headingId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
