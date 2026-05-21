import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Loader2 } from 'lucide-react';
import { useScrollLock } from '@/hooks/use-scroll-lock';

interface PhotoCropModalProps {
  /** Object URL or data URL of the picked image. */
  imageSrc: string;
  onCancel: () => void;
  /** Receives the cropped square image as a JPEG File ready to upload. */
  onCropped: (file: File) => void;
}

// Avatars are never shown larger than ~100 px, so a 1000 px square crop is
// already overkill — cap output here to keep uploads small.
const MAX_OUTPUT = 1000;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', () => reject(new Error('Could not load image')));
    img.src = src;
  });
}

async function cropToFile(imageSrc: string, area: Area): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const scale = Math.min(1, MAX_OUTPUT / area.width);
  canvas.width = Math.round(area.width * scale);
  canvas.height = Math.round(area.height * scale);

  // The crop is square (aspect 1); the round overlay is only a guide.
  // The stored image stays square — the avatar's rounded-full clips it
  // to a circle wherever it's displayed.
  ctx.drawImage(
    image,
    area.x, area.y, area.width, area.height,
    0, 0, canvas.width, canvas.height,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.9),
  );
  if (!blob) throw new Error('Could not process image');
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
}

/**
 * Full-screen crop step shown after the user picks a photo. A round crop
 * overlay shows exactly what will land inside the circular avatar; the
 * user drags and pinch-zooms to frame the shot.
 */
export function PhotoCropModal({ imageSrc, onCancel, onCropped }: PhotoCropModalProps) {
  useScrollLock();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!areaPixels || processing) return;
    setProcessing(true);
    try {
      const file = await cropToFile(imageSrc, areaPixels);
      onCropped(file);
    } catch {
      setProcessing(false);
    }
  };

  // z-[70] keeps the cropper above bottom-sheet modals (z-[60]) it may
  // have been opened from (QuickAddSheet, etc.).
  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col safe-top safe-bottom">
      <div className="flex items-center justify-between px-4 pt-3 pb-3">
        <button
          onClick={onCancel}
          disabled={processing}
          className="h-9 px-2 text-[15px] text-[hsl(var(--foreground)/0.55)] disabled:opacity-50"
        >
          Cancel
        </button>
        <h2 className="font-sans text-[16px] font-semibold text-foreground">Move and Scale</h2>
        <button
          onClick={handleConfirm}
          disabled={processing || !areaPixels}
          className="h-9 px-2 text-[15px] font-semibold text-primary disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {processing && <Loader2 className="w-4 h-4 animate-spin" />}
          Use Photo
        </button>
      </div>

      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          minZoom={1}
          maxZoom={4}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      <div className="px-6 pt-5 pb-3">
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Zoom"
          className="w-full accent-primary"
        />
        <p className="text-[12px] text-[hsl(var(--foreground)/0.55)] text-center mt-2">
          Drag to reposition · pinch or slide to zoom
        </p>
      </div>
    </div>
  );
}
