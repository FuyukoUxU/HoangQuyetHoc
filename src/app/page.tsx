import OverviewClient from "@/components/OverviewClient";
import { getCatalog, getCrawlStatus } from "@/lib/data";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const catalog = getCatalog();
  const status = getCrawlStatus();

  if (!catalog) {
    return (
      <div className="panel">
        <h1>Đang khởi tạo kho đề IELTS</h1>
        <p className="title-sub">
          Hệ thống đang tải danh mục đề từ YouPass. Hãy tải lại trang sau vài giây.
        </p>
      </div>
    );
  }

  return (
    <OverviewClient
      catalog={catalog}
      downloadedFiles={status.downloadedFiles || 0}
    />
  );
}
