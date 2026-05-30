import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function exportRelatorioPDF(nomeEmpresa: string): Promise<void> {
  const el = document.getElementById("relatorio-pdf");
  if (!el) return;

  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  // Se o conteúdo for maior que uma página, adiciona páginas extras
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPosition = 0;
  let remainingHeight = pdfHeight;

  while (remainingHeight > 0) {
    if (yPosition > 0) {
      pdf.addPage();
    }
    pdf.addImage(imgData, "PNG", 0, -yPosition, pdfWidth, pdfHeight);
    yPosition += pageHeight;
    remainingHeight -= pageHeight;
  }

  const dateStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
  pdf.save(`StockOps_Relatorio_${nomeEmpresa}_${dateStr}.pdf`);
}
