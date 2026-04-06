import jsPDF from "jspdf";
import autoTable, { type UserOptions } from "jspdf-autotable";

interface PdfExportOptions {
  title: string;
  subtitle?: string;
  filename: string;
  summaryCards?: { label: string; value: string }[];
  tables: {
    title?: string;
    headers: string[];
    rows: (string | number)[][];
  }[];
}

export function exportReportPdf(options: PdfExportOptions) {
  const { title, subtitle, filename, summaryCards, tables } = options;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Brand colors
  const brandBlue: [number, number, number] = [14, 165, 233]; // #0EA5E9
  const darkSlate: [number, number, number] = [15, 23, 42]; // #0F172A
  const headerGray: [number, number, number] = [30, 41, 59];

  // Header bar
  doc.setFillColor(...darkSlate);
  doc.rect(0, 0, pageWidth, 22, "F");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 14, 12);

  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(subtitle, 14, 18);
  }

  // Generated timestamp
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  const now = new Date();
  doc.text(
    `Generated: ${now.toLocaleDateString("en-GB")} ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`,
    pageWidth - 14,
    18,
    { align: "right" }
  );

  // BeBright branding
  doc.setFontSize(10);
  doc.setTextColor(brandBlue[0], brandBlue[1], brandBlue[2]);
  doc.text("BeBright Planner", pageWidth - 14, 12, { align: "right" });

  let yPos = 28;

  // Summary cards
  if (summaryCards && summaryCards.length > 0) {
    const cardWidth = Math.min(60, (pageWidth - 28 - (summaryCards.length - 1) * 4) / summaryCards.length);
    const startX = 14;

    summaryCards.forEach((card, i) => {
      const x = startX + i * (cardWidth + 4);
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(x, yPos, cardWidth, 16, 2, 2, "F");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(card.label, x + 4, yPos + 5);
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(card.value, x + 4, yPos + 13);
    });

    yPos += 22;
  }

  // Tables
  tables.forEach((table, tableIdx) => {
    if (table.title) {
      if (yPos > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        yPos = 14;
      }
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(table.title, 14, yPos + 4);
      yPos += 8;
    }

    const tableOptions: UserOptions = {
      startY: yPos,
      head: [table.headers],
      body: table.rows.map((row) => row.map((cell) => String(cell))),
      theme: "grid",
      headStyles: {
        fillColor: headerGray,
        textColor: [255, 255, 255],
        fontSize: 7,
        fontStyle: "bold",
        halign: "center",
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 1.5,
        textColor: [30, 41, 59],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      styles: {
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        overflow: "linebreak",
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        // Footer on every page
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `${title} — Page ${doc.getCurrentPageInfo().pageNumber}`,
          14,
          pageHeight - 6
        );
        doc.text(
          "BeBright Planner • Confidential",
          pageWidth - 14,
          pageHeight - 6,
          { align: "right" }
        );
      },
    };

    autoTable(doc, tableOptions);
    yPos = (doc as any).lastAutoTable.finalY + 8;
  });

  doc.save(filename);
}
