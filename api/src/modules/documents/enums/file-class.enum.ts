export enum FileClass {
  TextBased = 'text-based',
  Image = 'image',
  Unknown = 'unknown',
}

export const classifyFile = (filename: string) => {
  const extension = filename.toLowerCase().split('.').pop() || '';
  if (['pdf', 'docx', 'xlsx'].includes(extension)) {
    return FileClass.TextBased;
  } else if (['jpg', 'jpeg', 'png'].includes(extension)) {
    return FileClass.Image;
  } else {
    return FileClass.Unknown;
  }
};
