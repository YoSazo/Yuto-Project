import imgLight from "../assets/yuto-mascot.webp";
import imgDark from "../assets/yuto-logo-dark.png";

export function YutoLogo({ className = "w-12 h-12 object-contain" }: { className?: string }) {
  return (
    <>
      <img src={imgLight} alt="Yuto" className={`${className} dark:hidden`} />
      <img src={imgDark} alt="Yuto" className={`${className} hidden dark:block`} />
    </>
  );
}
