import PDFDocument from "pdfkit";

export const generateInvoicePdf = async (data: any): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const buffers: Buffer[] = [];

            doc.on("data", buffers.push.bind(buffers));
            doc.on("end", () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
            doc.on("error", reject);

            // Header
            doc.fillColor("#1e293b")
               .fontSize(24)
               .text("JATRA INVOICE", { align: "center" })
               .fontSize(10)
               .fillColor("#94a3b8")
               .text("Payment Receipt & Booking Confirmation", { align: "center" })
               .moveDown(2);

            // Customer Greeting
            doc.fillColor("#0f172a")
               .fontSize(14)
               .text(`Hello ${data.customerName},`)
               .fontSize(10)
               .fillColor("#475569")
               .text("Your payment for your Jatra automotive service or rental has been successfully processed. Below is your official payment invoice for your records.")
               .moveDown(2);

            // Invoice Details Box
            const boxTop = doc.y;
            doc.rect(50, boxTop, 500, 100).fill("#f8fafc").stroke("#e2e8f0");
            
            doc.fillColor("#0f172a").fontSize(10);
            doc.text("Invoice ID:", 70, boxTop + 20).text(data.invoiceId, 300, boxTop + 20, { align: "right", width: 230 });
            doc.text("Transaction ID:", 70, boxTop + 40).text(data.transactionId, 300, boxTop + 40, { align: "right", width: 230 });
            doc.text("Payment Status:", 70, boxTop + 60).fillColor("#16a34a").text("PAID", 300, boxTop + 60, { align: "right", width: 230 });
            doc.fillColor("#0f172a").text("Payment Date:", 70, boxTop + 80).text(data.paymentDate, 300, boxTop + 80, { align: "right", width: 230 });
            
            doc.moveDown(8);

            // Booking Details
            doc.fontSize(12).fillColor("#0f172a").text("Booking Details", 50, doc.y, { underline: true }).moveDown();
            
            doc.fontSize(10).fillColor("#64748b").text("Service / Item:");
            doc.fillColor("#0f172a").text(data.serviceName).moveDown();
            
            doc.fillColor("#64748b").text("Booking Date:");
            doc.fillColor("#0f172a").text(data.bookingDate).moveDown(2);

            // Payment Summary
            doc.fontSize(12).fillColor("#0f172a").text("Payment Summary", { underline: true }).moveDown();
            
            const summaryTop = doc.y;
            doc.rect(50, summaryTop, 500, 70).fill("#1e293b");
            doc.fillColor("#94a3b8").fontSize(10).text("Total Amount Paid", 50, summaryTop + 20, { align: "center", width: 500 });
            doc.fillColor("#ffffff").fontSize(20).text(`${Number(data.amount).toFixed(2)} BDT`, 50, summaryTop + 35, { align: "center", width: 500 });
            
            doc.moveDown(4);

            // Footer
            doc.fillColor("#0f172a").fontSize(10).text("Jatra Automotive Services", 50, doc.y, { align: "center" });
            doc.fillColor("#64748b").fontSize(8).text("The ultimate platform for vehicle rentals & repairs.", { align: "center" });
            doc.text("© 2026 Jatra. All rights reserved.", { align: "center" });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};
