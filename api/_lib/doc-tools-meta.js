// api/_lib/doc-tools-meta.js
// PDF vositalari ro'yxati va fayl chegaralari. Og'ir kutubxonalar (mammoth, xlsx, pdf-lib, pdfjs)
// api/_lib/doc-tools.js da — ularni faqat api/resume-pdf.js yuklaydi; ai-request.js shu yengil faylni oladi.
const TOOLS = ["word2pdf", "excel2pdf", "pdfmerge", "pdfsplit", "pdf2word", "pdf2pptx"];
const EXT = {
  word2pdf: ["docx"], excel2pdf: ["xlsx", "xls", "xlsm", "csv"], pdfmerge: ["pdf"], pdfsplit: ["pdf"], pdf2word: ["pdf"], pdf2pptx: ["pdf"],
};
const MAX_FILES = { word2pdf: 1, excel2pdf: 1, pdfmerge: 10, pdfsplit: 1, pdf2word: 1, pdf2pptx: 1 };
module.exports = { TOOLS, EXT, MAX_FILES };
