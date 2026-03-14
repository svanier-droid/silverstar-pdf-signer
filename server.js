const express = require('express');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const app = express();
app.use(express.json({ limit: '25mb' }));

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
      y = 24,
      width = 150,
      height = 34,
      dateX = 128,
      dateY = 22
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
    lastPage.drawText(signedDateText || '', {
      x: dateX,
      y: dateY,
      size: 9,
      font,
      color: rgb(0, 0, 0)
    });

    const signedPdfBytes = await pdfDoc.save();
    const signedPdfBase64 = Buffer.from(signedPdfBytes).toString('base64');

    res.json({
      ok: true,
      signedPdfBase64
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message || String(err)
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`PDF signer listening on port ${PORT}`);
});
