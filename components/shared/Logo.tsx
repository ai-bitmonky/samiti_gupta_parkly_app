/* The P logo: forest rounded square, white P, lime dot. <Logo size={30} word /> */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#0F2A1F" />
      <rect x=".5" y=".5" width="39" height="39" rx="10.5" fill="none" stroke="rgba(198,244,50,.25)" />
      <path d="M13 30V10h8.5a6.5 6.5 0 0 1 0 13H13" fill="none" stroke="#F5F4EF" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="28.5" cy="29" r="3.6" fill="#C6F432" />
    </svg>
  );
}
export default function Logo({ size = 30, word = true }: { size?: number; word?: boolean }) {
  if (!word) return <LogoMark size={size} />;
  return <span className="logo"><LogoMark size={size} /><span className="logo-word">PARKLY</span></span>;
}
