import { useEffect, useState } from 'react';
import { getPhotoUrl } from '@/lib/store';

interface PersonAvatarProps {
  name: string;
  photo?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'w-10 h-10 text-sm',
  md: 'w-14 h-14 text-base',
  lg: 'w-20 h-20 text-xl',
};

export function PersonAvatar({ name, photo, size = 'md', className = '' }: PersonAvatarProps) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  const [resolved, setResolved] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!photo) {
      setResolved(undefined);
      return;
    }
    getPhotoUrl(photo)
      .then(url => { if (!cancelled) setResolved(url); })
      .catch(() => { if (!cancelled) setResolved(undefined); });
    return () => { cancelled = true; };
  }, [photo]);

  return (
    <div className={`${sizes[size]} rounded-full overflow-hidden flex-shrink-0 bg-secondary border border-border flex items-center justify-center font-display text-foreground ${className}`}>
      {resolved ? (
        <img src={resolved} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
