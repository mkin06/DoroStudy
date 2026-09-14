/**
 * Gắn icon cho lời khuyên của AI.
 *
 * Vì sao làm ở frontend chứ không bắt AI tự chèn emoji: câu chữ do model sinh ra thay đổi
 * từng lượt, còn icon thì phải ổn định — cùng một lời khuyên "cất điện thoại" mà lần thì
 * 📵 lần thì 🙅 lần thì không có gì sẽ khiến giao diện trông tuỳ hứng. Prompt đã cấm model
 * dùng emoji; việc chọn icon là việc của giao diện, và ở đây nó xác định 100%.
 *
 * Danh sách xếp từ CỤ THỂ tới CHUNG CHUNG, lấy khớp đầu tiên: "uống nước" phải ra 💧 chứ
 * không được rơi vào 🎯 của "tập trung" nằm phía dưới.
 */

const RULES = [
  [['uong nuoc', 'uong mot coc', 'nuoc loc'], '💧'],
  [['dien thoai', 'khong lam phien', 'do not disturb', 'tat thong bao', 'up may'], '📵'],
  [['mang xa hoi', 'facebook', 'tiktok', 'instagram', 'youtube', 'luot'], '📱'],
  [['tai nghe', 'nhac nen', 'lofi', 'white noise'], '🎧'],
  [['tieng on', 'yen tinh', 'on ao'], '🔇'],
  [['dung day', 'van dong', 'di lai', 'gian co', 'duoi nguoi'], '🧍'],
  [['ngu', 'chop mat', 'nghi ngoi', 'met moi', 'can pin', 'can nang luong'], '😴'],
  [['an sang', 'an nhe', 'do an', 'bua an'], '🍎'],
  [['viet ra', 'ghi ra', 'muc tieu', 'o task', 'liet ke'], '✍️'],
  [['rut ngan', 'rut xuong', 'ngan hon', 'giam thoi gian', 'giam xuong', 'cat bot'], '✂️'],
  [['dai hon', 'keo dai', 'tang thoi gian'], '⏳'],
  [['don dep', 'ban hoc', 'khong gian', 'dep goc'], '🧹'],
  [['nghi giai lao', 'giai lao', 'break', 'nghi 5'], '☕'],
  [['buoi sang', 'sang som'], '🌅'],
  [['buoi toi'], '🌙'],
  [['dem khuya', 'khuya'], '🌛'],
  [['buoi chieu'], '🌤️'],
  [['khung gio', 'gio vang', 'luc 1', 'luc 2', 'dung gio'], '⏰'],
  [['chuoi ngay', 'streak', 'lien tiep'], '🔥'],
  [['nang luong', 'pin'], '🔋'],
  [['on tap', 'lam bai', 'bai tap', 'mon '], '📚'],
  [['pomodoro', 'phut'], '⏱️'],
];

/** Bỏ dấu tiếng Việt để khớp được cả câu gõ vội không dấu. */
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Khớp theo RANH GIỚI TỪ, không phải substring thô.
 *
 * Sau khi bỏ dấu, tiếng Việt sinh ra rất nhiều trùng lặp vô nghĩa: "còn tập trung" chứa
 * "on tap", "buồn ngủ" chứa "on ng". Khớp thô làm lời khuyên đeo nhầm icon, mà icon sai
 * còn khó hiểu hơn là không có icon.
 */
function matchesWord(text, keyword) {
  // Mọi từ khoá trong RULES đều là chữ thường và dấu cách, không có ký tự đặc biệt của
  // regex — nên ghép thẳng, không cần escape. Thêm từ khoá mới cũng phải giữ đúng quy ước đó.
  const at = text.indexOf(keyword);
  if (at < 0) return false;
  const before = at === 0 ? ' ' : text[at - 1];
  return !/[a-z0-9]/.test(before);
}

/**
 * @param {string} advice câu khuyên do AI hoặc backend sinh ra
 * @param {string} fallback icon dùng khi không khớp luật nào
 * @returns {string} một emoji
 */
export function adviceIcon(advice, fallback = '🎯') {
  if (!advice) return fallback;
  const text = normalize(advice);
  for (const [keywords, icon] of RULES) {
    if (keywords.some((k) => matchesWord(text, k))) {
      return icon;
    }
  }
  return fallback;
}
