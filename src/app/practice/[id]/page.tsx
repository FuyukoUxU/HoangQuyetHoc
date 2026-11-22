import Link from "next/link";
import ExamWorkbench from "@/components/ExamWorkbench";
import { getQuizById } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PracticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quiz = await getQuizById(id);

  if (!quiz) {
    return (
      <div style={{ padding: 32, maxWidth: 640, margin: "40px auto" }}>
        <div className="panel">
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Không tìm thấy đề thi #{id}</h1>
          <p style={{ color: "var(--muted)", marginBottom: 16 }}>
            Đề thi này không tồn tại hoặc phiên đăng nhập YouPass cần được làm mới để tải về.
          </p>
          <div>
            <Link href="/" className="btn primary">
              Quay về trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <ExamWorkbench quiz={quiz} />;
}
