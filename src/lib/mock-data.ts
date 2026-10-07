import type { Attempt, Question, StudyDocument, Topic, TopicId } from "./types";

export const topics: Topic[] = [
  {
    id: "internal",
    title: "Nội năng và các cách làm biến đổi nội năng",
    shortTitle: "Nội năng",
    description: "Nhiệt độ, chuyển động phân tử và sự truyền nhiệt.",
  },
  {
    id: "first-law",
    title: "Nguyên lí I nhiệt động lực học",
    shortTitle: "Nguyên lí I",
    description: "Mối liên hệ giữa công, nhiệt lượng và nội năng.",
  },
  {
    id: "heat",
    title: "Bài tập nhiệt lượng",
    shortTitle: "Nhiệt lượng",
    description: "Nhiệt dung riêng và phương trình cân bằng nhiệt.",
  },
];
export const mockDocuments: StudyDocument[] = [
  {
    id: "physics",
    name: "Đề cương Vật lí 12.pdf",
    format: "PDF",
    size: "2.4 MB",
    addedAt: "06/10/2026",
    questionCount: 58,
  },
  {
    id: "heat-exercises",
    name: "Bài tập Nhiệt lượng.pdf",
    format: "PDF",
    size: "1.1 MB",
    addedAt: "05/10/2026",
    questionCount: 16,
  },
  {
    id: "first-law-notes",
    name: "Vật lí - Nguyên lí I.docx",
    format: "DOCX",
    size: "846 KB",
    addedAt: "04/10/2026",
    questionCount: 24,
  },
];
function question(
  id: string,
  topicId: TopicId,
  prompt: string,
  answers: string[],
  correct: number,
  explanation: string,
  page: number,
): Question {
  return {
    id,
    topicId,
    prompt,
    choices: answers.map((text, index) => ({
      id: String.fromCharCode(65 + index),
      text,
    })),
    correctId: String.fromCharCode(65 + correct),
    explanation,
    page,
    source: "document",
    origin: "document",
  };
}

export const baseQuestions: Question[] = [
  question(
    "i1",
    "internal",
    "Nội năng của một vật là gì?",
    [
      "Tổng động năng và thế năng của các phân tử cấu tạo nên vật.",
      "Động năng của vật khi chuyển động.",
      "Nhiệt lượng vật nhận được.",
      "Tổng cơ năng của vật so với mặt đất.",
    ],
    0,
    "Nội năng gồm động năng chuyển động nhiệt và thế năng tương tác giữa các phân tử. Nó khác với cơ năng chuyển động của cả vật.",
    3,
  ),
  question(
    "i2",
    "internal",
    "Nội năng của một vật phụ thuộc vào những yếu tố nào?",
    [
      "Chỉ khối lượng của vật.",
      "Nhiệt độ và thể tích của vật.",
      "Chỉ độ cao so với mặt đất.",
      "Chỉ tốc độ chuyển động của vật.",
    ],
    1,
    "Nhiệt độ liên quan đến động năng phân tử, còn thể tích liên quan đến khoảng cách và thế năng tương tác giữa chúng.",
    3,
  ),
  question(
    "i3",
    "internal",
    "Cách nào sau đây làm thay đổi nội năng bằng thực hiện công?",
    [
      "Đun nước bằng bếp.",
      "Để cốc nước dưới nắng.",
      "Cọ xát hai bàn tay vào nhau.",
      "Ngâm thìa trong nước nóng.",
    ],
    2,
    "Khi cọ xát, công của lực ma sát làm tăng nội năng của bàn tay. Các phương án còn lại là truyền nhiệt.",
    4,
  ),
  question(
    "i4",
    "internal",
    "Hiện tượng nào là sự truyền nhiệt?",
    [
      "Nén khí trong xi lanh.",
      "Búa đập vào một miếng kim loại.",
      "Cọ xát thước nhựa.",
      "Thả một thìa kim loại vào cốc nước nóng.",
    ],
    3,
    "Nhiệt được truyền từ nước nóng sang thìa lạnh do chênh lệch nhiệt độ.",
    4,
  ),
  question(
    "i5",
    "internal",
    "Hai vật tiếp xúc nhiệt với nhau. Nhiệt tự truyền theo chiều nào?",
    [
      "Từ vật nóng hơn sang vật lạnh hơn.",
      "Từ vật nặng sang vật nhẹ.",
      "Từ vật lạnh sang vật nóng.",
      "Từ vật có thể tích lớn sang vật nhỏ.",
    ],
    0,
    "Nhiệt tự truyền từ nơi có nhiệt độ cao đến nơi có nhiệt độ thấp cho đến khi cân bằng nhiệt.",
    4,
  ),
  question(
    "i6",
    "internal",
    "Đơn vị SI của nội năng là gì?",
    ["Kelvin (K).", "Joule (J).", "Watt (W).", "Newton (N)."],
    1,
    "Nội năng là một dạng năng lượng nên có đơn vị SI là joule (J).",
    3,
  ),
  question(
    "i7",
    "internal",
    "Khi nhiệt độ của một khối khí lí tưởng tăng, động năng trung bình của phân tử sẽ thế nào?",
    ["Giảm.", "Không đổi.", "Tăng.", "Bằng không."],
    2,
    "Nhiệt độ tuyệt đối tỉ lệ với động năng tịnh tiến trung bình của phân tử khí lí tưởng.",
    5,
  ),
  question(
    "i8",
    "internal",
    "Phát biểu nào về nhiệt lượng là đúng?",
    [
      "Nhiệt lượng luôn bằng nội năng.",
      "Nhiệt lượng là nhiệt độ của vật.",
      "Mọi vật đều chứa một lượng nhiệt cố định.",
      "Nhiệt lượng là năng lượng trao đổi trong quá trình truyền nhiệt.",
    ],
    3,
    "Nhiệt lượng mô tả năng lượng trao đổi do chênh lệch nhiệt độ, không phải một đại lượng mà vật chứa sẵn.",
    5,
  ),
  question(
    "i9",
    "internal",
    "Khi nén nhanh khí trong bơm xe, khí nóng lên chủ yếu do đâu?",
    [
      "Khí nhận công từ pít-tông.",
      "Khí nhận nhiệt từ lốp xe.",
      "Khối lượng khí tăng.",
      "Nhiệt lượng bằng không nên nội năng không đổi.",
    ],
    0,
    "Nén nhanh gần như không kịp trao đổi nhiệt. Công thực hiện lên khí làm tăng nội năng và nhiệt độ.",
    6,
  ),
  question(
    "i10",
    "internal",
    "Khi hai vật đạt cân bằng nhiệt, đại lượng nào bằng nhau?",
    ["Nội năng.", "Nhiệt độ.", "Khối lượng.", "Nhiệt dung riêng."],
    1,
    "Cân bằng nhiệt xảy ra khi hai vật có cùng nhiệt độ; nội năng, khối lượng và nhiệt dung riêng có thể khác nhau.",
    5,
  ),
  question(
    "f1",
    "first-law",
    "Với A là công hệ nhận và Q là nhiệt hệ nhận, nguyên lí I được viết như thế nào?",
    ["ΔU = A − Q.", "ΔU = Q − A.", "ΔU = A + Q.", "ΔU = A × Q."],
    2,
    "Theo quy ước hệ nhận công A > 0 và nhận nhiệt Q > 0, độ biến thiên nội năng là ΔU = A + Q.",
    7,
  ),
  question(
    "f2",
    "first-law",
    "Khí nhận 200 J nhiệt lượng và thực hiện công 80 J. Nội năng thay đổi bao nhiêu?",
    ["Tăng 280 J.", "Giảm 120 J.", "Giảm 280 J.", "Tăng 120 J."],
    3,
    "Khí nhận nhiệt Q = 200 J và thực hiện công nên A = −80 J. ΔU = 200 − 80 = 120 J.",
    8,
  ),
  question(
    "f3",
    "first-law",
    "Một hệ nhận công 100 J và tỏa nhiệt 40 J. Giá trị ΔU là bao nhiêu?",
    ["60 J.", "140 J.", "−60 J.", "−140 J."],
    0,
    "Hệ nhận công A = 100 J và tỏa nhiệt Q = −40 J. ΔU = 100 − 40 = 60 J.",
    8,
  ),
  question(
    "f4",
    "first-law",
    "Trong quá trình đẳng tích, công của khí là bao nhiêu?",
    ["Luôn dương.", "Bằng 0.", "Luôn âm.", "Bằng nhiệt lượng."],
    1,
    "Thể tích không thay đổi nên công do khí thực hiện qua sự dịch chuyển pít-tông bằng 0. Khi đó ΔU = Q.",
    9,
  ),
  question(
    "f5",
    "first-law",
    "Trong quá trình đoạn nhiệt, đại lượng nào bằng 0?",
    ["Nội năng U.", "Công A.", "Nhiệt lượng Q.", "Nhiệt độ T."],
    2,
    "Đoạn nhiệt là quá trình không trao đổi nhiệt với môi trường, vì vậy Q = 0, còn ΔU = A.",
    9,
  ),
  question(
    "f6",
    "first-law",
    "Theo quy ước ΔU = A + Q, khi khí nở và thực hiện công thì A có dấu gì?",
    ["Luôn bằng 0.", "Dương.", "Không xác định.", "Âm."],
    3,
    "Khí thực hiện công ra ngoài nghĩa là hệ mất năng lượng qua công, nên công hệ nhận A < 0.",
    7,
  ),
  question(
    "f7",
    "first-law",
    "Khí nhận 350 J nhiệt, nội năng tăng 150 J. Công khí thực hiện là bao nhiêu?",
    ["200 J.", "500 J.", "150 J.", "−350 J."],
    0,
    "A = ΔU − Q = 150 − 350 = −200 J. Vì A là công hệ nhận, công khí thực hiện ra ngoài là 200 J.",
    10,
  ),
  question(
    "f8",
    "first-law",
    "Nếu một hệ không trao đổi nhiệt và không nhận hay thực hiện công, nội năng sẽ thế nào?",
    ["Tăng.", "Không đổi.", "Giảm.", "Bằng không."],
    1,
    "A = 0 và Q = 0 nên ΔU = 0. Nội năng không đổi, không có nghĩa là nội năng bằng 0.",
    10,
  ),
  question(
    "f9",
    "first-law",
    "Nguyên lí I nhiệt động lực học là biểu hiện của định luật nào?",
    [
      "Bảo toàn động lượng.",
      "Vạn vật hấp dẫn.",
      "Bảo toàn năng lượng.",
      "Bảo toàn điện tích.",
    ],
    2,
    "Nguyên lí I thể hiện sự bảo toàn và chuyển hóa năng lượng trong các quá trình nhiệt động.",
    7,
  ),
  question(
    "f10",
    "first-law",
    "Khí bị nén đoạn nhiệt. Nhiệt độ của khí thường thay đổi thế nào?",
    ["Không đổi.", "Giảm về 0 K.", "Giảm.", "Tăng."],
    3,
    "Khí nhận công A > 0 trong khi Q = 0 nên nội năng tăng. Với khí lí tưởng, nhiệt độ tăng theo nội năng.",
    9,
  ),
  question(
    "h1",
    "heat",
    "Công thức tính nhiệt lượng để tăng nhiệt độ, không có chuyển thể, là gì?",
    ["Q = mcΔT.", "Q = m/c.", "Q = c/ΔT.", "Q = mΔT/c."],
    0,
    "Q = mcΔT, trong đó m là khối lượng, c là nhiệt dung riêng và ΔT là độ tăng nhiệt độ.",
    11,
  ),
  question(
    "h2",
    "heat",
    "Đun 0,5 kg nước từ 20°C lên 40°C, c = 4 200 J/(kg·K). Cần bao nhiêu nhiệt?",
    ["21 000 J.", "42 000 J.", "84 000 J.", "4 200 J."],
    1,
    "Q = 0,5 × 4 200 × (40 − 20) = 42 000 J, bỏ qua thất thoát nhiệt.",
    12,
  ),
  question(
    "h3",
    "heat",
    "Đơn vị của nhiệt dung riêng là gì?",
    ["J/K.", "J/kg.", "J/(kg·K).", "kg/J."],
    2,
    "Nhiệt dung riêng cho biết nhiệt lượng cần cho 1 kg chất tăng 1 K, nên có đơn vị J/(kg·K).",
    11,
  ),
  question(
    "h4",
    "heat",
    "Trong hệ cô lập, phương trình cân bằng nhiệt có dạng nào?",
    [
      "Q thu = 0.",
      "Q tỏa = 0.",
      "Q thu > Q tỏa.",
      "Q thu = Q tỏa (tính theo độ lớn).",
    ],
    3,
    "Bỏ qua thất thoát ra môi trường, năng lượng vật nóng tỏa ra bằng năng lượng vật lạnh thu vào.",
    13,
  ),
  question(
    "h5",
    "heat",
    "Một vật 2 kg, c = 500 J/(kg·K), tăng 10 K. Nhiệt lượng nhận là bao nhiêu?",
    ["10 000 J.", "1 000 J.", "100 J.", "25 000 J."],
    0,
    "Q = mcΔT = 2 × 500 × 10 = 10 000 J.",
    12,
  ),
  question(
    "h6",
    "heat",
    "Một chất có nhiệt dung riêng lớn nghĩa là gì?",
    [
      "Chất luôn nóng hơn chất khác.",
      "Cần nhiều nhiệt hơn để 1 kg chất tăng 1 K.",
      "Chất không thể tỏa nhiệt.",
      "Chất có khối lượng lớn hơn.",
    ],
    1,
    "Nhiệt dung riêng càng lớn thì cần càng nhiều năng lượng để làm tăng nhiệt độ cùng một khối lượng lên cùng một mức.",
    11,
  ),
  question(
    "h7",
    "heat",
    "Độ tăng nhiệt độ 15°C tương đương bao nhiêu kelvin?",
    ["288 K.", "273 K.", "15 K.", "−258 K."],
    2,
    "Độ chênh lệch 1°C bằng 1 K. Chỉ khi đổi nhiệt độ tuyệt đối mới cần cộng 273,15.",
    11,
  ),
  question(
    "h8",
    "heat",
    "Trộn hai lượng nước bằng khối lượng ở 20°C và 60°C, bỏ qua thất thoát. Nhiệt độ cuối là?",
    ["20°C.", "60°C.", "80°C.", "40°C."],
    3,
    "Hai phần nước cùng khối lượng và cùng nhiệt dung riêng nên nhiệt độ cân bằng là (20 + 60)/2 = 40°C.",
    13,
  ),
  question(
    "h9",
    "heat",
    "Nếu tăng gấp đôi khối lượng, giữ nguyên c và ΔT, nhiệt lượng cần sẽ thế nào?",
    ["Tăng gấp đôi.", "Giảm một nửa.", "Không đổi.", "Tăng gấp bốn."],
    0,
    "Theo Q = mcΔT, nhiệt lượng tỉ lệ thuận với khối lượng khi c và ΔT không đổi.",
    12,
  ),
  question(
    "h10",
    "heat",
    "Công thức Q = mcΔT không dùng trực tiếp cho quá trình nào?",
    [
      "Đun nước từ 20°C lên 30°C.",
      "Nóng chảy ở nhiệt độ không đổi.",
      "Làm nguội sắt từ 80°C xuống 50°C.",
      "Tăng nhiệt độ dầu 5 K.",
    ],
    1,
    "Trong quá trình chuyển thể ở nhiệt độ không đổi, cần dùng công thức nhiệt chuyển thể phù hợp, chẳng hạn Q = mλ khi nóng chảy.",
    14,
  ),
];

const generated: Question[] = [];
for (let index = 0; index < 28; index++) {
  const topicId: TopicId =
    index < 8 ? "internal" : index < 22 ? "first-law" : "heat";
  const received = 120 + index * 30;
  const work = 20 + index * 10;
  const correct = received - work;
  const heatExercise = topicId === "heat";
  generated.push({
    id: `generated-${index + 1}`,
    topicId,
    prompt: heatExercise
      ? `Một vật có nhiệt dung 200 J/K, nhận ${received * 10} J nhiệt. Nhiệt độ tăng bao nhiêu?`
      : `Một khối khí nhận ${received} J nhiệt và thực hiện công ${work} J. Độ tăng nội năng là bao nhiêu?`,
    choices: [
      heatExercise ? `${received / 20} K` : `${correct} J`,
      heatExercise ? `${received / 10} K` : `${received + work} J`,
      heatExercise ? `${received / 40} K` : `${-correct} J`,
      heatExercise ? `${received} K` : `${work} J`,
    ].map((text, choiceIndex) => ({
      id: String.fromCharCode(65 + choiceIndex),
      text,
    })),
    correctId: "A",
    explanation: heatExercise
      ? `Nhiệt dung C = mc = 200 J/K. ΔT = Q/C = ${received * 10}/200 = ${received / 20} K.`
      : `Q = ${received} J; công hệ nhận A = −${work} J. ΔU = A + Q = ${correct} J.`,
    page: heatExercise ? 12 : 8,
    source: "ai",
    origin: "generated",
  });
}
export const questionBank = [...baseQuestions, ...generated];
questionBank[9] = { ...questionBank[9], origin: "inferred" };
export const originLabels = {
  document: "Đáp án từ tài liệu",
  inferred: "Câu suy luận trong bài mẫu",
  generated: "Câu bổ sung trong bài mẫu",
  source: "Đáp án nguồn được giữ nguyên",
  ai_derived: "Đáp án AI suy luận",
};
export const mockProcessingSteps = [
  "Nạp bài mẫu",
  "Chuẩn bị nội dung có sẵn",
  "Sắp xếp chủ đề",
  "Nạp câu hỏi và đáp án mẫu",
  "Chuẩn bị bài trắc nghiệm",
];
export const mockProfile = {
  name: "Minh Anh",
  initials: "MA",
  grade: "Học sinh lớp 12",
};
export function makeDemoAttempt(): Attempt {
  const questions = baseQuestions.slice(0, 10);
  const answers = Object.fromEntries(
    questions.map((item, index) => [
      item.id,
      index === 2 || index === 6
        ? item.choices.find((choice) => choice.id !== item.correctId)!.id
        : item.correctId,
    ]),
  );
  return {
    id: "demo-attempt",
    title: "Đề cương Vật lí 12",
    documentName: mockDocuments[0].name,
    questions,
    answers,
    current: 0,
    startedAt: 1791279600000,
    elapsedBefore: 0,
    retry: false,
    completedAt: 1791279872000,
    duration: 272,
  };
}
