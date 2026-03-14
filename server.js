import express from 'express';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { google } from 'googleapis';

const app = express();
app.use(express.json({ limit: '25mb' }));

const PORT = process.env.PORT || 8080;

// Coordinates calibrated from the user's sample PDF.
const PDF_STAMP = {
  pageFromEnd: 1,
  signature: { x: 72, y: 24, width: 150, height: 34 },
  date: { x: 128, y: 22, size: 10 }
};

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  return google.drive({ version: 'v3', auth });
}

async function downloadFileBuffer(drive, fileId) {
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
  return Buffer.from(res.data);
}

async function uploadFileBuffer(drive, folderId, fileName, buffer) {
  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: folderId ? [folderId] : undefined
    },
    media: {
      mimeType: 'application/pdf',
      body: Buffer.from(buffer)
    },
    fields: 'id,name'
  });
  return res.data;
}

function buildSignedName(originalFileName, requestId) {
  const base = String(originalFileName || 'document.pdf').replace(/\.pdf$/i, '');
  return `${base}_SIGNED_${requestId}.pdf`;
}

app.post('/', async (req, res) => {
  try {
    const { pdfFileId, signatureDataUrl, signedDateText, requestId, outputFolderId, originalFileName } = req.body || {};
    if (!pdfFileId || !signatureDataUrl || !requestId) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const drive = getDriveClient();
    const originalPdfBuffer = await downloadFileBuffer(drive, pdfFileId);

    const pdfDoc = await PDFDocument.load(originalPdfBuffer);
    const pages = pdfDoc.getPages();
    const targetPage = pages[pages.length - PDF_STAMP.pageFromEnd];

    const pngBytes = Buffer.from(signatureDataUrl.split(',')[1], 'base64');
    const signatureImage = await pdfDoc.embedPng(pngBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    targetPage.drawImage(signatureImage, {
      x: PDF_STAMP.signature.x,
      y: PDF_STAMP.signature.y,
      width: PDF_STAMP.signature.width,
      height: PDF_STAMP.signature.height
    });

    if (signedDateText) {
      targetPage.drawText(String(signedDateText), {
        x: PDF_STAMP.date.x,
        y: PDF_STAMP.date.y,
        size: PDF_STAMP.date.size,
        font,
        color: rgb(0, 0, 0)
      });
    }

    const signedPdfBytes = await pdfDoc.save();
    const signedFileName = buildSignedName(originalFileName, requestId);
    const uploaded = await uploadFileBuffer(drive, outputFolderId, signedFileName, signedPdfBytes);

    res.json({
      ok: true,
      signedFileId: uploaded.id,
      signedFileName: uploaded.name
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message || String(err));
  }
});

app.listen(PORT, () => {
  console.log(`PDF signer listening on port ${PORT}`);
});
