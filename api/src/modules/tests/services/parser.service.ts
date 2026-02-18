import { Injectable } from '@nestjs/common';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { RawRow, TestRow } from '../types/test.types';

@Injectable()
export class ParserService {
  parseRawBuffer(buffer: Buffer, filename: string): RawRow[] {
    const ext = this.getExt(filename);
    if (ext === 'xlsx' || ext === 'xls') {
      return this.parseXlsxRaw(buffer);
    }
    return this.parseCsvRaw(buffer);
  }

  parseTestRowsBuffer(buffer: Buffer, filename: string): TestRow[] {
    const ext = this.getExt(filename);
    const rows = ext === 'xlsx' || ext === 'xls'
      ? this.parseXlsxRaw(buffer) as TestRow[]
      : this.parseCsvRaw(buffer) as TestRow[];
    this.validateRequiredFields(rows);
    return rows;
  }

  toCsvBuffer(rows: RawRow[] | TestRow[]): Buffer {
    const csv = Papa.unparse(rows);
    return Buffer.from(csv, 'utf-8');
  }

  toXlsxBuffer(rows: RawRow[] | TestRow[], sheetName = 'Sheet1'): Buffer {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(buf);
  }

  private getExt(filename: string): string {
    return (filename.split('.').pop() || '').toLowerCase();
  }

  private parseCsvRaw(buffer: Buffer): RawRow[] {
    const text = buffer.toString('utf-8');
    const result = Papa.parse(text, { header: true, skipEmptyLines: true });
    if (result.errors.length > 0) {
      throw new Error('CSV parse errors: ' + JSON.stringify(result.errors));
    }
    return (result.data as RawRow[]).filter((r) => Object.keys(r).length > 0);
  }

  private parseXlsxRaw(buffer: Buffer): RawRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('XLSX file has no sheets');
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as RawRow[];
  }

  private validateRequiredFields(rows: TestRow[]): void {
    for (const row of rows) {
      if (!row.id || !row.input || !row.expected) {
        throw new Error(
          `Row missing required fields (id, input, expected): ${JSON.stringify(row)}`,
        );
      }
    }
  }
}
