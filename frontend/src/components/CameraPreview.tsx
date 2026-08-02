import { useEffect, useRef } from 'react';
import { attachCamera } from '../lib/pose';

/**
 * Live camera preview backed by the already-open arena stream.
 *
 * Shown while searching for an opponent, which is the only moment where framing
 * can still be fixed for free: once the match is found the countdown is running
 * and every second spent stepping backwards is a second not spent lifting.
 */
export function CameraPreview({ stream, height = 150 }: { stream: MediaStream | null; height?: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    void attachCamera(video, stream);
  }, [stream]);

  return (
    <div
      style={{
        position: 'relative',
        height,
        borderRadius: 'var(--r-image)',
        overflow: 'hidden',
        background: '#000',
      }}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
        }}
      />
      <span
        className="glass"
        style={{ position: 'absolute', left: 8, bottom: 8, fontSize: 11, padding: '4px 10px' }}
      >
        <span className="chip__dot chip__dot--pulse" style={{ background: 'var(--ok)' }} />
        Your camera · never uploaded
      </span>
    </div>
  );
}
