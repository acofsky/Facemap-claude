import { useEffect, useState } from 'react';
import { getPhotoUrl } from '@/lib/store';

interface PhotoImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  path: string;
}

/**
 * Renders an <img> for a photo stored in the private person-photos bucket.
 * Resolves the storage path to a short-lived signed URL.
 * Also accepts legacy full URLs for backwards compatibility.
 */
export function PhotoImg({ path, ...rest }: PhotoImgProps) {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    if (!path) return;
    getPhotoUrl(path)
      .then(u => { if (!cancelled) setUrl(u); })
      .catch(() => { if (!cancelled) setUrl(undefined); });
    return () => { cancelled = true; };
  }, [path]);
  if (!url) return null;
  return <img src={url} {...rest} />;
}
