// One line of text that cuts off with "…"; when it is cut, a "See more" link shows the rest.
import { useLayoutEffect, useRef, useState } from 'react';

export default function MoreLine({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const check = () => setCut(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, open]);

  if (!text) return null;

  return (
    <div className="min-w-0">
      <p ref={ref} className={`${className} ${open ? 'whitespace-normal break-words' : 'truncate'}`}>
        {text}
      </p>
      {(cut || open) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          className="text-[12px] text-[#0066cc] hover:underline cursor-pointer mt-0.5"
        >
          {open ? 'See less' : 'See more'}
        </button>
      )}
    </div>
  );
}
