import { zipSync, unzipSync, strToU8 } from "fflate";
import { pdfFixture, docxFixture } from "./fixtures.mjs";
export const theoryPDF = () =>
  pdfFixture([
    "Physics study guide: Internal energy",
    "The internal energy of a body is the total kinetic and potential energy of its particles.",
    "Heat transfer can change internal energy.",
    "Internal energy depends on temperature and volume.",
  ]);
export const questionsPDF = () =>
  pdfFixture([
    "Arithmetic review - source questions",
    "Question 1: What is 2 + 2?",
    "A. 3",
    "B. 5",
    "C. 4",
    "D. 6",
    "Source answer for Question 1: B",
    "Question 2: What is 3 + 3?",
    "A. 5",
    "B. 6",
    "C. 7",
    "D. 8",
    "No answer is supplied for Question 2.",
  ]);
export const theoryDOCX = () =>
  docxFixture([
    "Đề cương Vật lí: Nội năng và truyền nhiệt",
    "Nội năng của một vật là tổng động năng và thế năng tương tác của các phân tử cấu tạo nên vật.",
    "Nội năng phụ thuộc vào nhiệt độ và thể tích của vật.",
    "Truyền nhiệt có thể làm thay đổi nội năng. Nhiệt lượng là phần nội năng mà vật nhận thêm hoặc mất đi trong quá trình truyền nhiệt.",
  ]);
export const corruptDOCX = () =>
  Buffer.from(
    zipSync({
      ...unzipSync(docxFixture()),
      "word/document.xml": strToU8("<broken>"),
    }),
  );
