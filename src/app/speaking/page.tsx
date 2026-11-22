import SpeakingBankClient from "@/components/SpeakingBankClient";
import { getCatalog } from "@/lib/data";

export const dynamic = "force-dynamic";

export default function SpeakingPage() {
  const catalog = getCatalog();
  return (
    <SpeakingBankClient
      part1={catalog?.speaking?.part1 || []}
      part2={catalog?.speaking?.part2 || []}
      part3={catalog?.speaking?.part3 || []}
    />
  );
}
