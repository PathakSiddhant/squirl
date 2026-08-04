import { ImageResponse } from 'next/og';

// Generated rather than shipped as a binary, so the whole identity lives in
// code and stays in step with the palette.
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#181b20',
          color: '#fafafb',
          fontSize: 300,
          fontWeight: 600,
          letterSpacing: '-0.04em',
        }}
      >
        ₹
      </div>
    ),
    size,
  );
}
