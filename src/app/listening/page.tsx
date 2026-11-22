import SkillBankClient from "@/components/SkillBankClient";
import { getCatalog } from "@/lib/data";

export const dynamic = "force-dynamic";

export default function ListeningPage() {
  const catalog = getCatalog();
  const items = catalog?.listening || [];

  return (
    <SkillBankClient
      heading="IELTS Listening"
      subtitle="Kho đề nghe Section 1–4 đầy đủ file âm thanh chuẩn phòng thi, đáp án và bản gỡ băng (transcript)"
      items={items}
    />
  );
}
