import Image from "next/image";
import Link from "next/link";
import logo from "../../public/logo.svg";

export default function SiteHeader() {
  return (
    <header className="shrink-0 bg-[#d6d7b9] p-2 px-4 text-3xl">
      <Link className="inline-flex items-center gap-3" href="/">
        <Image className="h-10 w-auto" src={logo} alt="" priority />
        <span>wandr</span>
      </Link>
    </header>
  );
}
