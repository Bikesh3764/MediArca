import React, { useState } from 'react';

interface AvatarImageProps {
  src?: string;
  name?: string | null;
  className?: string;
}

/** Profile photo that shows the person's initial if the image is missing or fails to load. */
export const AvatarImage: React.FC<AvatarImageProps> = ({ src, name, className = 'w-full h-full object-cover' }) => {
  const [failed, setFailed] = useState(false);
  const initial = (name || '').replace(/^Dr\.?\s*/i, '').trim().charAt(0).toUpperCase() || '?';

  if (!src || failed) {
    return (
      <span
        aria-label={name || undefined}
        className={`${className} flex items-center justify-center bg-[#0066cc] text-white font-semibold text-sm select-none`}
      >
        {initial}
      </span>
    );
  }

  return <img src={src} alt={name || ''} className={className} loading="lazy" onError={() => setFailed(true)} />;
};
