import SkillBankClient from "@/components/SkillBankClient";
import { getCatalog } from "@/lib/data";

export const dynamic = "force-dynamic";

export default function WritingPage() {
  const catalog = getCatalog();
  const items = [
    ...(catalog?.writing?.task1 || []),
    ...(catalog?.writing?.task2 || []),
  ];

  return (
    <SkillBankClient
      heading="IELTS Writing"
      subtitle="Đề thi Writing Task 1 (Biểu đồ, Bản đồ, Quy trình) và Task 2 kèm hướng dẫn lập dàn ý & bài mẫu từng đoạn"
      items={items}
      subTypeTabs={[
        { value: "task-1", label: `Task 1 (${catalog?.counts?.writingTask1 || 0})` },
        { value: "task-2", label: `Task 2 (${catalog?.counts?.writingTask2 || 0})` },
      ]}
    />
  );
}
