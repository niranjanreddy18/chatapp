function Avatar({ name, src, size = 'md' }) {
  const sizeMap = {
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-14 w-14 text-lg',
  };

  if (src) {
    return <img src={src} alt={name} className={`rounded-full object-cover ${sizeMap[size]}`} />;
  }

  return (
    <div className={`flex items-center justify-center rounded-full bg-sky-600 font-semibold text-white ${sizeMap[size]}`}>
      {name?.charAt(0)?.toUpperCase() || 'U'}
    </div>
  );
}

export default Avatar;
