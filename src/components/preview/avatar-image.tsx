import Image from 'next/image';

interface AvatarImageProps {
  src: string;
  avatarStyle?: 'circle' | 'oneInch';
  size: number;
  className?: string;
  style?: React.CSSProperties;
  wrapperClassName?: string;
  wrapperStyle?: React.CSSProperties;
}

export function AvatarImage({
  src,
  avatarStyle = 'oneInch',
  size,
  className = '',
  style,
  wrapperClassName,
  wrapperStyle,
}: AvatarImageProps) {
  const isCircle = avatarStyle !== 'oneInch';
  const width = size;
  const height = isCircle ? size : Math.round(size * 1.4);
  const borderRadius = isCircle ? '9999px' : '4px';

  const imgEl = (
    <Image
      src={src}
      alt=""
      width={width}
      height={height}
      unoptimized
      className={className}
      style={{
        width,
        height,
        borderRadius,
        objectFit: 'cover',
        ...style,
      }}
    />
  );

  if (wrapperClassName || wrapperStyle) {
    return (
      <div
        className={wrapperClassName}
        style={{ borderRadius, ...wrapperStyle }}
      >
        {imgEl}
      </div>
    );
  }

  return imgEl;
}
