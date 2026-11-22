import SkillBankClient from "@/components/SkillBankClient";
import { getCatalog } from "@/lib/data";

export const dynamic = "force-dynamic";

export default function ReadingPage() {
  const catalog = getCatalog();
  const items = catalog?.reading || [];

  return (
    <SkillBankClient
      heading="IELTS Reading"
      subtitle="Toàn bộ bài đọc lẻ theo Passage 1–3, kèm giải thích chi tiết từng câu và bản từ vựng đơn giản hóa"
      items={items}
    />
  );
}
