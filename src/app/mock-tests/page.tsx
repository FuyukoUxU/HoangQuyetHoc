import MockTestsClient from "@/components/MockTestsClient";
import { getCatalog } from "@/lib/data";

export const dynamic = "force-dynamic";

export default function MockTestsPage() {
  const catalog = getCatalog();
  return (
    <MockTestsClient
      readingBooks={catalog?.mockTests?.reading || []}
      listeningBooks={catalog?.mockTests?.listening || []}
      speakingBooks={catalog?.mockTests?.speaking || []}
    />
  );
}
