# BepAI — Hôm nay nấu gì?

PWA công thức nấu ăn chạy offline, có trợ lý AI: món Việt ba miền, món Á, món Âu, cơm nhà và món nhậu.

**Dùng ngay:** https://chuyennm.github.io/BepAI/ — mở trên điện thoại rồi chọn "Thêm vào màn hình chính" để cài như một ứng dụng.

## Tính năng

- **Gợi ý theo hoàn cảnh:** thời tiết thật tại nơi bạn ở (Open-Meteo), số người trong nhà, vùng miền, khẩu vị cay.
- **Lưu ý sức khoẻ:** khai báo trong nhà có người tiểu đường, cao huyết áp, gout, dạ dày, thận, mang thai, trẻ nhỏ, dị ứng… app cảnh báo món nên tránh / cần điều chỉnh và hạ thứ hạng các món đó.
- **65 công thức, 21 mâm cơm / bàn nhậu dựng sẵn:** món mặn, canh, rau, đồ kèm, ăn sáng, món nhậu dễ làm, món Á, món Âu.
- **Mâm cơm & thực đơn 7 ngày:** chọn mâm theo thời tiết, "Chọn giúp tôi", tự xếp cả tuần không lặp mâm, gom nguyên liệu cả mâm / cả tuần vào danh sách đi chợ, gợi ý thứ tự nấu.
- **Nhật ký đã nấu:** món vừa nấu trong 3 ngày được lùi xuống để bữa cơm đổi món.
- **Tìm & lọc:** theo vùng miền, dịp ăn, độ khó, thời gian; tìm không cần gõ dấu.
- **Tính khẩu phần:** 1–20 người hoặc "bàn nhậu", tự làm tròn định lượng kiểu đi chợ.
- **Danh sách đi chợ:** đánh dấu thứ đã có, đẩy phần thiếu vào danh sách gom theo quầy hàng.
- **Chế độ nấu rảnh tay:** chữ to, màn hình luôn sáng (Wake Lock), thời lượng trong bước nấu thành nút hẹn giờ có chuông + rung, điều khiển bằng giọng nói ("Tiếp theo", "Quay lại", "Đọc lại"), nút hỏi AI ngay tại bước đang làm.
- **BepAI Assistant:** "Tủ lạnh có gì nấu nấy", "Hôm nay ăn gì?" và trò chuyện theo từng công thức (thay nguyên liệu, sơ chế, chỉnh vị cho trẻ em / người bệnh).

## Cấu hình AI

Vào **Cài đặt → Trợ lý AI**, chọn nhà cung cấp và dán API key:

| Nhà cung cấp | Lấy key | Ghi chú |
| --- | --- | --- |
| Google Gemini (khuyên dùng) | https://aistudio.google.com/apikey | Có gói miễn phí; app tự chọn bản Flash-Lite mới nhất |
| DeepSeek | https://platform.deepseek.com/api_keys | Trả phí theo lượng dùng, rất rẻ |
| Tương thích OpenAI | OpenRouter, Groq… | Tự nhập base URL và chọn model |

Danh sách model được tải trực tiếp từ nhà cung cấp (làm mới mỗi ngày), nên không có tên model nào ghi cứng trong mã. Key chỉ lưu trong `localStorage` của thiết bị và gửi thẳng tới nhà cung cấp. Không có key, app dùng chế độ dự phòng với dữ liệu có sẵn.

## Chạy trên máy

```bash
npm install
npm run dev      # phát triển
npm run build    # kiểm tra kiểu + build ra dist/
npm run preview  # chạy thử bản build (có service worker)
```

Mỗi lần push lên `main`, GitHub Actions tự build và đăng lên GitHub Pages (`.github/workflows/deploy.yml`).

## Cấu trúc

```
public/            manifest.webmanifest, sw.js (service worker), icons/
scripts/           gen-icons.mjs — sinh icon PNG
src/
  types/recipe.ts      interface Recipe, Ingredient, Step…
  data/                recipes.ts (10 món đặc sản + ảnh), comNha.ts, nhauAAu.ts (55 món viết bằng builder.ts), mealSets.ts (mâm cơm)
  services/aiService.ts  Gemini / DeepSeek / OpenAI-compatible, streaming, tự chọn model, chế độ dự phòng
  lib/household.ts     hồ sơ gia đình, thời tiết, quy tắc cảnh báo bệnh lý
  lib/meals.ts         xếp hạng mâm cơm, thực đơn 7 ngày, đi chợ cả mâm
  lib/                 storage (localStorage), scaling (khẩu phần), timeParse (hẹn giờ), recipes, app (PWA)
  hooks/               useWakeLock, useVoice, useHashRoute
  components/          ui.tsx, ChatDrawer.tsx
  pages/               Home, Meals, MealDetail, RecipeDetail, CookMode, Assistant, Shopping, Saved, Settings
```

## Lưu ý

- Cảnh báo sức khoẻ dựa trên nguyên tắc dinh dưỡng chung, mang tính tham khảo, không thay cho tư vấn của bác sĩ.
- Ảnh món ăn từ Wikimedia Commons, ghi tác giả và giấy phép dưới mỗi công thức.
