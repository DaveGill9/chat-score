export type TestRow = {
  id: string;
  input: string;
  expected: string;
  actual?: string;
  score?: number;
  reasoning?: string;
  [key: string]: unknown;
};

export type ResultSetMeta = {
  _id: string;
  name: string;
  filename: string;
  testSetName?: string | null;
  testSetFilename?: string | null;
  createdAt: string;
};

export type Evaluation = {
  summary?: string;
  whatWentWell?: string[];
  whatWentWrong?: string[];
  patterns?: string[];
  suggestions?: string[];
  promptChanges?: string[];
};
