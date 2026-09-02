import { useState } from 'react';

const COLOR_PALETTES = [
  'bg-blue-600 text-white',
  'bg-indigo-600 text-white',
  'bg-teal-600 text-white',
  'bg-emerald-600 text-white',
  'bg-violet-600 text-white',
  'bg-purple-600 text-white',
  'bg-amber-600 text-white',
  'bg-rose-600 text-white',
  'bg-sky-600 text-white',
  'bg-cyan-600 text-white',
];

function getColorForName(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTES.length;
  return COLOR_PALETTES[index];
}

function resolveAvatarUrl(src) {
  if (!src) return null;
  if (
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('blob:') ||
    src.startsWith('data:')
  ) {
    return src;
  }
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  const backendBase = import.meta.env.VITE_BACKEND_URL || apiBase.replace(/\/api\/?$/, '');
  return `${backendBase}${src.startsWith('/') ? '' : '/'}${src}`;
}

function Avatar({ name = 'User', src, size = 'md', className = '', isOnline = false, showStatus = false }) {
  const [imageError, setImageError] = useState(false);

  const sizeMap = {
    xs: 'h-6 w-6 text-xs',
    sm: 'h-8 w-8 text-xs font-medium',
    md: 'h-10 w-10 text-sm font-medium',
    lg: 'h-12 w-12 text-base font-semibold',
    xl: 'h-14 w-14 text-lg font-semibold',
    '2xl': 'h-16 w-16 text-xl font-semibold',
    '3xl': 'h-24 w-24 text-3xl font-bold',
  };

  const statusDotSize = {
    xs: 'h-1.5 w-1.5',
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
    xl: 'h-3.5 w-3.5',
    '2xl': 'h-4 w-4',
    '3xl': 'h-5 w-5',
  };

  const colorClass = getColorForName(name);
  const resolvedSrc = !imageError && src ? resolveAvatarUrl(src) : null;

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt={name}
          onError={() => setImageError(true)}
          className={`rounded-full object-cover shadow-sm ${sizeMap[size] || sizeMap.md}`}
        />
      ) : (
        <div
          className={`flex items-center justify-center rounded-full shadow-sm tracking-wide ${colorClass} ${sizeMap[size] || sizeMap.md}`}
        >
          {name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
      )}

      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-slate-900 ${
            isOnline ? 'bg-emerald-500' : 'bg-slate-400'
          } ${statusDotSize[size] || statusDotSize.md}`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}

export { resolveAvatarUrl };
export default Avatar;

