import { useState } from 'react';

interface GitHubAvatarProps {
  username: string;
  size?: number;
}

export function GitHubAvatar({ username, size = 24 }: GitHubAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const handle = username.replace(/^@/, '');

  if (imgError) {
    return (
      <span className="gh-avatar-fallback" style={{ width: size, height: size }}>
        {handle[0]?.toUpperCase() ?? '?'}
      </span>
    );
  }

  return (
    <img
      src={`https://github.com/${handle}.png?size=${size * 2}`}
      alt={handle}
      width={size}
      height={size}
      className="gh-avatar"
      // Request 2x resolution for sharp display on high-DPI / retina screens
      onError={() => setImgError(true)}
    />
  );
}
