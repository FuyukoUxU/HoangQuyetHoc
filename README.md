# IELTS Ledger — Kho đề IELTS 4 kỹ năng (Offline Next.js)

Ứng dụng tự luyện IELTS toàn diện (Reading, Listening, Writing, Speaking & Full Simulation Test) được đồng bộ đầy đủ từ YouPass.

## Thống kê dữ liệu đã crawl
- **533** bài luyện **Reading** (kèm đáp án, giải thích từng bước tiếng Việt & bản từ vựng dễ hiểu)
- **711** bài luyện **Listening** (kèm Audio chuẩn phòng thi & Transcript)
- **901** đề **Writing** (388 Task 1 + 513 Task 2 kèm biểu đồ, hướng dẫn & bài mẫu từng đoạn)
- **399** chủ đề **Speaking** Part 1, 2, 3 (**2,380** câu hỏi kèm giọng đọc giám khảo & từ vựng mẫu)
- **211** bộ đề **Full Simulation & Cambridge Mock Tests**
- Tổng cộng **5,141** gói JSON đề thi lưu cục bộ tại `data/quizzes/`.

## Khởi chạy ứng dụng

```bash
npm run dev
# Hoặc bản tối ưu production:
npm run build && npm run start
```

Mở trình duyệt tại `http://localhost:3000`.

## Đồng bộ thêm đề mới & File nghe ngoại tuyến

```bash
npm run crawl
npm run crawl:audio
```

Toàn bộ file nghe Listening & Speaking MP3 được lưu tại `data/audio/` và phát trực tiếp qua `/api/audio/[id]` (hỗ trợ HTTP Range tua mượt ngay cả khi ngoại tuyến). Bạn cũng có thể cập nhật Cookie JSON và theo dõi tiến độ tải tại mục **Đồng bộ & Cookie** (`/settings`).
