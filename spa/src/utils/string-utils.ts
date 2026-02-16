export const stripHTML = (input: string): string =>
    input.replace(/<\/?[^>]+(>|$)/g, "");

const getControlCharRegex = (): RegExp => {
    const codepoints = [
        ...Array.from({ length: 9 }, (_, i) => i),
        0x0b,
        0x0c,
        ...Array.from({ length: 18 }, (_, i) => i + 0x0e),
        0x7f,
    ];
    const pattern = `[${String.fromCharCode(...codepoints).replace(/[-\\^]/g, "\\$&")}]`;
    return new RegExp(pattern, "g");
};

export const removeControlChars = (input: string): string =>
    input.replace(getControlCharRegex(), "");

export const normaliseWhitespace = (input: string): string =>
    input.replace(/\s+/g, " ").trim();

export const truncateLength = (input: string, maxLength = 1000): string =>
    input.length > maxLength ? input.slice(0, maxLength) : input;

export const stripMarkdown = (input: string): string =>
    input.replace(/[_*`~>/\\#]/g, "");

export const sanitizeInput = (input: string): string => {
    input = stripHTML(input);
    input = removeControlChars(input);
    input = truncateLength(input, 4_000);
    input = stripMarkdown(input);
    return input;
};