export type TestRow = {
  id: string;
  input: string;
  expected: string;
  actual?: string;
  score?: number;
  reasoning?: string;
  [key: string]: unknown;
};

export type RawRow = Record<string, unknown>;

export type TestScore = {
  score: number;
  reasoning: string;
};
