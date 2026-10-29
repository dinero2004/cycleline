import Link from "next/link";

/** Three skewed orange bars and the CYCLELINE wordmark. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 4h4l-4 16H2z" />
      <path d="M13 4h4l-4 16H9z" />
      <path d="M20 4h4l-4 16h-4z" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="CycleLine home">
      <LogoMark />
      <span className="logo-word">CycleLine</span>
    </Link>
  );
}
