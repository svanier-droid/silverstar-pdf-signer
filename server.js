const express = require('express');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const app = express();
app.use(express.json({ limit: '30mb' }));

app.get('/', (req, res) => {
  res.send('Silver Star PDF signer is running.');
});

app.post('/sign', async (req, res) => {
  try {
    const {
      pdfBase64,
      signatureDataUrl,
      signedDateText,
      x = 72,
      y = 45,
      width = 150,
      height = 34,
      dateX = 128,
      dateY = 40,
      certificate = {}
    } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({ error: 'pdfBase64 is required' });
    }

    if (!signatureDataUrl) {
      return res.status(400).json({ error: 'signatureDataUrl is required' });
    }

    const pdfBytes = Buffer.from(pdfBase64, 'base64');
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];

    const pngBase64 = signatureDataUrl.split(',')[1];
    const pngBytes = Buffer.from(pngBase64, 'base64');
    const pngImage = await pdfDoc.embedPng(pngBytes);

    lastPage.drawImage(pngImage, {
      x,
      y,
      width,
      height
    });

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    lastPage.drawText(signedDateText || '', {
      x: dateX,
      y: dateY,
      size: 9,
      font,
      color: rgb(0, 0, 0)
    });

    const certPage = pdfDoc.addPage([612, 792]);

    certPage.drawText('Electronic Signature Certificate', {
      x: 50,
      y: 740,
      size: 18,
      font: boldFont,
      color: rgb(0, 0, 0)
    });

    certPage.drawText(certificate.companyName || 'Silver Star Mercedes-Benz', {
      x: 50,
      y: 715,
      size: 11,
      font,
      color: rgb(0, 0, 0)
    });

    const lines = [
      ['Request ID', certificate.requestId || ''],
      ['RO', certificate.ro || ''],
      ['VIN', certificate.vin || ''],
      ['Client', certificate.clientName || ''],
      ['Advisor', certificate.advisorName || ''],
      ['Signed By', certificate.signedByName || ''],
      ['Signed Date', certificate.signedDateText || signedDateText || ''],
      ['IP Address', certificate.signedIp || ''],
      ['Device Info', certificate.deviceInfo || ''],
      ['Timezone', certificate.timezone || ''],
      ['Consent Confirmed', certificate.consent || 'YES']
    ];

    let yPos = 670;
    for (const [label, value] of lines) {
      certPage.drawText(`${label}:`, {
        x: 50,
        y: yPos,
        size: 11,
        font: boldFont,
        color: rgb(0, 0, 0)
      });

      const safeValue = String(value || '');
      certPage.drawText(safeValue, {
        x: 180,
        y: yPos,
        size: 11,
        font,
        color: rgb(0, 0, 0),
        maxWidth: 370
      });

      yPos -= 28;
    }

    certPage.drawText(
      'This certificate was generated automatically at the time of electronic signature submission.',
      {
        x: 50,
        y: 90,
        size: 10,
        font,
        color: rgb(0.25, 0.25, 0.25),
        maxWidth: 500
      }
    );

    const signedPdfBytes = await pdfDoc.save();
    const signedPdfBase64 = Buffer.from(signedPdfBytes).toString('base64');

    res.json({
      ok: true,
      signedPdfBase64
    });
  } catch (err) {
    console.error('SIGN ERROR:', err);
    res.status(500).json({
      error: err.message || String(err)
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`PDF signer listening on port ${PORT}`);
});
