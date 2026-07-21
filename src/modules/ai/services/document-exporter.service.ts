import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

@Injectable()
export class DocumentExporterService {
  private readonly logger = new Logger(DocumentExporterService.name);

  /**
   * Generate a PDF buffer containing translated document text.
   */
  async generatePdfBuffer(title: string, textContent: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: 50,
          size: 'A4',
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err: unknown) =>
          reject(err instanceof Error ? err : new Error(String(err))),
        );

        // Header Title
        doc
          .fontSize(20)
          .font('Helvetica-Bold')
          .text(title, { align: 'center' });
        doc.moveDown(1.5);

        // Document Body Paragraphs
        doc.fontSize(11).font('Helvetica');
        const paragraphs = textContent.split('\n\n');

        for (const para of paragraphs) {
          if (para.trim()) {
            doc.text(para.trim(), {
              align: 'justify',
              lineGap: 4,
            });
            doc.moveDown(1);
          }
        }

        doc.end();
      } catch (error) {
        this.logger.error(
          `Failed to generate PDF buffer: ${(error as Error).message}`,
        );
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Generate a Word (.docx) buffer containing translated document text.
   */
  async generateDocxBuffer(
    title: string,
    textContent: string,
  ): Promise<Buffer> {
    try {
      const paragraphs = textContent.split('\n\n');

      const docxParagraphs: Paragraph[] = [
        new Paragraph({
          text: title,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 300 },
        }),
      ];

      for (const para of paragraphs) {
        if (para.trim()) {
          docxParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: para.trim(),
                  size: 24, // 12pt font size
                }),
              ],
              spacing: { after: 200, line: 276 },
            }),
          );
        }
      }

      const doc = new Document({
        sections: [
          {
            children: docxParagraphs,
          },
        ],
      });

      return await Packer.toBuffer(doc);
    } catch (error) {
      this.logger.error(
        `Failed to generate DOCX buffer: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
