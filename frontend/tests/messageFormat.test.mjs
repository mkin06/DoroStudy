import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createMessageFormatter } from '../src/lib/messageFormat.js';

const messages = JSON.parse(readFileSync(new URL('../src/lib/messages.en.json', import.meta.url), 'utf8'));
const english = createMessageFormatter(messages);

test('the reported WBAN plan preserves the day parts, scores and signed drivers', () => {
  assert.equal(english('Học môn WBAN trong 15 phút, ngay bây giờ'), 'Study WBAN for 15 minutes now');
  assert.equal(english('Buổi chiều của bạn ở mức ổn (75 điểm), chỉ thấp hơn buổi tối 1 điểm. Học được.'),
    'You average 75 points when studying in the afternoon, compared with studying in the evening (a 1-point gap).');
  assert.equal(english('Môn WBAN +3 điểm so với trung bình của bạn (4 phiên).'),
    'Subject WBAN: +3 points versus your average (4 sessions).');
  assert.equal(english('Học buổi chiều +2 điểm so với trung bình của bạn (2 phiên).'),
    'Studying in the afternoon: +2 points versus your average (2 sessions).');
  assert.equal(english('Phiên 15 phút +7 điểm so với trung bình của bạn (2 phiên).'),
    '15-minute sessions: +7 points versus your average (2 sessions).');
});

test('all day parts translate without stealing words from an adjacent numeric parameter', () => {
  for (const [vi, en] of [['Buổi sáng', 'in the morning'], ['Buổi chiều', 'in the afternoon'], ['Buổi tối', 'in the evening'], ['Đêm khuya', 'late at night']]) {
    assert.equal(english(`${vi} của bạn ở mức ổn (75 điểm), chỉ thấp hơn buổi tối 1 điểm. Học được.`),
      `You average 75 points when studying ${en}, compared with studying in the evening (a 1-point gap).`);
    assert.equal(english(`Học ${vi.toLowerCase()} -12 điểm so với trung bình của bạn (10 phiên).`),
      `Studying ${en}: -12 points versus your average (10 sessions).`);
  }
});

test('subject names with numbers and punctuation survive nested templates', () => {
  for (const subject of ['WBAN 2.0', 'Machine Learning 101', 'C++ / Algorithms (II)']) {
    assert.equal(english(`Môn ${subject} -3.5 điểm so với trung bình của bạn (12 phiên).`),
      `Subject ${subject}: -3.5 points versus your average (12 sessions).`);
    assert.equal(english(`Học môn ${subject} trong 25 phút, ngay bây giờ`), `Study ${subject} for 25 minutes now`);
  }
});

test('good, poor and unknown timing advice retain their numeric fields', () => {
  assert.equal(english('Đây đang là khung giờ tốt nhất của bạn: buổi tối bạn đạt trung bình 82 điểm qua 4 phiên. Xếp việc khó vào đúng lúc này.'),
    'This is your best study time: 82 points on average across 4 sessions in the evening. Save difficult tasks for this time.');
  assert.equal(english('Buổi chiều bạn thường chỉ đạt 60 điểm, trong khi buổi tối đạt 82 — chênh 22 điểm. Dời được thì học lúc 19:00; học ngay bây giờ thì hạ mục tiêu xuống một nấc.'),
    'You average 60 points in the afternoon, compared with 82 points in the evening: a gap of 22. Try 19:00, or choose a smaller goal now.');
  assert.equal(english('Chưa đủ dữ liệu để biết buổi chiều có hợp với bạn không. Cứ học — mỗi phiên là một điểm dữ liệu.'),
    'Not enough data to know whether studying in the afternoon suits you yet. Each session helps us learn.');
});

test('profile evidence and compound discoveries are localized completely', () => {
  assert.equal(english('tiếng ồn xuất hiện ở 3/8 phiên (38%). Những phiên không bị nó làm phiền, bạn cao hơn 9 điểm.'),
    'noise appeared in 3/8 sessions (38%). You scored 9 points higher in sessions without this distraction.');
  assert.equal(english('nhịp trung bình 1.5 ngày'), 'an average gap of 1.5 days');
  assert.equal(english('2 phiên buổi chiều'), '2 sessions studying in the afternoon');
  assert.equal(english('Chuỗi 3 ngày liên tiếp. Học hôm nay để giữ mạch.'), 'A 3-day streak. Study today to keep it going.');
  assert.equal(english('Chuỗi 3 ngày liên tiếp — dài nhất từ trước tới nay. Học hôm nay để giữ mạch.'),
    'A 3-day streak — your longest so far. Study today to keep it going.');
  assert.equal(english('Bạn viết 123 từ trong phiên này.'), 'You wrote 123 words during this session.');
  assert.equal(english('Giờ vàng theo từng môn'), 'Best study times by subject');
});

test('explicit parameters, literal user text and repeated/out-of-order placeholders still work', () => {
  assert.equal(english('Điểm dự kiến {0}: {1}', [82, 'Tốt']), 'Predicted score 82: Good');
  assert.equal(english('My own WBAN notes, 15 minutes'), 'My own WBAN notes, 15 minutes');
  const format = createMessageFormatter({ 'Môn {1}: {0} điểm': 'Score {0} for {1}' });
  assert.equal(format('Môn WBAN 2.0: 82 điểm'), 'Score 82 for WBAN 2.0');
});
