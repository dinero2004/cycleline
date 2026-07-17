import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="CycleLine home">
      CycleLine
    </Link>
  );
}
